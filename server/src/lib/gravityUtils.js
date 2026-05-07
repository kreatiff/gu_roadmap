import { featuresContainer } from '../db.js';

/**
 * Maps textual priority to a numeric score.
 */
const PRIORITY_SCORES = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

/**
 * Calculates the Gravity Score for a single feature.
 *
 * Formula (vote-free, hierarchical):
 *   impactPart   = (impact / 10) * 60   // up to 60 pts
 *   priorityPart = (priority / 4) * 25  // up to 25 pts
 *   effortPart   = ((11 - effort) / 10) * 15  // up to 15 pts (inverse)
 *   gravity_score = ceil(impactPart + priorityPart + effortPart) clamped to 100
 *
 * Hierarchy: Impact (#1) > Priority (#2) > Effort (#3)
 *
 * @param {Object} feature - Feature document (impact, effort, priority)
 * @returns {number} - Gravity score 0–100
 */
export function calculateGravityScore(feature) {
  const impact = Math.max(1, Math.min(10, feature.impact ?? 5));
  const effort = Math.max(1, Math.min(10, feature.effort > 0 ? feature.effort : 1));
  const priority = PRIORITY_SCORES[feature.priority] ?? 2;

  const impactPart = (impact / 10) * 60;
  const priorityPart = (priority / 4) * 25;
  const effortPart = ((11 - effort) / 10) * 15;

  const score = Math.ceil(impactPart + priorityPart + effortPart);
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
    // 1. Fetch all features (only the fields needed for scoring + id for the update)
    const { resources: features } = await featuresContainer.items
      .query(
        'SELECT c.id, c.impact, c.effort, c.priority FROM c',
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    if (features.length === 0) return;

    const now = new Date().toISOString();

    // 2. Build update promises — point-read then patch each feature
    //    Chunk into batches of 50 to limit concurrent RU consumption.
    const BATCH_SIZE = 50;
    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      const batch = features.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((feature) => {
          const score = calculateGravityScore(feature);
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
