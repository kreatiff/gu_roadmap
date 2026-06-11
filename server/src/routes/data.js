import fs from 'fs';
import path from 'path';
import { requireSuperAdmin } from '../auth.js';
import { auditLog } from '../lib/auditLog.js';
import {
  runBackup,
  listBackups,
  restoreFromBackup,
  isValidBackupFilename,
  BACKUP_DIR,
} from '../lib/backupService.js';
import {
  categoriesContainer,
  stagesContainer,
  featuresContainer,
  votesContainer,
  revisionsContainer,
  dashboardsContainer,
  usersContainer,
} from '../db.js';

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
  // Saves a manual backup to disk and streams it to the browser as a download.
  fastify.get('/export', { preHandler: requireSuperAdmin }, async (request, reply) => {
    try {
      const { filename, filePath } = await runBackup('manual');

      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      await auditLog(fastify, { actor: request.user.sub, action: 'data.export', outcome: 'success' });
      return reply.send(fs.createReadStream(filePath));
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to export data' });
    }
  });

  // ── GET /api/admin/data/backups ───────────────────────────────────────────────
  // Returns metadata for all saved backups, newest first.
  fastify.get('/backups', { preHandler: requireSuperAdmin }, async (request, reply) => {
    try {
      return listBackups();
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to list backups' });
    }
  });

  // ── GET /api/admin/data/backups/:filename ─────────────────────────────────────
  // Streams a specific backup file as a download.
  fastify.get('/backups/:filename', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { filename } = request.params;
    if (!isValidBackupFilename(filename)) {
      return reply.code(400).send({ error: 'Invalid backup filename' });
    }
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Backup not found' });
    }
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(fs.createReadStream(filePath));
  });

  // ── DELETE /api/admin/data/backups/:filename ──────────────────────────────────
  // Deletes a specific backup file.
  fastify.delete('/backups/:filename', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { filename } = request.params;
    if (!isValidBackupFilename(filename)) {
      return reply.code(400).send({ error: 'Invalid backup filename' });
    }
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Backup not found' });
    }
    fs.unlinkSync(filePath);
    await auditLog(fastify, { actor: request.user.sub, action: 'data.backup.delete', outcome: 'success', metadata: { filename } });
    return { success: true };
  });

  // ── POST /api/admin/data/backups/:filename/restore ───────────────────────────
  // Wipes the database and restores it from a saved backup file.
  fastify.post('/backups/:filename/restore', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { filename } = request.params;
    if (!isValidBackupFilename(filename)) {
      return reply.code(400).send({ error: 'Invalid backup filename' });
    }
    try {
      const { stats, wipeFailures } = await restoreFromBackup(filename);
      await auditLog(fastify, { actor: request.user.sub, action: 'data.restore', outcome: 'success', metadata: { filename, stats } });
      return {
        success: true,
        message: 'Restore completed',
        stats,
        wipeFailures: wipeFailures.length > 0 ? wipeFailures : undefined,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to restore backup', details: error.message });
    }
  });

  // ── POST /api/admin/data/import ───────────────────────────────────────────────
  // Imports data from a JSON file. Requires multipart/form-data.
  fastify.post('/import', { preHandler: requireSuperAdmin }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      if (data.mimetype !== 'application/json') {
        return reply.code(400).send({ error: 'File must be application/json' });
      }

      if (data.file.truncated) {
        return reply.code(413).send({ error: 'File too large. Max 10MB.' });
      }

      // Read file buffer
      const buffer = await data.toBuffer();
      let importData;
      try {
        importData = JSON.parse(buffer.toString('utf8'));
      } catch (err) {
        return reply.code(400).send({ error: 'Invalid JSON file', details: err.message });
      }

      // Strategy: 'append' | 'upsert' | 'wipe'
      const strategy = data.fields.strategy ? data.fields.strategy.value : 'append';
      const ALLOWED_STRATEGIES = ['append', 'upsert', 'wipe'];
      if (!ALLOWED_STRATEGIES.includes(strategy)) {
        return reply.code(400).send({ error: `Invalid strategy: ${strategy}. Must be one of: ${ALLOWED_STRATEGIES.join(', ')}` });
      }

      let stats = { imported: 0, skipped: 0, failed: 0 };
      const wipeFailures = [];

      // Process each container in the imported JSON
      for (const [key, items] of Object.entries(importData)) {
        const container = containersMap[key];

        // Skip if container doesn't exist in our map
        if (!container) continue;

        if (strategy === 'wipe') {
          const { resources: existingItems } = await container.items.readAll().fetchAll();
          for (const item of existingItems) {
            let pk = item.id;
            if (key === 'votes' || key === 'feature_revisions') pk = item.featureId;
            else if (key === 'users') pk = item.email;

            try {
              await container.item(item.id, pk).delete();
            } catch (err) {
              wipeFailures.push({ container: key, id: item.id, error: err.message });
              request.log.error(`Failed to delete ${key} item ${item.id}: ${err.message}`);
            }
          }
        }

        // Import the items
        for (const item of items) {
          // Strip out Cosmos auto-generated system properties
          const { _rid, _self, _etag, _attachments, _ts, ...cleanItem } = item;

          try {
            if (strategy === 'append') {
              await container.items.create(cleanItem);
              stats.imported++;
            } else {
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

      await auditLog(fastify, { actor: request.user.sub, action: 'data.import', outcome: 'success', metadata: { strategy, stats } });
      return { success: true, message: 'Import completed', stats, strategy, wipeFailures: wipeFailures.length > 0 ? wipeFailures : undefined };

    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to process import', details: error.message });
    }
  });
}
