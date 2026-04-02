import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { requireAdmin } from '../auth.js';

export default async function stageRoutes(fastify, options) {

  // 1. Public: Get all stages with feature count
  fastify.get('/', async (request, reply) => {
    const query = `
      SELECT *, (SELECT COUNT(*) FROM features WHERE stage_id = stages.id) as feature_count 
      FROM stages 
      ORDER BY order_idx ASC
    `;
    return db.prepare(query).all();
  });

  // 2. Admin: Create stage
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { name, color, order_idx, is_visible } = request.body;
    if (!name) return reply.code(400).send({ error: 'Name is required' });

    const id = uuidv4();
    const slug = slugify(name, { lower: true, strict: true });
    
    // Auto-calculate order_idx if not provided
    let finalOrder = order_idx;
    if (finalOrder === undefined) {
      const maxOrder = db.prepare('SELECT MAX(order_idx) as max_idx FROM stages').get();
      finalOrder = (maxOrder.max_idx || 0) + 1;
    }

    db.prepare(`
      INSERT INTO stages (id, name, color, slug, order_idx, is_visible)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, color || '#64748b', slug, finalOrder, is_visible !== undefined ? is_visible : 1);

    return { id, name, slug };
  });

  // 3. Admin: Update stage
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { name, color, order_idx, is_visible } = request.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { 
      updates.push('name = ?'); params.push(name); 
    }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (order_idx !== undefined) { updates.push('order_idx = ?'); params.push(order_idx); }
    if (is_visible !== undefined) { updates.push('is_visible = ?'); params.push(is_visible); }

    if (updates.length === 0) return reply.code(400).send({ error: 'No updates provided' });

    const query = `UPDATE stages SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    const result = db.prepare(query).run(...params);
    if (result.changes === 0) return reply.code(404).send({ error: 'Stage not found' });

    return { ok: true };
  });

  // 4. Admin: Delete stage (Safety check for features)
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { reassignTo } = request.body || {};

    // Check if any features use this stage
    const countResult = db.prepare('SELECT COUNT(*) as count FROM features WHERE stage_id = ?').get(id);
    const featureCount = countResult.count;

    if (featureCount > 0 && !reassignTo) {
      return reply.code(409).send({ 
        error: 'CONFLICT_REASSIGN_REQUIRED', 
        message: `This stage has ${featureCount} features. Please choose a target stage to move them to.`,
        count: featureCount
      });
    }

    // Perform migration if reassignTo is provided
    if (featureCount > 0 && reassignTo) {
      db.prepare('UPDATE features SET stage_id = ? WHERE stage_id = ?').run(reassignTo, id);
    }

    const result = db.prepare('DELETE FROM stages WHERE id = ?').run(id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Stage not found' });
    
    return { ok: true };
  });

  // 5. Admin: Reorder stages (Batch update)
  fastify.post('/reorder', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { stageIds } = request.body; // Array of IDs in the desired order
    if (!Array.isArray(stageIds)) return reply.code(400).send({ error: 'Array of stageIds required' });

    const update = db.prepare('UPDATE stages SET order_idx = ? WHERE id = ?');
    
    // Use a transaction for batch update
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => {
        update.run(index, id);
      });
    });

    transaction(stageIds);
    return { ok: true };
  });

}
