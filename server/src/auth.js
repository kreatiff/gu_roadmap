import { config } from './config.js';

/**
 * Middleware to check if the user is authenticated 
 * and what roles they have (admin/user).
 */

export const authenticate = async (request, reply) => {
  try {
    // jwtVerify() reads the roadmap_session cookie, verifies the JWT, and populates request.user
    request.user = await request.jwtVerify();

    // Validate sessionVersion if present in JWT
    if (request.user.sessionVersion !== undefined) {
      const { findUserById } = await import('./lib/users.js');
      const user = await findUserById(request.user.sub);
      if (!user || user.sessionVersion !== request.user.sessionVersion) {
        request.log.warn('Session invalidated due to sessionVersion mismatch');
        return reply.code(401).send({ error: 'Session invalidated. Please log in again.' });
      }
    }
  } catch (err) {
    request.log.warn({ err: err.message }, 'Authentication failed');
    return reply.code(401).send({ error: 'Unauthorized' });
  }
};

export const optionalAuthenticate = async (request, reply) => {
  try {
    const token = request.cookies.roadmap_session;
    if (token) {
      const decoded = await request.jwtVerify();
      request.user = decoded;
    } else {
      request.user = null;
    }
  } catch (err) {
    request.user = null;
  }
};

export const requireAdmin = async (request, reply) => {
  await authenticate(request, reply);
  if (reply.sent) return;

  const role = request.user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    return reply.code(403).send({ error: 'Forbidden: admin access required' });
  }
};

/** Only super_admin accounts may access user management and data management routes. */
export const requireSuperAdmin = async (request, reply) => {
  await authenticate(request, reply);
  if (reply.sent) return;

  if (request.user?.role !== 'super_admin') {
    return reply.code(403).send({ error: 'Forbidden: super admin access required' });
  }
};
