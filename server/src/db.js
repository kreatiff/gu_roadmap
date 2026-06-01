import { CosmosClient } from "@azure/cosmos";
import { config } from "./config.js";

// ── Client & Database ──────────────────────────────────────────────────────────

const client = new CosmosClient({
  endpoint: config.cosmos.endpoint,
  key: config.cosmos.key,
  connectionPolicy: {
    // Disable endpoint discovery so the SDK always uses the configured endpoint
    // directly. Without this, the emulator advertises its internal 127.0.0.1
    // address during the handshake, causing ECONNREFUSED when connecting from
    // a remote host (e.g. a homelab server).
    enableEndpointDiscovery: false,
  },
});

const database = client.database(config.cosmos.databaseId);

// ── Container References ───────────────────────────────────────────────────────
// Exported individually so routes import exactly what they need.

export const categoriesContainer = database.container("categories");
export const stagesContainer = database.container("stages");
export const featuresContainer = database.container("features");
export const votesContainer = database.container("votes");
export const revisionsContainer = database.container("feature_revisions");
export const dashboardsContainer = database.container("dashboards");
export const usersContainer = database.container("users");
export const auditLogContainer = database.container("audit_log");
export const metadataConfigsContainer = database.container("metadata_configs");
export const jiraDraftsContainer = database.container("jira_drafts");

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Creates the database and all containers if they don't already exist.
// Call `await initDb()` once during server startup (index.js) before routes run.

export async function initDb(logger = console) {
  const { database: db } = await client.databases.createIfNotExists({
    id: config.cosmos.databaseId,
    throughput: 900,
  });

  await Promise.all([
    // Partition by /id for point-reads on every entity
    db.containers.createIfNotExists({
      id: "categories",
      partitionKey: { paths: ["/id"] },
    }),

    db.containers.createIfNotExists({
      id: "stages",
      partitionKey: { paths: ["/id"] },
      // Enforce slug uniqueness at the container level
      uniqueKeyPolicy: { uniqueKeys: [{ paths: ["/slug"] }] },
    }),

    db.containers.createIfNotExists({
      id: "features",
      partitionKey: { paths: ["/id"] },
      // Enforce slug uniqueness at the container level
      uniqueKeyPolicy: { uniqueKeys: [{ paths: ["/slug"] }] },
    }),

    // Votes: partition by featureId so all votes for a feature are co-located
    // The synthetic id `${userId}::${featureId}` enforces one-vote-per-user-per-feature
    db.containers.createIfNotExists({
      id: "votes",
      partitionKey: { paths: ["/featureId"] },
    }),

    // Revisions: partition by featureId for efficient per-feature queries
    db.containers.createIfNotExists({
      id: "feature_revisions",
      partitionKey: { paths: ["/featureId"] },
    }),

    // Dashboards: partition by id, unique slug for public URLs
    db.containers.createIfNotExists({
      id: "dashboards",
      partitionKey: { paths: ["/id"] },
      uniqueKeyPolicy: { uniqueKeys: [{ paths: ["/slug"] }] },
    }),

    // Users: partition by email, unique keys on email and oauthSub
    db.containers.createIfNotExists({
      id: "users",
      partitionKey: { paths: ["/email"] },
      uniqueKeyPolicy: {
        uniqueKeys: [
          { paths: ["/email"] },
          { paths: ["/oauthSub"] },
        ],
      },
    }),

    // Audit logs: partition by action for query efficiency
    db.containers.createIfNotExists({
      id: "audit_log",
      partitionKey: { paths: ["/action"] },
    }),

    // Metadata configurations: partition by id for fast point lookups
    db.containers.createIfNotExists({
      id: "metadata_configs",
      partitionKey: { paths: ["/id"] },
    }),

    // Jira drafts: ephemeral draft state for the Push-to-Jira wizard,
    // partitioned by featureId so drafts can be fetched/deleted by feature
    db.containers.createIfNotExists({
      id: "jira_drafts",
      partitionKey: { paths: ["/featureId"] },
    }),
  ]);

  logger.info(
    `✅ Cosmos DB "${config.cosmos.databaseId}" ready — all containers initialised.`
  );
}
