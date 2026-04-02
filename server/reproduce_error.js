import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'data/database.sqlite');
const db = new Database(DB_PATH);

const query = `UPDATE features SET description = ?, category_id = ?, stage_id = ?, status = ?, pinned = ?, tags = ?, impact = ?, effort = ?, owner = ?, key_stakeholder = ?, priority = ?, updated_at = ? WHERE id = ?`;
const params = [ 'planned', 'b4948206-5385-4044-87ab-dd2ad8bede93', 'stg_2', 'planned', 0, '["Campus Tech","Strategic"]', 4, 2, 'James Chen (LMS)', 'Dr. Jones (Registrar)', 'High', '2026-04-02T04:13:50.168Z', 'b21a793a-4e8d-47b7-aeda-ef8b1dfa9b43' ];

try {
  console.log('Testing specific UPDATE...');
  const result = db.prepare(query).run(...params);
  console.log('Success!', result);
} catch (e) {
  console.error('FAILED with error message:', e.message);
  console.error('Full Error:', e);
}
