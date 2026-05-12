import { config } from '../config.js';
import { getOidcAuthUrl, exchangeCodeForUser } from '../oidc.js';
import crypto from 'crypto';
import { authenticate } from '../auth.js';

export default async function authRoutes(fastify, options) {

  // 1. Redirect to OIDC provider (Microsoft Entra ID)
  fastify.get('/login', async (request, reply) => {
    const { url, state, nonce } = await getOidcAuthUrl();

    // Store state/nonce in signed cookies to prevent CSRF during token exchange
    reply.setCookie('oidc_state', state, { httpOnly: true, signed: true, path: '/' });
    reply.setCookie('oidc_nonce', nonce, { httpOnly: true, signed: true, path: '/' });

    return reply.redirect(url);
  });

  // 2. Handle OIDC callback redirect
  fastify.get('/callback', async (request, reply) => {
    const { state: returnedState } = request.query;
    const storedState = request.unsignCookie(request.cookies.oidc_state ?? '').value;
    const storedNonce = request.unsignCookie(request.cookies.oidc_nonce ?? '').value;

    // Validate state to prevent CSRF
    if (!returnedState || returnedState !== storedState) {
      return reply.code(400).send({ error: 'Auth failed: Invalid state' });
    }

    try {
      // Build the full callback URL so openid-client can extract code + state
      const callbackUrl = `${config.oidc.redirectUri}?${new URLSearchParams(request.query)}`;

      const oidcUser = await exchangeCodeForUser({ callbackUrl, storedState, storedNonce });

      const email = oidcUser.email?.toLowerCase();

      if (!email) {
        return reply.code(403).send({ error: 'No email returned from identity provider.' });
      }

      // Restrict access to Griffith University accounts
      if (!email.endsWith('@griffith.edu.au')) {
        return reply.code(403).send({ error: 'Access restricted to Griffith University accounts (@griffith.edu.au).' });
      }

      // Hash the 'sub' to prevent storage of real student IDs
      const sub = crypto.createHash('sha256').update(oidcUser.sub).digest('hex');
      const isAdmin = config.adminEmails.includes(email);

      // Sign JWT with minimal payload
      const token = await reply.jwtSign({
        sub,
        email,
        isAdmin,
      });

      // Set HttpOnly session cookie (raw JWT — already cryptographically signed)
      reply.setCookie('roadmap_session', token, {
        path: '/',
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
      });

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
      isAdmin: request.user.isAdmin,
    };
  });
}
