import { featuresContainer, categoriesContainer, stagesContainer, revisionsContainer, votesContainer } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { requireAdmin, optionalAuthenticate, authenticate } from '../auth.js';
import { recalculateAllGravityScores } from '../lib/gravityUtils.js';

export default async function featureRoutes(fastify, options) {

  // ── 1. GET / — List & filter features ────────────────────────────────────────
  fastify.get('/', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const { status, category, search, page = 1, limit = 12 } = request.query;
    const userId = request.user?.sub ?? null;
    const isAdmin = request.user?.isAdmin ?? false;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const offsetNum = (pageNum - 1) * limitNum;

    // Build parameterized Cosmos SQL query.
    // Category and stage display fields are denormalized onto the feature document
    // so no JOINs are required.
    const conditions = [];
    const parameters = [];

    if (!isAdmin) {
      conditions.push('c.is_published = true');
    }

    if (status) {
      conditions.push('(c.status = @status OR c.stage_slug = @status)');
      parameters.push({ name: '@status', value: status });
    }

    if (category) {
      conditions.push('c.category_id = @category');
      parameters.push({ name: '@category', value: category });
    }

    if (search) {
      conditions.push('(CONTAINS(c.title, @search, true) OR CONTAINS(c.description, @search, true))');
      parameters.push({ name: '@search', value: search });
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const querySpec = {
      query: `
        SELECT *
        FROM c
        ${whereClause}
        ORDER BY c.pinned DESC, c.vote_count DESC, c.created_at DESC
        OFFSET ${offsetNum} LIMIT ${limitNum}
      `,
      parameters,
    };

    const { resources: features } = await featuresContainer.items
      .query(querySpec, { enableCrossPartitionQuery: true })
      .fetchAll();

    // Resolve user_voted for each feature in a single batch query.
    let votedFeatureIds = new Set();
    if (userId && features.length > 0) {
      const featureIds = features.map((f) => f.id);
      // Query votes partitioned by featureId — needs cross-partition since we
      // span many featureId partitions.  For this dataset size it is acceptable.
      const voteQuerySpec = {
        query: `SELECT c.featureId FROM c WHERE c.userId = @userId AND c.featureId IN (${featureIds.map((_, i) => `@fid${i}`).join(',')})`,
        parameters: [
          { name: '@userId', value: userId },
          ...featureIds.map((id, i) => ({ name: `@fid${i}`, value: id })),
        ],
      };
      const { resources: voted } = await votesContainer.items
        .query(voteQuerySpec, { enableCrossPartitionQuery: true })
        .fetchAll();
      votedFeatureIds = new Set(voted.map((v) => v.featureId));
    }

    const data = features.map((f) => ({
      ...f,
      user_voted: votedFeatureIds.has(f.id),
    }));

    return {
      data,
      meta: { page: pageNum, limit: limitNum, hasMore: data.length === limitNum },
    };
  });

  // ── 1.1 GET /:id — Single feature detail ─────────────────────────────────────
  fastify.get('/:id', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user?.sub ?? null;
    const isAdmin = request.user?.isAdmin ?? false;

    let feature;
    try {
      const { resource } = await featuresContainer.item(id, id).read();
      feature = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    // Enforce is_published for non-admins
    if (!isAdmin && !feature.is_published) {
      return reply.code(404).send({ error: 'Feature not found' });
    }

    // Check if current user has voted
    let user_voted = false;
    if (userId) {
      try {
        await votesContainer.item(`${userId}::${id}`, id).read();
        user_voted = true;
      } catch (err) {
        if (err.code !== 404) throw err;
      }
    }

    return { ...feature, user_voted };
  });

  // ── 2. POST / — Admin: Create feature ────────────────────────────────────────
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const {
      title, description, category_id, status, stage_id,
      impact, effort, owner, key_stakeholder, priority, is_published,
    } = request.body;

    if (!title) return reply.code(400).send({ error: 'Title is required' });

    const id = uuidv4();
    const slug = slugify(title, { lower: true, strict: true });
    const now = new Date().toISOString();

    // Resolve default stage if not provided
    let finalStageId = stage_id ?? null;
    let stageName = null, stageColor = null, stageSlug = null;

    if (finalStageId) {
      try {
        const { resource: stage } = await stagesContainer.item(finalStageId, finalStageId).read();
        stageName = stage.name; stageColor = stage.color; stageSlug = stage.slug;
      } catch { /* stage not found — leave nulls */ }
    } else {
      const { resources: [defaultStage] } = await stagesContainer.items
        .query('SELECT TOP 1 * FROM c ORDER BY c.order_idx ASC', { enableCrossPartitionQuery: true })
        .fetchAll();
      if (defaultStage) {
        finalStageId = defaultStage.id;
        stageName = defaultStage.name; stageColor = defaultStage.color; stageSlug = defaultStage.slug;
      }
    }

    // Resolve category display fields
    let categoryName = null, categoryColor = null, categoryIcon = null;
    const finalCategoryId = category_id ?? null;
    if (finalCategoryId) {
      try {
        const { resource: cat } = await categoriesContainer.item(finalCategoryId, finalCategoryId).read();
        categoryName = cat.name; categoryColor = cat.color; categoryIcon = cat.icon;
      } catch { /* category not found — leave nulls */ }
    }

    const doc = {
      id,
      title,
      slug,
      description: description ?? '',
      status: status ?? stageSlug ?? 'under_review',
      category_id: finalCategoryId,
      category_name: categoryName,
      category_color: categoryColor,
      category_icon: categoryIcon,
      stage_id: finalStageId,
      stage_name: stageName,
      stage_color: stageColor,
      stage_slug: stageSlug,
      vote_count: 0,
      impact: impact ?? 1,
      effort: effort ?? 1,
      tags: [],
      pinned: false,
      is_published: is_published === 0 ? false : true,
      owner: owner ?? '',
      key_stakeholder: key_stakeholder ?? '',
      priority: priority ?? 'Medium',
      gravity_score: 0,
      created_at: now,
      updated_at: now,
    };

    try {
      await featuresContainer.items.create(doc);
    } catch (err) {
      if (err.code === 409) return reply.code(409).send({ error: 'A feature with this slug already exists' });
      throw err;
    }

    await revisionsContainer.items.create({
      id: uuidv4(),
      featureId: id,
      changed_by: request.user?.email ?? 'System',
      changed_at: now,
      changes: { action: 'created', title },
    });

    await recalculateAllGravityScores();
    return { id, title, slug };
  });

  // ── 3. PUT /:id — Admin: Update feature ───────────────────────────────────────
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const {
      title, description, category_id, status, impact, effort,
      owner, key_stakeholder, priority, pinned, tags, stage_id, is_published,
    } = request.body;

    // Fetch existing document
    let oldFeature;
    try {
      const { resource } = await featuresContainer.item(id, id).read();
      oldFeature = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    const now = new Date().toISOString();
    const updated = { ...oldFeature, updated_at: now };
    const changesObj = {};

    if (title !== undefined && title !== oldFeature.title) {
      changesObj.title = { old: oldFeature.title, new: title };
      updated.title = title;
      updated.slug = slugify(title, { lower: true, strict: true });
    }
    if (description !== undefined && description !== oldFeature.description) {
      changesObj.description = { updated: true };
      updated.description = description;
    }

    // Category change — re-embed display fields
    const newCategoryId = category_id !== undefined ? (category_id || null) : oldFeature.category_id;
    if (newCategoryId !== oldFeature.category_id) {
      changesObj.category_id = { old: oldFeature.category_id, new: newCategoryId };
      updated.category_id = newCategoryId;
      if (newCategoryId) {
        try {
          const { resource: cat } = await categoriesContainer.item(newCategoryId, newCategoryId).read();
          updated.category_name = cat.name;
          updated.category_color = cat.color;
          updated.category_icon = cat.icon;
        } catch { updated.category_name = null; updated.category_color = null; updated.category_icon = null; }
      } else {
        updated.category_name = null; updated.category_color = null; updated.category_icon = null;
      }
    }

    // Stage + status synchronization — re-embed stage display fields
    if (stage_id !== undefined && stage_id !== oldFeature.stage_id) {
      changesObj.stage_id = { old: oldFeature.stage_id, new: stage_id };
      updated.stage_id = stage_id;
      if (stage_id) {
        try {
          const { resource: stage } = await stagesContainer.item(stage_id, stage_id).read();
          updated.stage_name = stage.name;
          updated.stage_color = stage.color;
          updated.stage_slug = stage.slug;
          updated.status = stage.slug;
        } catch { /* stage not found — keep existing status */ }
      } else {
        updated.stage_name = null; updated.stage_color = null; updated.stage_slug = null;
      }
    } else if (status !== undefined && status !== oldFeature.status) {
      changesObj.status = { old: oldFeature.status, new: status };
      updated.status = status;
      // Also sync stage to the matching slug
      const { resources: [matchedStage] } = await stagesContainer.items
        .query(
          { query: 'SELECT * FROM c WHERE c.slug = @slug', parameters: [{ name: '@slug', value: status }] },
          { enableCrossPartitionQuery: true }
        )
        .fetchAll();
      if (matchedStage) {
        updated.stage_id = matchedStage.id;
        updated.stage_name = matchedStage.name;
        updated.stage_color = matchedStage.color;
        updated.stage_slug = matchedStage.slug;
      }
    }

    if (pinned !== undefined && Boolean(pinned) !== oldFeature.pinned) {
      changesObj.pinned = { old: oldFeature.pinned, new: Boolean(pinned) };
      updated.pinned = Boolean(pinned);
    }
    if (tags !== undefined) {
      changesObj.tags = { updated: true };
      updated.tags = Array.isArray(tags) ? tags : [];
    }
    if (impact !== undefined && parseInt(impact) !== oldFeature.impact) {
      changesObj.impact = { old: oldFeature.impact, new: parseInt(impact) || 1 };
      updated.impact = parseInt(impact) || 1;
    }
    if (effort !== undefined && parseInt(effort) !== oldFeature.effort) {
      changesObj.effort = { old: oldFeature.effort, new: parseInt(effort) || 1 };
      updated.effort = parseInt(effort) || 1;
    }
    if (owner !== undefined && owner !== oldFeature.owner) {
      changesObj.owner = { old: oldFeature.owner, new: owner };
      updated.owner = owner;
    }
    if (key_stakeholder !== undefined && key_stakeholder !== oldFeature.key_stakeholder) {
      changesObj.key_stakeholder = { old: oldFeature.key_stakeholder, new: key_stakeholder };
      updated.key_stakeholder = key_stakeholder;
    }
    if (priority !== undefined && priority !== oldFeature.priority) {
      changesObj.priority = { old: oldFeature.priority, new: priority };
      updated.priority = priority;
    }
    if (is_published !== undefined) {
      const newVal = is_published === 0 ? false : Boolean(is_published);
      if (newVal !== oldFeature.is_published) {
        changesObj.is_published = { old: oldFeature.is_published, new: newVal };
        updated.is_published = newVal;
      }
    }

    if (Object.keys(changesObj).length === 0) {
      return reply.code(400).send({ error: 'No updates provided or no changes detected' });
    }

    try {
      await featuresContainer.item(id, id).replace(updated);
    } catch (err) {
      console.error('Cosmos error in Feature Update:', err);
      return reply.code(500).send({ error: 'Internal Server Error', message: err.message });
    }

    // Recalculate gravity scores if scoring inputs changed
    const scoringFields = ['impact', 'effort', 'priority'];
    if (scoringFields.some((f) => changesObj[f])) {
      await recalculateAllGravityScores();
    }

    await revisionsContainer.items.create({
      id: uuidv4(),
      featureId: id,
      changed_by: request.user?.email ?? 'System',
      changed_at: now,
      changes: { action: 'updated', fields: changesObj },
    });

    return { ok: true };
  });

  // ── 4. DELETE /:id — Admin: Delete feature ────────────────────────────────────
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;

    try {
      await featuresContainer.item(id, id).delete();
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    // Cascade-delete votes (Cosmos has no ON DELETE CASCADE)
    const { resources: votes } = await votesContainer.items
      .query(
        { query: 'SELECT c.id FROM c WHERE c.featureId = @fid', parameters: [{ name: '@fid', value: id }] },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();
    await Promise.all(votes.map((v) => votesContainer.item(v.id, id).delete().catch(() => {})));

    // Cascade-delete revisions
    const { resources: revisions } = await revisionsContainer.items
      .query(
        { query: 'SELECT c.id FROM c WHERE c.featureId = @fid', parameters: [{ name: '@fid', value: id }] },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();
    await Promise.all(revisions.map((r) => revisionsContainer.item(r.id, id).delete().catch(() => {})));

    await recalculateAllGravityScores();
    return { ok: true };
  });

  // ── 5. GET /:id/revisions — Admin: Get revision history ───────────────────────
  fastify.get('/:id/revisions', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;

    // Verify feature exists
    try {
      await featuresContainer.item(id, id).read();
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Feature not found' });
      throw err;
    }

    const { resources: revisions } = await revisionsContainer.items
      .query(
        {
          query: 'SELECT * FROM c WHERE c.featureId = @fid ORDER BY c.changed_at DESC',
          parameters: [{ name: '@fid', value: id }],
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    return revisions;
  });

  // ── 6. POST /:id/vote — Cast a vote ─────────────────────────────────────────
  const voteId = (userId, featureId) => `${userId}::${featureId}`;

  async function patchVoteCount(featureId, delta) {
    await featuresContainer.item(featureId, featureId).patch([
      { op: 'incr', path: '/vote_count', value: delta },
    ]);
  }

  fastify.post('/:id/vote', { preHandler: [authenticate] }, async (request, reply) => {
    const featureId = request.params.id;
    const userId = request.user.sub;

    try {
      await votesContainer.items.create({
        id: voteId(userId, featureId),
        featureId,
        userId,
      });
    } catch (err) {
      if (err.code === 409) {
        return reply.code(409).send({ error: 'Already voted for this feature' });
      }
      throw err;
    }

    try {
      await patchVoteCount(featureId, 1);
    } catch (err) {
      console.error('Vote count increment failed, rolling back vote document:', err);
      await votesContainer.item(voteId(userId, featureId), featureId).delete().catch(() => {});
      throw err;
    }

    await recalculateAllGravityScores();
    return { ok: true };
  });

  // ── 7. DELETE /:id/vote — Remove a vote ─────────────────────────────────────
  fastify.delete('/:id/vote', { preHandler: [authenticate] }, async (request, reply) => {
    const featureId = request.params.id;
    const userId = request.user.sub;

    try {
      await votesContainer.item(voteId(userId, featureId), featureId).delete();
    } catch (err) {
      if (err.code === 404) {
        return reply.code(404).send({ error: 'Vote not found or already removed' });
      }
      throw err;
    }

    await patchVoteCount(featureId, -1);

    await recalculateAllGravityScores();
    return { ok: true };
  });

}
