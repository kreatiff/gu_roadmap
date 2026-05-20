import { v5 as uuidv5 } from 'uuid';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { usersContainer } from '../db.js';

// Deterministic UUID namespace for user IDs
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

/**
 * Remove sensitive password fields from user object
 */
export const sanitiseUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
};

/**
 * Find user by email. Performs a Cosmos point-read since partition key is /email.
 */
export async function findUserByEmail(email) {
  if (!email) return null;
  const normalisedEmail = email.trim().toLowerCase();
  const id = uuidv5(normalisedEmail, NAMESPACE);
  try {
    const { resource } = await usersContainer.item(id, normalisedEmail).read();
    if (resource) return resource;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }

  // Fallback to query in case user was created with a non-deterministic ID
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.email = @email',
    parameters: [{ name: '@email', value: normalisedEmail }]
  };
  const { resources } = await usersContainer.items.query(querySpec).fetchAll();
  return resources[0] || null;
}

/**
 * Find user by ID. Performs a cross-partition SQL query because partition key is /email.
 * This is O(partition-count) but acceptable for <= 1000 users.
 */
export async function findUserById(id) {
  if (!id) return null;
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.id = @id',
    parameters: [{ name: '@id', value: id }]
  };
  const { resources } = await usersContainer.items.query(querySpec).fetchAll();
  return resources[0] || null;
}

/**
 * Create a new user with deterministic uuidv5 ID and bcrypt hashed password.
 */
export async function createUser({ email, name, password, role = 'user', createdBy = 'system', oauthSub = null }) {
  const normalisedEmail = email.trim().toLowerCase();
  const id = uuidv5(normalisedEmail, NAMESPACE);

  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  const userDoc = {
    id,
    email: normalisedEmail,
    name: name || '',
    passwordHash,
    role,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy,
    oauthSub
  };

  const { resource } = await usersContainer.items.create(userDoc);
  return resource;
}

/**
 * Update user using Cosmos DB atomic Patch API (prevents TOCTOU race conditions).
 * Does NOT support password updates.
 */
export async function updateUser(id, patch) {
  const user = await findUserById(id);
  if (!user) throw new Error('User not found');

  const allowedFields = ['name', 'role', 'status', 'oauthSub'];
  const operations = [];

  for (const field of allowedFields) {
    if (patch[field] !== undefined) {
      operations.push({ op: 'replace', path: `/${field}`, value: patch[field] });
    }
  }

  // Always update updatedAt
  operations.push({ op: 'replace', path: '/updatedAt', value: new Date().toISOString() });

  const { resource } = await usersContainer.item(id, user.email).patch({ operations });
  return resource;
}

/**
 * Reset user password with validation and patch.
 */
export async function resetUserPassword(id, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  const user = await findUserById(id);
  if (!user) throw new Error('User not found');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const operations = [
    { op: 'replace', path: '/passwordHash', value: passwordHash },
    { op: 'replace', path: '/updatedAt', value: new Date().toISOString() }
  ];

  const { resource } = await usersContainer.item(id, user.email).patch({ operations });
  return resource;
}

/**
 * List users with server-side filtering (search) and pagination via Cosmos continuation tokens.
 * Cap pageSize at 100 to prevent large data dumps.
 */
export async function listUsers({ search, continuationToken, pageSize }) {
  const limit = Math.min(pageSize ? parseInt(pageSize, 10) : 20, 100);

  let queryText = 'SELECT * FROM c';
  let countQueryText = 'SELECT VALUE COUNT(1) FROM c';
  const parameters = [];

  if (search) {
    const searchLower = search.trim().toLowerCase();
    queryText += ' WHERE CONTAINS(LOWER(c.name), @search) OR CONTAINS(LOWER(c.email), @search)';
    countQueryText += ' WHERE CONTAINS(LOWER(c.name), @search) OR CONTAINS(LOWER(c.email), @search)';
    parameters.push({ name: '@search', value: searchLower });
  }

  queryText += ' ORDER BY c.createdAt DESC';

  const querySpec = { query: queryText, parameters };
  const queryOptions = {
    maxItemCount: limit,
    continuationToken: continuationToken || undefined
  };

  const queryIterator = usersContainer.items.query(querySpec, queryOptions);
  const { resources: users, continuationToken: nextContinuationToken } = await queryIterator.fetchNext();

  const countQuerySpec = { query: countQueryText, parameters };
  const { resources: countResources } = await usersContainer.items.query(countQuerySpec).fetchAll();
  const totalCount = countResources[0] || 0;

  return {
    users: users.map(sanitiseUser),
    continuationToken: nextContinuationToken || null,
    totalCount
  };
}

/**
 * Bootstrap the initial admin user if the users container is empty.
 * Idempotency is guaranteed structurally by using a deterministic UUID v5.
 */
export async function bootstrapAdminIfEmpty() {
  const email = config.bootstrapAdmin.email;
  const password = config.bootstrapAdmin.password;

  if (!email || !password) {
    console.log('ℹ️ Bootstrap admin credentials not fully configured, skipping bootstrap.');
    return;
  }

  try {
    const { resources } = await usersContainer.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
    const count = resources[0] || 0;
    if (count > 0) {
      console.log('ℹ️ Users container is not empty. Skipping admin bootstrap.');
      return;
    }

    console.log(`🚀 Bootstrapping admin user: ${email}`);
    await createUser({
      email,
      name: 'System Admin',
      password,
      role: 'admin',
      createdBy: 'system'
    });
    console.log('✅ Admin user bootstrapped successfully.');
  } catch (err) {
    if (err.statusCode === 409) {
      console.log('ℹ️ Admin user already exists (409 Conflict), skipping bootstrap.');
    } else {
      console.error('❌ Error bootstrapping admin user:', err);
      throw err;
    }
  }
}
