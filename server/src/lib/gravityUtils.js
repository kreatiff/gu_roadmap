import { featuresContainer } from '../db.js';

/**
 * Scoring Multipliers for Strategic Priority
 */
const PRIORITY_MULTIPLIER_MAP = {
  Low: 0.5,
  Medium: 1.0,
  High: 1.5,
  Critical: 2.0,
};

/**
 * Calculates the Gravity Score for a single feature.
 *
 * Formula:
 * votes_norm = (sqrt(vote_count) / sqrt(maxVotes)) * 5
 * raw_score  = (votes_norm * impact * priority_multiplier) / effort
 * gravity_score = ceil((raw_score / 50) * 100)   clamped to 100
 *
 * @param {Object} feature  - Feature document (vote_count, impact, effort, priority)
 * @param {number} maxVotes - Current maximum vote_count across all features
 * @returns {number}        - Gravity score 0–100
 */
export function calculateGravityScore(feature, maxVotes) {
  const votes = feature.vote_count || 0;
  const impact = feature.impact ?? 3;
  const effort = feature.effort > 0 ? feature.effort : 1;
  const multiplier = PRIORITY_MULTIPLIER_MAP[feature.priority] ?? 1.0;

  const votesNorm =
    maxVotes > 0 ? (Math.sqrt(votes) / Math.sqrt(maxVotes)) * 5 : 0;

  const rawScore = (votesNorm * impact * multiplier) / effort;
  const score = Math.ceil((rawScore / 50) * 100);
  return Math.min(score, 100);
}

/**
 * Recalculates gravity_score for every feature document in Cosmos DB.
 *
 * Reads all features, computes scores, then writes updated scores back in
 * parallel batches of 50 to avoid saturating RU throughput.
 *
 * Callers must await this function.
 */
export async function recalculateAllGravityScores() {
  try {
    // 1. Get the current max vote_count
    const { resources: maxResult } = await featuresContainer.items
      .query('SELECT VALUE MAX(c.vote_count) FROM c', {
        enableCrossPartitionQuery: true,
      })
      .fetchAll();

    const maxVotes = maxResult[0] ?? 0;

    // 2. Fetch all features (only the fields needed for scoring + id for the update)
    const { resources: features } = await featuresContainer.items
      .query(
        'SELECT c.id, c.vote_count, c.impact, c.effort, c.priority FROM c',
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    if (features.length === 0) return;

    const now = new Date().toISOString();

    // 3. Build update promises — point-read then patch each feature
    //    Chunk into batches of 50 to limit concurrent RU consumption.
    const BATCH_SIZE = 50;
    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      const batch = features.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((feature) => {
          const score = calculateGravityScore(feature, maxVotes);
          return featuresContainer
            .item(feature.id, feature.id)
            .patch([
              { op: 'set', path: '/gravity_score', value: score },
              { op: 'set', path: '/updated_at', value: now },
            ]);
        })
      );
    }
  } catch (error) {
    console.error('Error recalculating gravity scores:', error);
  }
}
