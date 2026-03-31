import { config } from './config.js';

/**
 * Middleware to check if the user is authenticated 
 * and what roles they have (admin/user).
 */

export const authenticate = async (request, reply) => {
  try {
    // Note: Fastify JWT plugin will automatically look for the 
    // cookie specified in the configuration if configured to do so.
    // If not, we manually verify it here.
    const token = request.cookies.roadmap_session;
    
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized: missing session cookie' });
    }

    const decoded = await request.jwtVerify();
    request.user = decoded; // { sub, email, isAdmin }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized: invalid session' });
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
  
  if (request.user && !request.user.isAdmin) {
    return reply.code(403).send({ error: 'Forbidden: admin access required' });
  }
};
