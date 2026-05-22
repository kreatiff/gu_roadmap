import { featuresContainer } from '../db.js';

/**
 * One-time migration: adds an empty internal_notes field to all existing
 * feature documents that don't already have one.
 *
 * Usage:
 *   node server/src/migrations/002_add_internal_notes.js
 */

async function run() {
  try {
    const { resources: features } = await featuresContainer.items
      .query('SELECT c.id FROM c', {
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
          try {
            await featuresContainer.item(feature.id, feature.id).patch([
              { op: 'add', path: '/internal_notes', value: '' },
            ]);
            updatedCount++;
          } catch (err) {
            if (err.code === 409) {
              console.log(`Skipping ${feature.id}: internal_notes already exists`);
            } else {
              console.error(`Failed to patch ${feature.id}:`, err.message);
            }
          }
        })
      );
    }

    console.log(`Migrated ${updatedCount} features: added internal_notes field.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
