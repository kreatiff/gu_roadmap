import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { requireAdmin, optionalAuthenticate } from '../auth.js';

export default async function featureRoutes(fastify, options) {

  // 1. Unified endpoint for listing and filtering features
  fastify.get('/', { preHandler: [optionalAuthenticate] }, async (request, reply) => {
    const { status, section, search, page = 1, limit = 12 } = request.query;
    const userId = request.user ? request.user.sub : null;
    
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const offsetNum = (pageNum - 1) * limitNum;

    let query = `
      SELECT f.*, s.name as section_name, s.color as section_color,
      (SELECT 1 FROM votes v WHERE v.feature_id = f.id AND v.user_id = ?) as user_voted
      FROM features f
      LEFT JOIN sections s ON f.section_id = s.id
      WHERE 1=1
    `;
    const params = [userId];

    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }

    if (section) {
      query += ' AND f.section_id = ?';
      params.push(section);
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
      SELECT f.*, s.name as section_name, s.color as section_color,
      (SELECT 1 FROM votes v WHERE v.feature_id = f.id AND v.user_id = ?) as user_voted
      FROM features f
      LEFT JOIN sections s ON f.section_id = s.id
      WHERE f.id = ?
    `;
    
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
    const { title, description, section_id, status = 'under_review', pinned = 0, tags = [] } = request.body;
    
    if (!title) return reply.code(400).send({ error: 'Title is required' });

    const id = uuidv4();
    const slug = slugify(title, { lower: true, strict: true });
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO features (id, title, slug, description, status, section_id, tags, pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, slug, description, status, section_id, JSON.stringify(tags), pinned, now, now);

    return { id, title, slug };
  });

  // 3. Admin: Update feature
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { title, description, section_id, status, pinned, tags } = request.body;
    const now = new Date().toISOString();

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?, slug = ?');
      params.push(title, slugify(title, { lower: true, strict: true }));
    }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (section_id !== undefined) { updates.push('section_id = ?'); params.push(section_id); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (pinned !== undefined) { updates.push('pinned = ?'); params.push(pinned); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }

    if (updates.length === 0) return reply.code(400).send({ error: 'No updates provided' });

    updates.push('updated_at = ?');
    params.push(now);

    const query = `UPDATE features SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    const result = db.prepare(query).run(...params);
    if (result.changes === 0) return reply.code(404).send({ error: 'Feature not found' });

    return { ok: true };
  });

  // 4. Admin: Delete feature (cascades to votes)
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const result = db.prepare('DELETE FROM features WHERE id = ?').run(id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Feature not found' });
    return { ok: true };
  });

}
