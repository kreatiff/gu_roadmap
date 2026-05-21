import { featuresContainer, categoriesContainer, stagesContainer, revisionsContainer, votesContainer } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { requireAdmin, optionalAuthenticate, authenticate } from '../auth.js';
import { recalculateAllGravityScores } from '../lib/gravityUtils.js';

export default async function featureRoutes(fastify, options) {

  // ── 1. GET / — List & filter features ────────────────────────────────────────
  fastify.get('/', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const { status, category, search, tags, is_reviewed, page = 1, limit = 12 } = request.query;
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
      const statusList = String(status).split(',').filter(Boolean);
      if (statusList.length > 1) {
        const statusConditions = [];
        statusList.forEach((s, i) => {
          statusConditions.push(`c.status = @status${i} OR c.stage_slug = @status${i}`);
          parameters.push({ name: `@status${i}`, value: s });
        });
        conditions.push(`(${statusConditions.join(' OR ')})`);
      } else if (statusList.length === 1) {
        conditions.push('(c.status = @status OR c.stage_slug = @status)');
        parameters.push({ name: '@status', value: statusList[0] });
      }
    }

    if (category) {
      const categoryList = String(category).split(',').filter(Boolean);
      if (categoryList.length > 1) {
        const categoryConditions = [];
        categoryList.forEach((c, i) => {
          categoryConditions.push(`c.category_id = @category${i}`);
          parameters.push({ name: `@category${i}`, value: c });
        });
        conditions.push(`(${categoryConditions.join(' OR ')})`);
      } else if (categoryList.length === 1) {
        conditions.push('c.category_id = @category');
        parameters.push({ name: '@category', value: categoryList[0] });
      }
    }

    if (search) {
      const searchFields = isAdmin
        ? '(CONTAINS(c.title, @search, true) OR CONTAINS(c.description, @search, true) OR CONTAINS(c.internal_notes, @search, true))'
        : '(CONTAINS(c.title, @search, true) OR CONTAINS(c.description, @search, true))';
      conditions.push(searchFields);
      parameters.push({ name: '@search', value: search });
    }

    if (tags) {
      // Comma-separated: "vle,canvas" → ARRAY_CONTAINS for each
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        const tagConditions = [];
        tagList.forEach((tag, i) => {
          tagConditions.push(`ARRAY_CONTAINS(c.tags, @tag${i})`);
          parameters.push({ name: `@tag${i}`, value: tag });
        });
        conditions.push(`(${tagConditions.join(' OR ')})`);
      }
    }

    // requiredTags are applied with AND logic — used by dashboards to enforce
    // mandatory tag scope so user sub-filters cannot expand the result set.
    const { requiredTags } = request.query;
    if (requiredTags) {
      const reqTagList = requiredTags.split(',').map(t => t.trim()).filter(Boolean);
      if (reqTagList.length > 0) {
        const reqTagConditions = [];
        reqTagList.forEach((tag, i) => {
          reqTagConditions.push(`ARRAY_CONTAINS(c.tags, @reqTag${i})`);
          parameters.push({ name: `@reqTag${i}`, value: tag });
        });
        conditions.push(`(${reqTagConditions.join(' OR ')})`);
      }
    }

    if (is_reviewed === 'true') {
      conditions.push('c.is_reviewed = true');
    } else if (is_reviewed === 'false') {
      conditions.push('(c.is_reviewed = false OR IS_DEFINED(c.is_reviewed) = false)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const querySpec = {
      query: `
        SELECT *
        FROM c
        ${whereClause}
        ORDER BY c.pinned DESC, c.stage_sort_order ASC, c.vote_count DESC, c.created_at DESC
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

    const data = features.map((f) => {
      const featureData = {
        ...f,
        user_voted: votedFeatureIds.has(f.id),
      };
      if (!isAdmin) {
        delete featureData.internal_notes;
        delete featureData.dependencies;
        delete featureData.dependency_details;
      }
      return featureData;
    });

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

    const result = { ...feature, user_voted };
    if (!isAdmin) {
      delete result.internal_notes;
      delete result.dependencies;
      delete result.dependency_details;
    } else if (Array.isArray(feature.dependencies) && feature.dependencies.length > 0) {
      try {
        const depIds = feature.dependencies.filter(d => typeof d === 'string');
        if (depIds.length > 0) {
          const depQuery = {
            query: `SELECT c.id, c.title, c.slug, c.stage_name, c.stage_color, c.status, c.owner, c.key_stakeholder, c.gravity_score FROM c WHERE c.id IN (${depIds.map((_, i) => `@dep${i}`).join(',')})`,
            parameters: depIds.map((id, i) => ({ name: `@dep${i}`, value: id })),
          };
          const { resources: deps } = await featuresContainer.items
            .query(depQuery, { enableCrossPartitionQuery: true })
            .fetchAll();
          result.dependency_details = deps;
        }
      } catch { /* ignore lookup failures */ }
    }
    return result;
  });

  // ── 2. POST / — Admin: Create feature ────────────────────────────────────────
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const {
      title, description, internal_notes, category_id, status, stage_id,
      impact, effort, owner, key_stakeholder, priority, is_published, tags, dependencies,
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

    // Find max sort_order for this stage so new feature goes to the end
    let maxSortOrder = 0;
    if (finalStageId) {
      try {
        const { resources: orderRes } = await featuresContainer.items
          .query({
            query: 'SELECT TOP 1 c.stage_sort_order FROM c WHERE c.stage_id = @stageId ORDER BY c.stage_sort_order DESC',
            parameters: [{ name: '@stageId', value: finalStageId }],
          }, { enableCrossPartitionQuery: true })
          .fetchAll();
        if (orderRes.length > 0 && typeof orderRes[0].stage_sort_order === 'number') {
          maxSortOrder = orderRes[0].stage_sort_order;
        }
      } catch { /* keep 0 */ }
    }

    const doc = {
      id,
      title,
      slug,
      description: description ?? '',
      internal_notes: internal_notes ?? '',
      dependencies: Array.isArray(dependencies) ? dependencies : [],
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
      impact: impact ?? 5,
      effort: effort ?? 5,
      stage_sort_order: maxSortOrder + 1000,
      tags: Array.isArray(tags) ? tags : [],
      pinned: false,
      is_published: is_published === 0 ? false : true,
      owner: (owner ?? '').trim(),
      key_stakeholder: (key_stakeholder ?? '').trim(),
      priority: priority ?? 'Medium',
      gravity_score: 0,
      is_reviewed: false,
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
      title, description, internal_notes, category_id, status, impact, effort,
      owner, key_stakeholder, priority, pinned, tags, dependencies, stage_id, is_published, is_reviewed,
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
    if (internal_notes !== undefined && internal_notes !== oldFeature.internal_notes) {
      changesObj.internal_notes = { updated: true };
      updated.internal_notes = internal_notes;
    }
    if (dependencies !== undefined) {
      changesObj.dependencies = { updated: true };
      updated.dependencies = Array.isArray(dependencies) ? dependencies : oldFeature.dependencies;
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
    const trimmedOwner = owner !== undefined ? owner.trim() : undefined;
    const trimmedStakeholder = key_stakeholder !== undefined ? key_stakeholder.trim() : undefined;

    if (trimmedOwner !== undefined && trimmedOwner !== oldFeature.owner) {
      changesObj.owner = { old: oldFeature.owner, new: trimmedOwner };
      updated.owner = trimmedOwner;
    }
    if (trimmedStakeholder !== undefined && trimmedStakeholder !== oldFeature.key_stakeholder) {
      changesObj.key_stakeholder = { old: oldFeature.key_stakeholder, new: trimmedStakeholder };
      updated.key_stakeholder = trimmedStakeholder;
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
    if (is_reviewed !== undefined && Boolean(is_reviewed) !== oldFeature.is_reviewed) {
      changesObj.is_reviewed = { old: oldFeature.is_reviewed, new: Boolean(is_reviewed) };
      updated.is_reviewed = Boolean(is_reviewed);
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

  // ── 3.5 PATCH /reorder — Admin: Batch update stage_sort_order ─────────────────
  fastify.patch('/reorder', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { items } = request.body;
    // items: Array<{ id: string, stage_sort_order: number }>

    if (!Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'items array is required' });
    }

    const now = new Date().toISOString();
    const results = [];

    for (const item of items) {
      if (!item.id || typeof item.stage_sort_order !== 'number') continue;
      try {
        const { resource: feature } = await featuresContainer.item(item.id, item.id).read();
        const ops = [
          { op: 'set', path: '/stage_sort_order', value: item.stage_sort_order },
          { op: 'replace', path: '/updated_at', value: now },
        ];
        const { resource: updated } = await featuresContainer.item(item.id, item.id).patch(ops);
        results.push({ id: item.id, stage_sort_order: updated.stage_sort_order });
      } catch (err) {
        if (err.code === 404) {
          results.push({ id: item.id, error: 'Not found' });
        } else {
          throw err;
        }
      }
    }

    return { ok: true, updated: results.length };
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

  // ── 5.1 GET /tags — Public: all unique tags currently on features ─────────────
  fastify.get('/tags', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const isAdmin = request.user?.isAdmin ?? false;
    const whereClause = isAdmin ? '' : 'WHERE c.is_published = true';
    const { resources } = await featuresContainer.items
      .query(
        `SELECT c.tags FROM c ${whereClause}`,
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    // Flatten and deduplicate
    const allTags = [...new Set(resources.flatMap(r => r.tags ?? []))].sort();
    return allTags;
  });

  // ── 5.2 GET /owners — Public: all unique owners currently on features ──────────
  fastify.get('/owners', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const isAdmin = request.user?.isAdmin ?? false;
    const whereClause = isAdmin ? '' : 'WHERE c.is_published = true';
    const { resources } = await featuresContainer.items
      .query(
        `SELECT c.owner FROM c ${whereClause}`,
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    const allOwners = [...new Set(resources.map(r => r.owner).filter(Boolean))].sort();
    return allOwners;
  });

  // ── 5.3 GET /stakeholders — Public: all unique stakeholders on features ───────
  fastify.get('/stakeholders', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const isAdmin = request.user?.isAdmin ?? false;
    const whereClause = isAdmin ? '' : 'WHERE c.is_published = true';
    const { resources } = await featuresContainer.items
      .query(
        `SELECT c.key_stakeholder FROM c ${whereClause}`,
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    const allStakeholders = [...new Set(resources.map(r => r.key_stakeholder).filter(Boolean))].sort();
    return allStakeholders;
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
