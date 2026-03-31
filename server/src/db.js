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

  CREATE TABLE IF NOT EXISTS features (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT DEFAULT 'under_review'
                CHECK(status IN ('under_review', 'planned', 'in_progress', 'launched', 'declined')),
    section_id  TEXT REFERENCES sections(id) ON DELETE SET NULL,
    vote_count  INTEGER DEFAULT 0,
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

export default db;
