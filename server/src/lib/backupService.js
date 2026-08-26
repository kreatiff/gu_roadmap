import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cron from 'node-cron';
import {
  categoriesContainer,
  stagesContainer,
  featuresContainer,
  votesContainer,
  revisionsContainer,
  dashboardsContainer,
  usersContainer,
  featureNotesContainer,
} from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const BACKUP_DIR = path.join(__dirname, '../../data/backups');
const MAX_BACKUPS = 10;

// Matches: backup-2026-06-11T13-00-00-manual.json or -scheduled.json
const BACKUP_FILENAME_RE = /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(?:manual|scheduled)\.json$/;
const BACKUP_PARTS_RE = /^backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-(manual|scheduled)\.json$/;

const containersMap = {
  categories: categoriesContainer,
  stages: stagesContainer,
  features: featuresContainer,
  votes: votesContainer,
  feature_revisions: revisionsContainer,
  feature_notes: featureNotesContainer,
  dashboards: dashboardsContainer,
  users: usersContainer,
};

// Partition key for each container (mirrors db.js setup)
function getPartitionKey(containerKey, item) {
  if (containerKey === 'votes' || containerKey === 'feature_revisions' || containerKey === 'feature_notes') return item.featureId;
  if (containerKey === 'users') return item.email;
  return item.id;
}

export async function gatherExportData() {
  const exportData = {};
  for (const [key, container] of Object.entries(containersMap)) {
    const { resources } = await container.items.readAll().fetchAll();
    if (key === 'users') {
      exportData[key] = resources.map(({ passwordHash, ...safe }) => safe);
    } else {
      exportData[key] = resources;
    }
  }
  return exportData;
}

export async function runBackup(trigger = 'scheduled') {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const iso = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `backup-${iso}-${trigger}.json`;
  const filePath = path.join(BACKUP_DIR, filename);
  const data = await gatherExportData();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  pruneBackups();
  return { filename, filePath };
}

export function pruneBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => BACKUP_FILENAME_RE.test(f))
    .sort()
    .reverse();
  for (const f of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
  }
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => BACKUP_FILENAME_RE.test(f))
    .sort()
    .reverse();
  return files.map((filename) => {
    const stat = fs.statSync(path.join(BACKUP_DIR, filename));
    const match = filename.match(BACKUP_PARTS_RE);
    const trigger = match ? match[2] : 'unknown';
    // "2026-06-11T13-00-00" → "2026-06-11T13:00:00Z"
    const createdAt = match
      ? match[1].replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3') + 'Z'
      : null;
    return { filename, createdAt, sizeBytes: stat.size, trigger };
  });
}

export async function restoreFromBackup(filename) {
  if (!isValidBackupFilename(filename)) throw new Error('Invalid backup filename');
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error('Backup file not found');

  const importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const stats = { imported: 0, failed: 0 };
  const wipeFailures = [];

  for (const [key, items] of Object.entries(importData)) {
    const container = containersMap[key];
    if (!container) continue;

    // Wipe existing records
    const { resources: existing } = await container.items.readAll().fetchAll();
    for (const item of existing) {
      try {
        await container.item(item.id, getPartitionKey(key, item)).delete();
      } catch (err) {
        wipeFailures.push({ container: key, id: item.id, error: err.message });
      }
    }

    // Import backup records
    for (const item of items) {
      const { _rid, _self, _etag, _attachments, _ts, ...cleanItem } = item;
      try {
        await container.items.create(cleanItem);
        stats.imported++;
      } catch (err) {
        stats.failed++;
      }
    }
  }

  return { stats, wipeFailures };
}

export function isValidBackupFilename(filename) {
  return BACKUP_FILENAME_RE.test(filename);
}

export function scheduleBackups(log) {
  const opts = { timezone: 'Australia/Brisbane' };

  cron.schedule('0 13 * * 1-5', async () => {
    try {
      log.info('Running scheduled backup (1 PM AEST)');
      const { filename } = await runBackup('scheduled');
      log.info(`Scheduled backup saved: ${filename}`);
    } catch (err) {
      log.error({ err }, 'Scheduled backup failed (1 PM AEST)');
    }
  }, opts);

  cron.schedule('0 19 * * 1-5', async () => {
    try {
      log.info('Running scheduled backup (7 PM AEST)');
      const { filename } = await runBackup('scheduled');
      log.info(`Scheduled backup saved: ${filename}`);
    } catch (err) {
      log.error({ err }, 'Scheduled backup failed (7 PM AEST)');
    }
  }, opts);

  log.info('Backup scheduler started — runs Mon–Fri at 1 PM and 7 PM AEST');
}
