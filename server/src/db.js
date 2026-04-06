import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { recalculateAllGravityScores } from './lib/gravityUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/database.sqlite');

const db = new Database(DB_PATH);

// Enable WAL mode for high-concurrency reads/writes (many students voting simultaneously)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Migration: Renames before Schema ───────────────────────────────────────────
// This ensures that existing data is preserved before CREATE TABLE IF NOT EXISTS runs.
try {
  const tableExists = (name) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const columnExists = (table, col) => {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      return info.some(c => c.name === col);
    } catch (e) { return false; }
  };

  // 1. Rename sections table to categories
  if (tableExists('sections')) {
    if (!tableExists('categories')) {
      db.exec("ALTER TABLE sections RENAME TO categories");
      console.log('Renamed table sections to categories');
    } else {
      // Both exist (likely due to a previous partially failed migration)
      db.exec(`
        INSERT OR IGNORE INTO categories (id, name, description, color, order_idx)
        SELECT id, name, description, color, order_idx FROM sections
      `);
      db.exec("DROP TABLE sections");
      console.log('Merged data from sections to categories and dropped sections');
    }
  }

  // 2. Rename section_id column to category_id in features
  if (tableExists('features') && columnExists('features', 'section_id')) {
    db.exec("ALTER TABLE features RENAME COLUMN section_id TO category_id");
    console.log('Renamed features.section_id to category_id');
  }

  // 3. Fix foreign key if it points to legacy 'sections'
  if (tableExists('features')) {
    const fkInfo = db.prepare("PRAGMA foreign_key_list(features)").all();
    const needsFkFix = fkInfo.some(fk => fk.table === 'sections' && fk.from === 'category_id');
    
    if (needsFkFix) {
      console.log('Migrating features table to fix legacy foreign key (sections -> categories)...');
      
      // Disable foreign keys temporarily for this schema change
      db.pragma('foreign_keys = OFF');
      
      try {
        db.transaction(() => {
          // Create matching features_new table with correct reference
          db.exec(`
            CREATE TABLE features_new (
              id              TEXT PRIMARY KEY,
              title           TEXT NOT NULL,
              slug            TEXT UNIQUE NOT NULL,
              description     TEXT DEFAULT '',
              status          TEXT DEFAULT 'under_review',
              category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
              vote_count      INTEGER DEFAULT 0,
              impact          INTEGER DEFAULT 1,
              effort          INTEGER DEFAULT 1,
              tags            TEXT DEFAULT '[]',
              pinned          INTEGER DEFAULT 0,
              owner           TEXT DEFAULT "",
              key_stakeholder TEXT DEFAULT "",
              priority        TEXT DEFAULT "Medium",
              stage_id        TEXT DEFAULT NULL,
              gravity_score   REAL DEFAULT 0,
              created_at      TEXT NOT NULL,
              updated_at      TEXT NOT NULL
            )
          `);
          
          // Copy data
          db.exec(`
            INSERT INTO features_new (
              id, title, slug, description, status, category_id, vote_count, 
              impact, effort, tags, pinned, owner, key_stakeholder, 
              priority, stage_id, gravity_score, created_at, updated_at
            ) 
            SELECT 
              id, title, slug, description, status, category_id, vote_count, 
              impact, effort, tags, pinned, owner, key_stakeholder, 
              priority, stage_id, gravity_score, created_at, updated_at 
            FROM features
          `);
          
          // Drop old and rename
          db.exec("DROP TABLE features");
          db.exec("ALTER TABLE features_new RENAME TO features");
        })();
        console.log('Successfully fixed features foreign key.');
      } finally {
        db.pragma('foreign_keys = ON');
      }
    }
  }
} catch (e) {
  console.error('Initial Rename Migration Error:', e);
}

// ── Schema ──────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
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
    slug        TEXT UNIQUE NOT NULL,
    is_visible  INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS features (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT DEFAULT 'under_review'
                CHECK(status IN ('under_review', 'planned', 'in_progress', 'launched', 'declined')),
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
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

  CREATE TABLE IF NOT EXISTS feature_revisions (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    changed_by TEXT,
    changed_at TEXT NOT NULL,
    changes TEXT NOT NULL
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
addColumn('gravity_score', 'REAL', 0);
addColumn('is_published', 'INTEGER', 1);

// Migration for stages table
const addColumnToStages = (col, type, def) => {
  try {
    db.prepare(`ALTER TABLE stages ADD COLUMN ${col} ${type} DEFAULT ${def}`).run();
  } catch (e) {}
};
addColumnToStages('is_visible', 'INTEGER', 1);
// Migration for categories table
const addColumnToCategories = (col, type, def) => {
  try {
    db.prepare(`ALTER TABLE categories ADD COLUMN ${col} ${type} DEFAULT ${def}`).run();
  } catch (e) {}
};
addColumnToCategories('icon', 'TEXT', "'briefcase'");

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

  // Initial backfill of gravity scores
  recalculateAllGravityScores(db);
} catch (e) {
  console.error('Migration failed:', e);
}

export default db;
