import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../auth.js';

export default async function categoryRoutes(fastify, options) {

  // 1. Public: Get all categories with feature count
  fastify.get('/', async (request, reply) => {
    const query = `
      SELECT *, (SELECT COUNT(*) FROM features WHERE category_id = categories.id) as feature_count 
      FROM categories 
      ORDER BY order_idx ASC
    `;
    return db.prepare(query).all();
  });

  // 2. Admin: Create category
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { name, description, color, icon, order_idx = 0 } = request.body;
    if (!name) return reply.code(400).send({ error: 'Name is required' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, name, description, color, icon, order_idx)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, description || '', color || '#64748b', icon || 'briefcase', order_idx);

    return { id, name };
  });

  // 3. Admin: Update category
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, color, icon, order_idx } = request.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
    if (order_idx !== undefined) { updates.push('order_idx = ?'); params.push(order_idx); }

    if (updates.length === 0) return reply.code(400).send({ error: 'No updates provided' });

    const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    const result = db.prepare(query).run(...params);
    if (result.changes === 0) return reply.code(404).send({ error: 'Category not found' });

    return { ok: true };
  });

  // 4. Admin: Reorder categories (Bulk)
  fastify.post('/reorder', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { ids } = request.body; // Array of category IDs in order
    if (!Array.isArray(ids)) return reply.code(400).send({ error: 'IDs array required' });

    const transaction = db.transaction((idList) => {
      for (let i = 0; i < idList.length; i++) {
        db.prepare('UPDATE categories SET order_idx = ? WHERE id = ?').run(i, idList[i]);
      }
    });

    transaction(ids);
    return { ok: true };
  });

  // 5. Admin: Delete category (Optional migration)
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { reassignTo } = request.body || {};

    const transaction = db.transaction(() => {
      // 1. Count features in this category
      const count = db.prepare('SELECT COUNT(*) as cnt FROM features WHERE category_id = ?').get(id).cnt;
      
      if (count > 0) {
        if (!reassignTo) {
          throw new Error('REASSIGN_REQUIRED'); // Features exist, need to reassign
        }
        // 2. Reassign features to the target category
        db.prepare('UPDATE features SET category_id = ? WHERE category_id = ?').run(reassignTo, id);
      }

      // 3. Finally delete the category
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    });

    try {
      transaction();
      return { ok: true };
    } catch (err) {
      if (err.message === 'REASSIGN_REQUIRED') return reply.code(409).send({ error: 'REASSIGN_REQUIRED' });
      throw err;
    }
  });

}
