import { v5 as uuidv5 } from 'uuid';
import { featuresContainer, featureNotesContainer } from '../db.js';

/**
 * One-time migration: converts each feature's internal_notes field into the
 * first entry of its feature_notes log, then removes internal_notes.
 *
 * Idempotent — entry ids are deterministic (uuidv5 of the featureId), so
 * re-running this script cannot create duplicate log entries.
 *
 * Usage:
 *   node server/src/migrations/004_internal_notes_to_log.js
 */

const MIGRATION_NAMESPACE = '3f1a2b3c-4d5e-4f60-8a9b-1c2d3e4f5061';

async function run() {
  try {
    const { resources: features } = await featuresContainer.items
      .query('SELECT c.id, c.internal_notes, c.updated_at, c.created_at FROM c', {
        enableCrossPartitionQuery: true,
      })
      .fetchAll();

    const toMigrate = features.filter(
      (f) => typeof f.internal_notes === 'string' && f.internal_notes.trim().length > 0
    );
    const whitespaceOnly = features.filter(
      (f) => typeof f.internal_notes === 'string' && f.internal_notes.length > 0 && f.internal_notes.trim().length === 0
    );
    const toRemove = features.filter((f) => 'internal_notes' in f);

    if (toMigrate.length === 0) {
      console.log('No features with internal_notes found to migrate.');
    }
    if (whitespaceOnly.length > 0) {
      console.log(`${whitespaceOnly.length} feature(s) had whitespace-only internal_notes — discarded without creating a log entry: ${whitespaceOnly.map(f => f.id).join(', ')}`);
    }

    let migratedCount = 0;
    for (const feature of toMigrate) {
      const entryId = uuidv5(feature.id, MIGRATION_NAMESPACE);
      try {
        await featureNotesContainer.items.create({
          id: entryId,
          featureId: feature.id,
          content: feature.internal_notes,
          authorId: 'system:migration',
          authorName: 'Legacy note',
          authorEmail: null,
          createdAt: feature.updated_at || feature.created_at || new Date().toISOString(),
          updatedAt: null,
          edited: false,
        });
        migratedCount++;
      } catch (err) {
        if (err.code === 409) {
          console.log(`Skipping ${feature.id}: legacy note entry already migrated`);
        } else {
          console.error(`Failed to create legacy note for ${feature.id}:`, err.message);
          throw err;
        }
      }
    }

    // Remove internal_notes from every feature that still has the field (derived from the
    // features already fetched above — no second Cosmos query needed)
    let removedCount = 0;
    for (const feature of toRemove) {
      try {
        await featuresContainer.item(feature.id, feature.id).patch([
          { op: 'remove', path: '/internal_notes' },
        ]);
        removedCount++;
      } catch (err) {
        console.error(`Failed to remove internal_notes from ${feature.id}:`, err.message);
      }
    }

    console.log(`Migrated ${migratedCount} legacy notes. Removed internal_notes field from ${removedCount} of ${toRemove.length} features.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
