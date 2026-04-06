import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { requireAdmin, optionalAuthenticate } from '../auth.js';
import { recalculateAllGravityScores } from '../lib/gravityUtils.js';

export default async function featureRoutes(fastify, options) {

  // 1. Unified endpoint for listing and filtering features
  fastify.get('/', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const { status, category, search, page = 1, limit = 12 } = request.query;
    const userId = request.user ? request.user.sub : null;
    
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const offsetNum = (pageNum - 1) * limitNum;

    let query = `
      SELECT f.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
      st.name as stage_name, st.color as stage_color, st.slug as stage_slug,
      (SELECT 1 FROM votes v WHERE v.feature_id = f.id AND v.user_id = ?) as user_voted
      FROM features f
      LEFT JOIN categories c ON f.category_id = c.id
      LEFT JOIN stages st ON f.stage_id = st.id
      WHERE 1=1
    `;
    const params = [userId];

    const isAdmin = request.user && request.user.isAdmin;
    if (!isAdmin) {
      query += ' AND f.is_published = 1';
    }

    if (status) {
      query += ' AND (f.status = ? OR st.slug = ?)';
      params.push(status, status);
    }

    if (category) {
      query += ' AND f.category_id = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (f.title LIKE ? OR f.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Always sort by pinned first, then popular, then newest
    query += ' ORDER BY f.pinned DESC, f.vote_count DESC, f.created_at DESC';
    
    // Add pagination limit/offset
    query += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offsetNum);

    const features = db.prepare(query).all(...params);
    
    // Parse tags JSON string back to array if needed
    const data = features.map(f => ({
      ...f,
      user_voted: Boolean(f.user_voted),
      tags: JSON.parse(f.tags || '[]')
    }));

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        hasMore: data.length === limitNum
      }
    };
  });

  // 1.1 Single Feature detail (for deep-linking modals)
  fastify.get('/:id', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user ? request.user.sub : null;

    const query = `
      SELECT f.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
      st.name as stage_name, st.color as stage_color, st.slug as stage_slug,
      (SELECT 1 FROM votes v WHERE v.feature_id = f.id AND v.user_id = ?) as user_voted
      FROM features f
      LEFT JOIN categories c ON f.category_id = c.id
      LEFT JOIN stages st ON f.stage_id = st.id
      WHERE f.id = ?
    `;
    
    const isAdmin = request.user && request.user.isAdmin;
    if (!isAdmin) {
      query += ' AND f.is_published = 1';
    }
    
    const feature = db.prepare(query).get(userId, id);
    if (!feature) return reply.code(404).send({ error: 'Feature not found' });

    return {
      ...feature,
      user_voted: Boolean(feature.user_voted),
      tags: JSON.parse(feature.tags || '[]')
    };
  });

  // 2. Admin: Create new feature
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { 
      title, 
      description, 
      category_id, 
      status, 
      stage_id,
      impact, 
      effort,
      owner,
      key_stakeholder,
      priority,
      is_published
    } = request.body;
    
    if (!title) return reply.code(400).send({ error: 'Title is required' });

    const slug = slugify(title, { lower: true, strict: true });
    const now = new Date().toISOString();
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO features (
        id, title, slug, description, category_id, status, stage_id,
        impact, effort, owner, key_stakeholder, priority, is_published,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // If stage_id is missing, try to find a default from stages table
    let finalStageId = stage_id;
    if (!finalStageId) {
      const defaultStage = db.prepare('SELECT id FROM stages ORDER BY order_idx ASC LIMIT 1').get();
      finalStageId = defaultStage ? defaultStage.id : null;
    }

    stmt.run(
      id, 
      title, 
      slug, 
      description || '', 
      category_id || null, 
      status || 'under_review',
      finalStageId,
      impact || 1,
      effort || 1,
      owner || '',
      key_stakeholder || '',
      priority || 'Medium',
      is_published === 0 ? 0 : 1,
      now, 
      now
    );
    
    db.prepare(`
      INSERT INTO feature_revisions (id, feature_id, changed_by, changed_at, changes)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), id, request.user ? request.user.email : 'System', now, JSON.stringify({
      action: 'created',
      title: title
    }));
    
    // Recalculate scores since maxVotes or inputs might have changed
    recalculateAllGravityScores(db);

    return { id, title, slug };
  });

  // 3. Admin: Update feature
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { 
      title, 
      description, 
      category_id, 
      status, 
      impact, 
      effort,
      owner,
      key_stakeholder,
      priority,
      pinned,
      tags,
      stage_id,
      is_published
    } = request.body;
    const now = new Date().toISOString();

    const oldFeature = db.prepare('SELECT * FROM features WHERE id = ?').get(id);
    if (!oldFeature) return reply.code(404).send({ error: 'Feature not found' });

    const updates = [];
    const params = [];
    const changesObj = {};

    if (title !== undefined && title !== oldFeature.title) {
      changesObj.title = { old: oldFeature.title, new: title };
      updates.push('title = ?, slug = ?');
      params.push(title, slugify(title, { lower: true, strict: true }));
    }
    if (description !== undefined && description !== oldFeature.description) {
      changesObj.description = { updated: true };
      updates.push('description = ?'); params.push(description);
    }
    const currentCategoryId = oldFeature.category_id || null;
    const newCategoryId = category_id || null;
    if (category_id !== undefined && currentCategoryId !== newCategoryId) {
      changesObj.category_id = { old: currentCategoryId, new: newCategoryId };
      updates.push('category_id = ?'); params.push(newCategoryId);
    }
    
    // Status and Stage synchronization
    if (stage_id !== undefined && stage_id !== oldFeature.stage_id) {
      changesObj.stage_id = { old: oldFeature.stage_id, new: stage_id };
      updates.push('stage_id = ?');
      params.push(stage_id);
      // Sync status string based on stage slug
      const stage = db.prepare('SELECT slug FROM stages WHERE id = ?').get(stage_id);
      if (stage) {
        updates.push('status = ?');
        params.push(stage.slug);
      }
    } else if (status !== undefined && status !== oldFeature.status) {
      changesObj.status = { old: oldFeature.status, new: status };
      updates.push('status = ?');
      params.push(status);
      const stage = db.prepare('SELECT id FROM stages WHERE slug = ?').get(status);
      if (stage) {
        updates.push('stage_id = ?');
        params.push(stage.id);
      }
    }

    const currentPinned = oldFeature.pinned === 1;
    const newPinned = pinned ? 1 : 0;
    if (pinned !== undefined && currentPinned !== !!newPinned) {
      changesObj.pinned = { old: currentPinned, new: !!newPinned };
      updates.push('pinned = ?'); params.push(newPinned);
    }
    
    if (tags !== undefined) {
      const newTagsStr = JSON.stringify(tags);
      if (newTagsStr !== oldFeature.tags) {
        changesObj.tags = { updated: true };
        updates.push('tags = ?'); params.push(newTagsStr);
      }
    }
    if (impact !== undefined && parseInt(impact) !== oldFeature.impact) {
      changesObj.impact = { old: oldFeature.impact, new: parseInt(impact) || 1 };
      updates.push('impact = ?'); params.push(parseInt(impact) || 1);
    }
    if (effort !== undefined && parseInt(effort) !== oldFeature.effort) {
      changesObj.effort = { old: oldFeature.effort, new: parseInt(effort) || 1 };
      updates.push('effort = ?'); params.push(parseInt(effort) || 1);
    }
    if (owner !== undefined && owner !== oldFeature.owner) {
      changesObj.owner = { old: oldFeature.owner, new: owner };
      updates.push('owner = ?'); params.push(owner);
    }
    if (key_stakeholder !== undefined && key_stakeholder !== oldFeature.key_stakeholder) {
      changesObj.key_stakeholder = { old: oldFeature.key_stakeholder, new: key_stakeholder };
      updates.push('key_stakeholder = ?'); params.push(key_stakeholder);
    }
    if (priority !== undefined && priority !== oldFeature.priority) {
      changesObj.priority = { old: oldFeature.priority, new: priority };
      updates.push('priority = ?'); params.push(priority);
    }
    if (is_published !== undefined && (is_published ? 1 : 0) !== oldFeature.is_published) {
      changesObj.is_published = { old: oldFeature.is_published, new: is_published ? 1 : 0 };
      updates.push('is_published = ?'); params.push(is_published ? 1 : 0);
    }

    if (updates.length === 0) return reply.code(400).send({ error: 'No updates provided or no changes detected' });

    updates.push('updated_at = ?');
    params.push(now);

    const query = `UPDATE features SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    try {
      const result = db.prepare(query).run(...params);
      if (result.changes === 0) return reply.code(404).send({ error: 'Feature not found' });

      // Recalculate scores if formula inputs changed
      const scoringFields = ['impact', 'effort', 'priority', 'vote_count'];
      const hasScoringChange = updates.some(u => scoringFields.some(f => u.includes(f)));
      if (hasScoringChange) {
        recalculateAllGravityScores(db);
      }

      // Record revision if there are actual changes
      if (Object.keys(changesObj).length > 0) {
        db.prepare(`
          INSERT INTO feature_revisions (id, feature_id, changed_by, changed_at, changes)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), id, request.user ? request.user.email : 'System', now, JSON.stringify({
          action: 'updated',
          fields: changesObj
        }));
      }

      return { ok: true };
    } catch (error) {
      console.error('SQLITE_ERROR in Feature Update:', error);
      console.error('Query:', query);
      console.error('Params:', params);
      return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });

  // 4. Admin: Delete feature (cascades to votes)
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const result = db.prepare('DELETE FROM features WHERE id = ?').run(id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Feature not found' });
    
    // Recalculate scores as max_votes might have changed
    recalculateAllGravityScores(db);
    return { ok: true };
  });

  // 5. Admin: Get feature revisions
  fastify.get('/:id/revisions', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    
    // Check if feature exists
    const feature = db.prepare('SELECT id FROM features WHERE id = ?').get(id);
    if (!feature) return reply.code(404).send({ error: 'Feature not found' });
    
    const revisions = db.prepare(`
      SELECT * FROM feature_revisions 
      WHERE feature_id = ? 
      ORDER BY changed_at DESC
    `).all(id);
    
    return revisions.map(rev => ({
      ...rev,
      changes: JSON.parse(rev.changes)
    }));
  });

}
