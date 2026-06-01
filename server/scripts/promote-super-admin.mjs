/**
 * One-off script: promote a user to super_admin by email.
 * Usage: node scripts/promote-super-admin.mjs <email>
 */

import { CosmosClient } from '@azure/cosmos';
import { v5 as uuidv5 } from 'uuid';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// .env lives at the workspace root (two levels above server/scripts/)
dotenv.config({ path: join(__dirname, '../../.env') });
// Also try one level up in case script is run from server/
if (!process.env.COSMOS_ENDPOINT) {
  dotenv.config({ path: join(__dirname, '../.env') });
}

const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/promote-super-admin.mjs <email>');
  process.exit(1);
}

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const container = client
  .database(process.env.COSMOS_DATABASE_ID)
  .container('users');

const id = uuidv5(email, NAMESPACE);

console.log(`Looking up user: ${email} (id: ${id})`);

try {
  const { resource: user } = await container.item(id, email).read();

  if (!user) {
    console.error('User not found.');
    process.exit(1);
  }

  console.log(`Found: ${user.name} (${user.email}) — current role: ${user.role}`);

  const { resource: updated } = await container.item(id, email).patch({
    operations: [
      { op: 'replace', path: '/role', value: 'super_admin' },
      { op: 'replace', path: '/updatedAt', value: new Date().toISOString() },
    ],
  });

  console.log(`✅ Promoted ${updated.email} to super_admin.`);
} catch (err) {
  if (err.code === 404) {
    console.error(`User not found: ${email}`);
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
}
