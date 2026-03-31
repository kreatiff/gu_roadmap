import { config } from '../config.js';
import { getOidcAuthUrl, exchangeCodeForUser } from '../oidc.js';
import crypto from 'crypto';
import { authenticate } from '../auth.js';

export default async function authRoutes(fastify, options) {

  // 1. Redirect to OIDC provider (or our bypass)
  fastify.get('/login', async (request, reply) => {
    const { url, state, nonce } = getOidcAuthUrl();
    
    // Store state/nonce in signed cookies to prevent CSRF during token exchange
    reply.setCookie('oidc_state', state, { httpOnly: true, signed: true, path: '/' });
    reply.setCookie('oidc_nonce', nonce, { httpOnly: true, signed: true, path: '/' });
    
    return reply.redirect(url);
  });

  // 2. Handle OIDC callback redirect
  fastify.get('/callback', async (request, reply) => {
    const { code, state: returnedState } = request.query;
    const storedState = request.unsignCookie(request.cookies.oidc_state).value;
    
    // Validate state to prevent CSRF
    if (!code || returnedState !== storedState) {
      return reply.code(400).send({ error: 'Auth failed: Invalid state' });
    }

    try {
      // Exchange code for user details
      const oidcUser = await exchangeCodeForUser(code);
      
      // Hash the 'sub' to prevent storage of real student IDs
      const sub = crypto.createHash('sha256').update(oidcUser.sub).digest('hex');
      const email = oidcUser.email.toLowerCase();
      const isAdmin = config.adminEmails.includes(email);

      // Sign JWT with minimal payload
      const token = await reply.jwtSign({ 
        sub, 
        email, 
        isAdmin 
      });

      // Set HttpOnly session cookie
      reply.setCookie('roadmap_session', token, { 
        path: '/', 
        httpOnly: true, 
        secure: config.isProd, 
        sameSite: 'lax', 
        signed: true 
      });

      // Redirect user back to the application
      return reply.redirect(config.clientOrigin);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error during auth' });
    }
  });

  // 3. Clear session cookie on logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('roadmap_session', { path: '/' });
    return { ok: true };
  });

  // 4. Return currently authenticated user status
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    return { 
      email: request.user.email, 
      isAdmin: request.user.isAdmin 
    };
  });
}
