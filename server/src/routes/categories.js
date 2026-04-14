import { categoriesContainer, featuresContainer } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../auth.js';

export default async function categoryRoutes(fastify, options) {

  // ── 1. GET / — All categories with feature count ─────────────────────────────
  fastify.get('/', async (request, reply) => {
    const { resources: categories } = await categoriesContainer.items
      .query('SELECT * FROM c ORDER BY c.order_idx ASC', { enableCrossPartitionQuery: true })
      .fetchAll();

    // Fetch feature counts for all categories in parallel
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const { resources: [count] } = await featuresContainer.items
          .query(
            {
              query: 'SELECT VALUE COUNT(1) FROM c WHERE c.category_id = @id',
              parameters: [{ name: '@id', value: cat.id }],
            },
            { enableCrossPartitionQuery: true }
          )
          .fetchAll();
        return { ...cat, feature_count: count ?? 0 };
      })
    );

    return withCounts;
  });

  // ── 2. POST / — Admin: Create category ───────────────────────────────────────
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { name, description, color, icon, order_idx = 0 } = request.body;
    if (!name) return reply.code(400).send({ error: 'Name is required' });

    const id = uuidv4();
    const doc = {
      id,
      name,
      description: description ?? '',
      color: color ?? '#64748b',
      icon: icon ?? 'briefcase',
      order_idx,
    };

    await categoriesContainer.items.create(doc);
    return { id, name };
  });

  // ── 3. PUT /:id — Admin: Update category ──────────────────────────────────────
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, color, icon, order_idx } = request.body;

    let existing;
    try {
      const { resource } = await categoriesContainer.item(id, id).read();
      existing = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Category not found' });
      throw err;
    }

    const updated = { ...existing };
    const displayFieldsChanged = [];

    if (name !== undefined)        { updated.name = name;               if (name !== existing.name)   displayFieldsChanged.push('name'); }
    if (description !== undefined) { updated.description = description; }
    if (color !== undefined)       { updated.color = color;             if (color !== existing.color) displayFieldsChanged.push('color'); }
    if (icon !== undefined)        { updated.icon = icon;               if (icon !== existing.icon)   displayFieldsChanged.push('icon'); }
    if (order_idx !== undefined)   { updated.order_idx = order_idx; }

    await categoriesContainer.item(id, id).replace(updated);

    // Fan-out: if display fields changed, update the denormalized copies in all
    // features that reference this category.
    if (displayFieldsChanged.length > 0) {
      const { resources: affectedFeatures } = await featuresContainer.items
        .query(
          {
            query: 'SELECT c.id FROM c WHERE c.category_id = @catId',
            parameters: [{ name: '@catId', value: id }],
          },
          { enableCrossPartitionQuery: true }
        )
        .fetchAll();

      await Promise.all(
        affectedFeatures.map((f) =>
          featuresContainer.item(f.id, f.id).patch([
            { op: 'set', path: '/category_name',  value: updated.name },
            { op: 'set', path: '/category_color', value: updated.color },
            { op: 'set', path: '/category_icon',  value: updated.icon },
          ])
        )
      );
    }

    return { ok: true };
  });

  // ── 4. POST /reorder — Admin: Bulk reorder ────────────────────────────────────
  fastify.post('/reorder', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { ids } = request.body;
    if (!Array.isArray(ids)) return reply.code(400).send({ error: 'IDs array required' });

    // No multi-partition transaction in Cosmos — run parallel patches.
    // Reordering is idempotent so partial failure is recoverable by retrying.
    await Promise.all(
      ids.map((catId, index) =>
        categoriesContainer.item(catId, catId).patch([
          { op: 'set', path: '/order_idx', value: index },
        ])
      )
    );

    return { ok: true };
  });

  // ── 5. DELETE /:id — Admin: Delete category ───────────────────────────────────
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { reassignTo } = request.body || {};

    // Count features in this category
    const { resources: [count] } = await featuresContainer.items
      .query(
        {
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.category_id = @id',
          parameters: [{ name: '@id', value: id }],
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    if ((count ?? 0) > 0) {
      if (!reassignTo) {
        return reply.code(409).send({ error: 'REASSIGN_REQUIRED' });
      }

      // Fetch target category display fields for denormalization update
      let targetCat = null;
      try {
        const { resource } = await categoriesContainer.item(reassignTo, reassignTo).read();
        targetCat = resource;
      } catch (err) {
        if (err.code === 404) return reply.code(400).send({ error: 'Target category not found' });
        throw err;
      }

      // Reassign all affected features
      const { resources: affectedFeatures } = await featuresContainer.items
        .query(
          {
            query: 'SELECT c.id FROM c WHERE c.category_id = @id',
            parameters: [{ name: '@id', value: id }],
          },
          { enableCrossPartitionQuery: true }
        )
        .fetchAll();

      await Promise.all(
        affectedFeatures.map((f) =>
          featuresContainer.item(f.id, f.id).patch([
            { op: 'set', path: '/category_id',    value: reassignTo },
            { op: 'set', path: '/category_name',  value: targetCat.name },
            { op: 'set', path: '/category_color', value: targetCat.color },
            { op: 'set', path: '/category_icon',  value: targetCat.icon },
          ])
        )
      );
    }

    try {
      await categoriesContainer.item(id, id).delete();
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Category not found' });
      throw err;
    }

    return { ok: true };
  });

}
