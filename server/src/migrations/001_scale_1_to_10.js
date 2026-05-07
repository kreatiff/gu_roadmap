import { featuresContainer } from '../db.js';
import { recalculateAllGravityScores } from '../lib/gravityUtils.js';

/**
 * One-time migration: scales impact and effort from the old 1-5 range
 * to the new 1-10 range by multiplying existing values by 2.
 *
 * Run this script once against the production Cosmos container BEFORE
 * deploying the updated gravity formula (which expects 1-10 inputs).
 *
 * Usage:
 *   node server/src/migrations/001_scale_1_to_10.js
 */

async function run() {
  try {
    const { resources: features } = await featuresContainer.items
      .query('SELECT c.id, c.impact, c.effort FROM c', {
        enableCrossPartitionQuery: true,
      })
      .fetchAll();

    if (features.length === 0) {
      console.log('No features found to migrate.');
      return;
    }

    const BATCH_SIZE = 50;
    let updatedCount = 0;

    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      const batch = features.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (feature) => {
          const currentImpact = feature.impact ?? 1;
          const currentEffort = feature.effort ?? 1;

          const newImpact = Math.min(currentImpact * 2, 10);
          const newEffort = Math.min(currentEffort * 2, 10);

          await featuresContainer.item(feature.id, feature.id).patch([
            { op: 'set', path: '/impact', value: newImpact },
            { op: 'set', path: '/effort', value: newEffort },
          ]);

          updatedCount++;
        })
      );
    }

    console.log(`Migrated ${updatedCount} features: impact/effort doubled.`);

    // Recalculate gravity scores with the new formula
    await recalculateAllGravityScores();
    console.log('Gravity scores recalculated.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
