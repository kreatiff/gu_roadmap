import { featuresContainer } from '../db.js';
import { calculateGravityScore } from '../../../shared/lib/gravityScore.js';

export { calculateGravityScore };

/**
 * Recalculates gravity_score for every feature document in Cosmos DB.
 *
 * Reads all features, computes scores, then writes updated scores back in
 * parallel batches of 50 to avoid saturating RU throughput.
 *
 * Callers must await this function.
 */
export async function recalculateAllGravityScores(logger = console) {
  try {
    // 1. Fetch all features (only the fields needed for scoring + id for the update)
    const { resources: features } = await featuresContainer.items
      .query(
        'SELECT c.id, c.impact, c.effort, c.priority FROM c',
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    if (features.length === 0) return;

    // 2. Build update promises — point-read then patch each feature
    //    Chunk into batches of 50 to limit concurrent RU consumption.
    const BATCH_SIZE = 50;
    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      const batch = features.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((feature) => {
          const score = calculateGravityScore(feature.impact, feature.effort, feature.priority);
          return featuresContainer
            .item(feature.id, feature.id)
            .patch([
              { op: 'set', path: '/gravity_score', value: score },
            ]);
        })
      );
    }
  } catch (error) {
    logger.error('Error recalculating gravity scores:', error);
  }
}
