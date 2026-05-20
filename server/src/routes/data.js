import { requireAdmin } from '../auth.js';
import { 
  categoriesContainer, 
  stagesContainer, 
  featuresContainer, 
  votesContainer, 
  revisionsContainer, 
  dashboardsContainer,
  usersContainer
} from '../db.js';

// Map of all containers we want to export/import
const containersMap = {
  categories: categoriesContainer,
  stages: stagesContainer,
  features: featuresContainer,
  votes: votesContainer,
  feature_revisions: revisionsContainer,
  dashboards: dashboardsContainer,
  users: usersContainer,
};

export default async function dataRoutes(fastify, options) {
  // ── GET /api/admin/data/export ────────────────────────────────────────────────
  // Exports all documents from all configured Cosmos DB containers
  fastify.get('/export', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const exportData = {};

      // Fetch all items from all containers
      for (const [key, container] of Object.entries(containersMap)) {
        const { resources } = await container.items.readAll().fetchAll();
        exportData[key] = resources;
      }

      // Send as a downloadable JSON file
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', 'attachment; filename="vle-roadmap-backup.json"');
      
      return exportData;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to export data' });
    }
  });

  // ── POST /api/admin/data/import ───────────────────────────────────────────────
  // Imports data from a JSON file. Requires multipart/form-data.
  fastify.post('/import', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Read file buffer
      const buffer = await data.toBuffer();
      const importData = JSON.parse(buffer.toString('utf8'));
      
      // Strategy: 'append' | 'upsert' | 'wipe'
      const strategy = data.fields.strategy ? data.fields.strategy.value : 'append';

      let stats = { imported: 0, skipped: 0, failed: 0 };

      // Process each container in the imported JSON
      for (const [key, items] of Object.entries(importData)) {
        const container = containersMap[key];
        
        // Skip if container doesn't exist in our map
        if (!container) continue;

        if (strategy === 'wipe') {
          // Truncating a container in Cosmos is complex (requires deleting by ID and PartitionKey)
          // For simplicity and safety, we will just fetch all and delete them one by one.
          const { resources: existingItems } = await container.items.readAll().fetchAll();
          for (const item of existingItems) {
            // Note: Our DB partitions are all based on specific fields (e.g., /id or /featureId)
            // We must provide the correct partition key to delete.
            // Since determining the partition key dynamically is tricky without hardcoding,
            // we will extract the partition key from the item based on known structures.
            let pk = item.id;
            if (key === 'votes' || key === 'feature_revisions') pk = item.featureId;
            else if (key === 'users') pk = item.email;
            
            await container.item(item.id, pk).delete().catch(() => {});
          }
        }

        // Import the items
        for (const item of items) {
          // Strip out Cosmos auto-generated system properties
          const { _rid, _self, _etag, _attachments, _ts, ...cleanItem } = item;

          try {
            if (strategy === 'append') {
              // Create will fail (409 Conflict) if the ID already exists
              await container.items.create(cleanItem);
              stats.imported++;
            } else {
              // Upsert overwrites existing items with matching ID
              await container.items.upsert(cleanItem);
              stats.imported++;
            }
          } catch (err) {
            if (err.code === 409 && strategy === 'append') {
              stats.skipped++;
            } else {
              stats.failed++;
              request.log.error(`Failed to import item ${cleanItem.id} into ${key}: ${err.message}`);
            }
          }
        }
      }

      return { success: true, message: 'Import completed', stats, strategy };

    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to process import', details: error.message });
    }
  });
}
