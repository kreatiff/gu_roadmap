import { requireSuperAdmin } from '../auth.js';
import { usersContainer } from '../db.js';
import {
  findUserById,
  createUser,
  updateUser,
  resetUserPassword,
  listUsers,
  sanitiseUser
} from '../lib/users.js';
import { auditLog } from '../lib/auditLog.js';
import { USER_ROLES, USER_STATUS } from '../constants.js';

export default async function userRoutes(fastify, options) {

  // 1. List users (paginated, search-enabled, admin-only)
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { search, continuationToken, pageSize } = request.query;
    try {
      const result = await listUsers({ search, continuationToken, pageSize });
      return result;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 2. Get single user
  fastify.get('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params;
    try {
      const user = await findUserById(id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      return sanitiseUser(user);
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // 3. Create a new user
  fastify.post('/', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'name', 'password', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: USER_ROLES }
        }
      }
    },
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { email, name, password, role } = request.body;
    try {
      const user = await createUser({
        email,
        name,
        password,
        role,
        createdBy: request.user.sub
      });
      await auditLog(fastify, { actor: request.user.sub, action: 'user.create', target: user.email, outcome: 'success' });
      return sanitiseUser(user);
    } catch (err) {
      if (err.statusCode === 409) {
        return reply.code(400).send({ error: 'Email already exists' });
      }
      return reply.code(400).send({ error: err.message });
    }
  });

  // 4. Update user details (name, role, status) - NO password updates here
  fastify.patch('/:id', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: USER_ROLES },
          status: { type: 'string', enum: USER_STATUS }
        }
      }
    },
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const patch = request.body;

    if (patch.password !== undefined) {
      return reply.code(400).send({ error: 'Use POST /api/users/:id/reset-password' });
    }

    const currentUserId = request.user.sub;

    // Server-side guard: cannot self-deactivate
    if (id === currentUserId && patch.status === 'inactive') {
      return reply.code(400).send({ error: 'Cannot deactivate your own account' });
    }

    try {
      const userToUpdate = await findUserById(id);
      if (!userToUpdate) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Server-side guard: cannot demote/deactivate the last active admin
      if (userToUpdate.role === 'admin' && userToUpdate.status === 'active') {
        const isChangingRole = (patch.role !== undefined && patch.role !== 'admin');
        const isDeactivating = (patch.status !== undefined && patch.status !== 'active');
        
        if (isChangingRole || isDeactivating) {
          // Count active admins in Cosmos
          const { resources } = await usersContainer.items.query("SELECT VALUE COUNT(1) FROM c WHERE c.role = 'admin' AND c.status = 'active'").fetchAll();
          const activeAdminCount = resources[0] || 0;
          if (activeAdminCount <= 1) {
            return reply.code(400).send({ error: 'Cannot demote or deactivate the last active admin' });
          }
        }
      }

      const updatedUser = await updateUser(id, patch);
      if (patch.role !== undefined) {
        await auditLog(fastify, { actor: request.user.sub, action: 'user.role_change', target: id, outcome: 'success', metadata: { oldRole: userToUpdate.role, newRole: patch.role } });
      }
      return sanitiseUser(updatedUser);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // 5. Reset user password (admin-only, strict 3/min rate limit)
  fastify.post('/:id/reset-password', {
    preHandler: [requireSuperAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    },
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { newPassword } = request.body;

    try {
      const updatedUser = await resetUserPassword(id, newPassword);
      await auditLog(fastify, { actor: request.user.sub, action: 'user.password_reset', target: id, outcome: 'success' });
      return sanitiseUser(updatedUser);
    } catch (err) {
      if (err.message.includes('not found')) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(400).send({ error: err.message });
    }
  });
}
