import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../auth.js';

export default async function sectionRoutes(fastify, options) {

  // 1. Public: Get all sections for filtering/sidebar
  fastify.get('/', async (request, reply) => {
    return db.prepare('SELECT * FROM sections ORDER BY order_idx ASC').all();
  });

  // 2. Admin: Create section
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { name, description, color, order_idx = 0 } = request.body;
    if (!name) return reply.code(400).send({ error: 'Name is required' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO sections (id, name, description, color, order_idx)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description, color, order_idx);

    return { id, name };
  });

  // 3. Admin: Update section
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, color, order_idx } = request.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (order_idx !== undefined) { updates.push('order_idx = ?'); params.push(order_idx); }

    if (updates.length === 0) return reply.code(400).send({ error: 'No updates provided' });

    const query = `UPDATE sections SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    const result = db.prepare(query).run(...params);
    if (result.changes === 0) return reply.code(404).send({ error: 'Section not found' });

    return { ok: true };
  });

  // 4. Admin: Delete section (SET NULLs in features)
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const result = db.prepare('DELETE FROM sections WHERE id = ?').run(id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Section not found' });
    return { ok: true };
  });

}
