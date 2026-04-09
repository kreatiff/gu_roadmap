import { votesContainer, featuresContainer } from '../db.js';
import { authenticate } from '../auth.js';
import { recalculateAllGravityScores } from '../lib/gravityUtils.js';

export default async function voteRoutes(fastify, options) {

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Builds the synthetic composite vote id that enforces one-vote-per-user.
   * The votes container partitions by /featureId so the partition key is featureId.
   */
  const voteId = (userId, featureId) => `${userId}::${featureId}`;

  /**
   * Atomically increment (delta = +1) or decrement (delta = -1) vote_count on a
   * feature using the Cosmos Patch API.  This avoids a read-modify-replace cycle
   * and eliminates the race condition that existed with the SQLite approach.
   */
  async function patchVoteCount(featureId, delta) {
    await featuresContainer.item(featureId, featureId).patch([
      { op: 'incr', path: '/vote_count', value: delta },
    ]);
  }

  // ── POST /:id/vote — Cast a vote ─────────────────────────────────────────────
  fastify.post('/:id/vote', { preHandler: [authenticate] }, async (request, reply) => {
    const featureId = request.params.id;
    const userId = request.user.sub;

    // Create the vote document.  The synthetic id guarantees uniqueness —
    // Cosmos returns 409 Conflict if the same id already exists in the partition.
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

    // Atomically increment vote_count on the feature document.
    try {
      await patchVoteCount(featureId, 1);
    } catch (err) {
      // The vote row exists but the count patch failed — attempt a rollback so
      // the state stays consistent.  This edge case should be extremely rare.
      console.error('Vote count increment failed, rolling back vote document:', err);
      await votesContainer.item(voteId(userId, featureId), featureId).delete().catch(() => {});
      throw err;
    }

    await recalculateAllGravityScores();
    return { ok: true };
  });

  // ── DELETE /:id/vote — Remove a vote ─────────────────────────────────────────
  fastify.delete('/:id/vote', { preHandler: [authenticate] }, async (request, reply) => {
    const featureId = request.params.id;
    const userId = request.user.sub;

    // Delete the vote document; 404 means the user never voted.
    try {
      await votesContainer.item(voteId(userId, featureId), featureId).delete();
    } catch (err) {
      if (err.code === 404) {
        return reply.code(404).send({ error: 'Vote not found or already removed' });
      }
      throw err;
    }

    // Atomically decrement vote_count.
    await patchVoteCount(featureId, -1);

    await recalculateAllGravityScores();
    return { ok: true };
  });

}
