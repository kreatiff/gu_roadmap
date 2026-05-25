import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';

import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import featureRoutes from './routes/features.js';
import categoryRoutes from './routes/categories.js';
import stageRoutes from './routes/stages.js';
import dashboardRoutes from './routes/dashboards.js';
import metadataRoutes from './routes/metadata.js';
import dataRoutes from './routes/data.js';
import fastifyMultipart from '@fastify/multipart';
import { bootstrapAdminIfEmpty } from './lib/users.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { errorHandler } from './errorHandler.js';

const server = fastify({
  logger: {
    redact: [
      'req.body.password',
      'req.body.passwordHash',
      'req.body.newPassword',
      'req.headers.authorization'
    ]
  }
});

// Register unified error handler
server.setErrorHandler(errorHandler);

// 1. Plugins Registration
server.register(cors, {
  origin: config.clientOrigin,
  credentials: true
});

server.register(cookie, {
  secret: config.cookieSecret,
  parseOptions: {}
});

server.register(rateLimit, {
  global: false
});

server.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

server.register(jwt, {
  secret: config.jwtSecret,
  cookie: {
    cookieName: 'roadmap_session',
    signed: false  // JWT is already cryptographically signed; double-signing breaks jwtVerify()
  }
});

// 2. static files (for React frontend in production)
server.register(fastifyStatic, {
  root: path.join(__dirname, '../../client/dist'),
  prefix: '/'
});

// 3. API Route Registration
server.register(authRoutes, { prefix: '/api/auth' });
server.register(userRoutes, { prefix: '/api/users' });
server.register(featureRoutes, { prefix: '/api/features' });
server.register(categoryRoutes, { prefix: '/api/categories' });
server.register(stageRoutes, { prefix: '/api/stages' });
server.register(dashboardRoutes, { prefix: '/api/dashboards' });
server.register(metadataRoutes, { prefix: '/api/metadata' });
server.register(dataRoutes, { prefix: '/api/admin/data' });

// 4. Fallback for React Router (SPA)
server.setNotFoundHandler((request, reply) => {
  // If it's an API route that's not found, return 404
  if (request.url.startsWith('/api')) {
    return reply.code(404).send({ error: 'API route not found' });
  }
  // Otherwise, serve index.html for React Router to handle
  return reply.sendFile('index.html');
});

// 5. Start Server
const start = async () => {
  try {
    // Ensure Cosmos DB database and containers exist before accepting requests
    await initDb(server.log);

    // Bootstrap initial admin user if DB is empty
    await bootstrapAdminIfEmpty(server.log);

    // Migrate existing users to sessionVersion schema
    const { ensureSessionVersionForAllUsers } = await import('./lib/users.js');
    const migrated = await ensureSessionVersionForAllUsers(server.log);
    if (migrated > 0) server.log.info(`Migrated ${migrated} users to sessionVersion schema`);

    if (!config.oidc.enabled) {
      if (config.devAuthEnabled) {
        server.log.warn('⚠️  DEV AUTH MODE ENABLED — This is insecure and must not be used in production!');
      } else {
        server.log.warn('⚠️  OIDC is not configured. Local password login is the only authentication method.');
      }
    }

    if (config.isProd) {
      if (!config.oidc.enabled) {
        server.log.error('❌ Production requires OIDC_ISSUER to be configured. Local password auth is not allowed in production.');
        process.exit(1);
      }
      if (config.devAuthEnabled) {
        server.log.error('❌ DEV_AUTH_ENABLED must not be true in production.');
        process.exit(1);
      }
    }

    await server.listen({ port: config.port, host: '0.0.0.0' });
    server.log.info(`🚀 Server listening on http://localhost:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
