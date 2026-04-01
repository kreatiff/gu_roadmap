import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/database.sqlite');

const db = new Database(DB_PATH);

// Enable WAL mode for high-concurrency reads/writes (many students voting simultaneously)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sections (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    color       TEXT DEFAULT '#e8341c',
    order_idx   INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS stages (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#64748b',
    order_idx   INTEGER DEFAULT 0,
    slug        TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS features (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT DEFAULT 'under_review'
                CHECK(status IN ('under_review', 'planned', 'in_progress', 'launched', 'declined')),
    section_id  TEXT REFERENCES sections(id) ON DELETE SET NULL,
    vote_count  INTEGER DEFAULT 0,
    impact      INTEGER DEFAULT 1,
    effort      INTEGER DEFAULT 1,
    tags        TEXT DEFAULT '[]',
    pinned      INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    user_id    TEXT NOT NULL,
    feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, feature_id)
  );
`);

// ── Lightweight Migrations ───────────────────────────────────────────────────
const addColumn = (col, type, def) => {
  try {
    db.prepare(`ALTER TABLE features ADD COLUMN ${col} ${type} DEFAULT ${def}`).run();
  } catch (e) {
    // Column likely already exists
  }
};

addColumn('impact', 'INTEGER', 1);
addColumn('effort', 'INTEGER', 1);
addColumn('owner', 'TEXT', '""');
addColumn('key_stakeholder', 'TEXT', '""');
addColumn('priority', 'TEXT', '"Medium"');
addColumn('stage_id', 'TEXT', 'NULL');

// ── Initial Migration: Seed Stages and Map Features ──────────────────────────
const seedStages = [
  { id: 'stg_1', name: 'Under Consideration', color: '#64748b', slug: 'under_review', order_idx: 0 },
  { id: 'stg_2', name: 'Planned', color: '#e8341c', slug: 'planned', order_idx: 1 },
  { id: 'stg_3', name: 'In Progress', color: '#ea580c', slug: 'in_progress', order_idx: 2 },
  { id: 'stg_4', name: 'Launched', color: '#059669', slug: 'launched', order_idx: 3 },
  { id: 'stg_5', name: 'Declined', color: '#94a3b8', slug: 'declined', order_idx: 4 }
];

try {
  const insertStage = db.prepare('INSERT OR IGNORE INTO stages (id, name, color, slug, order_idx) VALUES (?, ?, ?, ?, ?)');
  seedStages.forEach(s => insertStage.run(s.id, s.name, s.color, s.slug, s.order_idx));
  
  // Link existing features to stages based on their current status string
  db.prepare(`
    UPDATE features 
    SET stage_id = (SELECT id FROM stages WHERE slug = features.status)
    WHERE stage_id IS NULL
  `).run();
} catch (e) {
  console.error('Migration failed:', e);
}

export default db;
