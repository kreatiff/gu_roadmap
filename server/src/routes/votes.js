import db from '../db.js';
import { authenticate } from '../auth.js';
import { recalculateAllGravityScores } from '../lib/gravityUtils.js';

export default async function voteRoutes(fastify, options) {

  // 1. Transactional vote logic (Atomic)
  const castVoteTx = db.transaction((userId, featureId) => {
    // Insert into votes (Unique constraint prevents double voting)
    db.prepare('INSERT INTO votes (user_id, feature_id) VALUES (?, ?)').run(userId, featureId);
    // Increment feature vote count
    db.prepare('UPDATE features SET vote_count = vote_count + 1 WHERE id = ?').run(featureId);
  });

  const removeVoteTx = db.transaction((userId, featureId) => {
    // Delete from votes
    const result = db.prepare('DELETE FROM votes WHERE user_id = ? AND feature_id = ?').run(userId, featureId);
    // Only decrement if a vote was actually deleted
    if (result.changes > 0) {
      db.prepare('UPDATE features SET vote_count = vote_count - 1 WHERE id = ?').run(featureId);
      return true;
    }
    return false;
  });

  // 2. POST /:id/vote — Cast a vote
  fastify.post('/:id/vote', { preHandler: [authenticate] }, async (request, reply) => {
    const { id: featureId } = request.params;
    const { sub: userId } = request.user;

    castVoteTx(userId, featureId);
    recalculateAllGravityScores(db);
    return { ok: true };
  });

  // 3. DELETE /:id/vote — Remove a vote
  fastify.delete('/:id/vote', { preHandler: [authenticate] }, async (request, reply) => {
    const { id: featureId } = request.params;
    const { sub: userId } = request.user;

    const removed = removeVoteTx(userId, featureId);
    if (!removed) {
      return reply.code(404).send({ error: 'Vote not found or already removed' });
    }

    recalculateAllGravityScores(db);
    return { ok: true };
  });

}
