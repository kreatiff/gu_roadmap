import { CosmosClient } from '@azure/cosmos';
import { config } from './config.js';

// ── Client & Database ──────────────────────────────────────────────────────────

const client = new CosmosClient({
  endpoint: config.cosmos.endpoint,
  key: config.cosmos.key,
});

const database = client.database(config.cosmos.databaseId);

// ── Container References ───────────────────────────────────────────────────────
// Exported individually so routes import exactly what they need.

export const categoriesContainer = database.container('categories');
export const stagesContainer     = database.container('stages');
export const featuresContainer   = database.container('features');
export const votesContainer      = database.container('votes');
export const revisionsContainer  = database.container('feature_revisions');

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Creates the database and all containers if they don't already exist.
// Call `await initDb()` once during server startup (index.js) before routes run.

export async function initDb() {
  const { database: db } = await client.databases.createIfNotExists({
    id: config.cosmos.databaseId,
  });

  await Promise.all([
    // Partition by /id for point-reads on every entity
    db.containers.createIfNotExists({
      id: 'categories',
      partitionKey: { paths: ['/id'] },
    }),

    db.containers.createIfNotExists({
      id: 'stages',
      partitionKey: { paths: ['/id'] },
      // Enforce slug uniqueness at the container level
      uniqueKeyPolicy: { uniqueKeys: [{ paths: ['/slug'] }] },
    }),

    db.containers.createIfNotExists({
      id: 'features',
      partitionKey: { paths: ['/id'] },
      // Enforce slug uniqueness at the container level
      uniqueKeyPolicy: { uniqueKeys: [{ paths: ['/slug'] }] },
    }),

    // Votes: partition by featureId so all votes for a feature are co-located
    // The synthetic id `${userId}::${featureId}` enforces one-vote-per-user-per-feature
    db.containers.createIfNotExists({
      id: 'votes',
      partitionKey: { paths: ['/featureId'] },
    }),

    // Revisions: partition by featureId for efficient per-feature queries
    db.containers.createIfNotExists({
      id: 'feature_revisions',
      partitionKey: { paths: ['/featureId'] },
    }),
  ]);

  console.log(`✅ Cosmos DB "${config.cosmos.databaseId}" ready — all containers initialised.`);
}
