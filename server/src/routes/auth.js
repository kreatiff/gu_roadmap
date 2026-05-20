import { config } from '../config.js';
import { getLoginStrategy, getOidcAuthUrl, exchangeCodeForUser } from '../auth-strategy.js';
import crypto from 'crypto';
import { authenticate } from '../auth.js';
import bcrypt from 'bcryptjs';
import ms from 'ms';
import {
  findUserByEmail,
  createUser,
  updateUser,
  sanitiseUser
} from '../lib/users.js';

// Pre-compute dummy hash at startup for timing-safe user verification
const DUMMY_HASH = bcrypt.hashSync('__dummy__', 12);

export default async function authRoutes(fastify, options) {

  // 1. Redirect to OIDC provider (SSO login) - only if OIDC is enabled
  fastify.get('/login', async (request, reply) => {
    const strategy = getLoginStrategy();
    if (strategy.type !== 'oidc') {
      return reply.code(404).send({ error: 'SSO login is not enabled.' });
    }

    const { url, state, nonce } = await getOidcAuthUrl();

    // Store state/nonce in signed cookies to prevent CSRF during token exchange
    reply.setCookie('oidc_state', state, { httpOnly: true, signed: true, path: '/' });
    reply.setCookie('oidc_nonce', nonce, { httpOnly: true, signed: true, path: '/' });

    return reply.redirect(url);
  });

  // 2. Credential Login (Local password flow)
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      }
    },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;
    const normalisedEmail = email.trim().toLowerCase();

    const user = await findUserByEmail(normalisedEmail);
    const candidateHash = user?.passwordHash ?? DUMMY_HASH;

    const match = await bcrypt.compare(password, candidateHash);

    if (!user || user.status !== 'active' || !match) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Sign JWT with full payload shape
    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAdmin: user.role === 'admin'
    }, {
      expiresIn: config.jwtExpiry
    });

    const maxAgeInSeconds = Math.floor(ms(config.jwtExpiry) / 1000);

    // Set HttpOnly session cookie
    reply.setCookie('roadmap_session', token, {
      path: '/',
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      maxAge: maxAgeInSeconds
    });

    return { user: sanitiseUser(user) };
  });

  // 3. Handle OIDC callback redirect
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

      // OIDC User Sync: on first SSO login, create the user record using email to determine admin status
      let user = await findUserByEmail(email);
      if (!user) {
        const isFirstAdmin = (email === config.bootstrapAdmin.email);
        user = await createUser({
          email,
          name: oidcUser.name || 'SSO User',
          role: isFirstAdmin ? 'admin' : 'user',
          oauthSub: sub,
          createdBy: 'sso_auto_sync'
        });
      } else if (!user.oauthSub) {
        await updateUser(user.id, { oauthSub: sub });
        user.oauthSub = sub;
      }

      // Check user status
      if (user.status !== 'active') {
        return reply.code(401).send({ error: 'Account is inactive' });
      }

      // Sign JWT with full user payload details
      const token = await reply.jwtSign({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.role === 'admin'
      }, {
        expiresIn: config.jwtExpiry
      });

      const maxAgeInSeconds = Math.floor(ms(config.jwtExpiry) / 1000);

      // Set HttpOnly session cookie
      reply.setCookie('roadmap_session', token, {
        path: '/',
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: maxAgeInSeconds
      });

      // Clear temporary OIDC state/nonce cookies
      reply.clearCookie('oidc_state', { path: '/' });
      reply.clearCookie('oidc_nonce', { path: '/' });

      return reply.redirect(config.clientOrigin);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error during auth' });
    }
  });

  // 4. Clear session cookie on logout (guards against CSRF via authentication preHandler)
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    reply.clearCookie('roadmap_session', {
      path: '/',
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax'
    });
    reply.clearCookie('oidc_state', { path: '/' });
    reply.clearCookie('oidc_nonce', { path: '/' });
    return { ok: true };
  });

  // 5. Return currently authenticated user status
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    return {
      id: request.user.sub,
      email: request.user.email,
      name: request.user.name,
      role: request.user.role,
      isAdmin: request.user.role === 'admin' || request.user.isAdmin === true
    };
  });
}
