import { featuresContainer, stagesContainer } from '../db.js';

/**
 * One-time migration: adds the rejection-reason fields to all existing feature
 * documents, and the is_rejection_stage flag to all existing stage documents,
 * for any that don't already have them.
 *
 * Usage:
 *   node server/src/migrations/004_add_rejection_reason.js
 */

async function migrateFeatures() {
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
            { op: 'add', path: '/rejection_reason', value: '' },
            { op: 'add', path: '/rejection_reason_public', value: false },
            { op: 'add', path: '/rejection_reason_at', value: null },
            { op: 'add', path: '/rejection_reason_by', value: null },
          ]);
          updatedCount++;
        } catch (err) {
          if (err.code === 409) {
            console.log(`Skipping feature ${feature.id}: rejection fields already exist`);
          } else {
            console.error(`Failed to patch feature ${feature.id}:`, err.message);
          }
        }
      })
    );
  }

  console.log(`Migrated ${updatedCount} features: added rejection_reason fields.`);
}

async function migrateStages() {
  const { resources: stages } = await stagesContainer.items
    .query('SELECT c.id FROM c', {
      enableCrossPartitionQuery: true,
    })
    .fetchAll();

  if (stages.length === 0) {
    console.log('No stages found to migrate.');
    return;
  }

  let updatedCount = 0;
  await Promise.all(
    stages.map(async (stage) => {
      try {
        await stagesContainer.item(stage.id, stage.id).patch([
          { op: 'add', path: '/is_rejection_stage', value: false },
        ]);
        updatedCount++;
      } catch (err) {
        if (err.code === 409) {
          console.log(`Skipping stage ${stage.id}: is_rejection_stage already exists`);
        } else {
          console.error(`Failed to patch stage ${stage.id}:`, err.message);
        }
      }
    })
  );

  console.log(`Migrated ${updatedCount} stages: added is_rejection_stage field.`);
}

async function run() {
  try {
    await migrateFeatures();
    await migrateStages();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
