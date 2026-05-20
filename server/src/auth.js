import { config } from './config.js';

/**
 * Middleware to check if the user is authenticated 
 * and what roles they have (admin/user).
 */

export const authenticate = async (request, reply) => {
  try {
    // jwtVerify() reads the roadmap_session cookie, verifies the JWT, and populates request.user
    request.user = await request.jwtVerify();
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

  // TODO [2026-06-20]: Remove isAdmin fallback once all JWTs have role field (after 30-day expiry window)
  const isAdmin = request.user?.role === 'admin' || request.user?.isAdmin === true;
  if (!isAdmin) {
    return reply.code(403).send({ error: 'Forbidden: admin access required' });
  }
};
