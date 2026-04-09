import { stagesContainer, featuresContainer } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { requireAdmin } from '../auth.js';

export default async function stageRoutes(fastify, options) {

  // ── 1. GET / — All stages with feature count ──────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const { resources: stages } = await stagesContainer.items
      .query('SELECT * FROM c ORDER BY c.order_idx ASC', { enableCrossPartitionQuery: true })
      .fetchAll();

    const withCounts = await Promise.all(
      stages.map(async (stage) => {
        const { resources: [count] } = await featuresContainer.items
          .query(
            {
              query: 'SELECT VALUE COUNT(1) FROM c WHERE c.stage_id = @id',
              parameters: [{ name: '@id', value: stage.id }],
            },
            { enableCrossPartitionQuery: true }
          )
          .fetchAll();
        return { ...stage, feature_count: count ?? 0 };
      })
    );

    return withCounts;
  });

  // ── 2. POST / — Admin: Create stage ───────────────────────────────────────────
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { name, color, order_idx, is_visible } = request.body;
    if (!name) return reply.code(400).send({ error: 'Name is required' });

    const id = uuidv4();
    const slug = slugify(name, { lower: true, strict: true });

    // Auto-calculate order_idx if not provided
    let finalOrder = order_idx;
    if (finalOrder === undefined) {
      const { resources: [maxIdx] } = await stagesContainer.items
        .query('SELECT VALUE MAX(c.order_idx) FROM c', { enableCrossPartitionQuery: true })
        .fetchAll();
      finalOrder = (maxIdx ?? 0) + 1;
    }

    const doc = {
      id,
      name,
      color: color ?? '#64748b',
      slug,
      order_idx: finalOrder,
      is_visible: is_visible !== undefined ? Boolean(is_visible) : true,
    };

    try {
      await stagesContainer.items.create(doc);
    } catch (err) {
      if (err.code === 409) return reply.code(409).send({ error: 'A stage with this slug already exists' });
      throw err;
    }

    return { id, name, slug };
  });

  // ── 3. PUT /:id — Admin: Update stage ─────────────────────────────────────────
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { name, color, order_idx, is_visible } = request.body;

    let existing;
    try {
      const { resource } = await stagesContainer.item(id, id).read();
      existing = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Stage not found' });
      throw err;
    }

    const updated = { ...existing };
    const displayFieldsChanged = [];

    if (name !== undefined)       { updated.name = name;               if (name !== existing.name)   displayFieldsChanged.push('name'); }
    if (color !== undefined)      { updated.color = color;             if (color !== existing.color) displayFieldsChanged.push('color'); }
    if (order_idx !== undefined)  { updated.order_idx = order_idx; }
    if (is_visible !== undefined) { updated.is_visible = Boolean(is_visible); }

    await stagesContainer.item(id, id).replace(updated);

    // Fan-out: update denormalized stage fields on all features referencing this stage
    if (displayFieldsChanged.length > 0) {
      const { resources: affectedFeatures } = await featuresContainer.items
        .query(
          {
            query: 'SELECT c.id FROM c WHERE c.stage_id = @stageId',
            parameters: [{ name: '@stageId', value: id }],
          },
          { enableCrossPartitionQuery: true }
        )
        .fetchAll();

      await Promise.all(
        affectedFeatures.map((f) =>
          featuresContainer.item(f.id, f.id).patch([
            { op: 'set', path: '/stage_name',  value: updated.name },
            { op: 'set', path: '/stage_color', value: updated.color },
            { op: 'set', path: '/stage_slug',  value: updated.slug },
          ])
        )
      );
    }

    return { ok: true };
  });

  // ── 4. DELETE /:id — Admin: Delete stage ──────────────────────────────────────
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { reassignTo } = request.body || {};

    // Count features using this stage
    const { resources: [count] } = await featuresContainer.items
      .query(
        {
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.stage_id = @id',
          parameters: [{ name: '@id', value: id }],
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    const featureCount = count ?? 0;

    if (featureCount > 0 && !reassignTo) {
      return reply.code(409).send({
        error: 'CONFLICT_REASSIGN_REQUIRED',
        message: `This stage has ${featureCount} feature(s). Please choose a target stage to move them to.`,
        count: featureCount,
      });
    }

    if (featureCount > 0 && reassignTo) {
      // Fetch target stage display fields for denormalization
      let targetStage = null;
      try {
        const { resource } = await stagesContainer.item(reassignTo, reassignTo).read();
        targetStage = resource;
      } catch (err) {
        if (err.code === 404) return reply.code(400).send({ error: 'Target stage not found' });
        throw err;
      }

      const { resources: affectedFeatures } = await featuresContainer.items
        .query(
          {
            query: 'SELECT c.id FROM c WHERE c.stage_id = @id',
            parameters: [{ name: '@id', value: id }],
          },
          { enableCrossPartitionQuery: true }
        )
        .fetchAll();

      await Promise.all(
        affectedFeatures.map((f) =>
          featuresContainer.item(f.id, f.id).patch([
            { op: 'set', path: '/stage_id',    value: reassignTo },
            { op: 'set', path: '/stage_name',  value: targetStage.name },
            { op: 'set', path: '/stage_color', value: targetStage.color },
            { op: 'set', path: '/stage_slug',  value: targetStage.slug },
          ])
        )
      );
    }

    try {
      await stagesContainer.item(id, id).delete();
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Stage not found' });
      throw err;
    }

    return { ok: true };
  });

  // ── 5. POST /reorder — Admin: Batch reorder stages ────────────────────────────
  fastify.post('/reorder', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { stageIds } = request.body;
    if (!Array.isArray(stageIds)) return reply.code(400).send({ error: 'Array of stageIds required' });

    await Promise.all(
      stageIds.map((stageId, index) =>
        stagesContainer.item(stageId, stageId).patch([
          { op: 'set', path: '/order_idx', value: index },
        ])
      )
    );

    return { ok: true };
  });

}
