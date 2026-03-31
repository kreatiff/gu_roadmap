import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';

import authRoutes from './routes/auth.js';
import featureRoutes from './routes/features.js';
import sectionRoutes from './routes/sections.js';
import voteRoutes from './routes/votes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = fastify({
  logger: {
    transport: {
      target: 'pino-pretty'
    }
  }
});

// 1. Plugins Registration
server.register(cors, {
  origin: config.clientOrigin,
  credentials: true
});

server.register(cookie, {
  secret: config.cookieSecret,
  parseOptions: {}
});

server.register(jwt, {
  secret: config.jwtSecret,
  cookie: {
    cookieName: 'roadmap_session',
    signed: true
  }
});

// 2. static files (for React frontend in production)
server.register(fastifyStatic, {
  root: path.join(__dirname, '../../client/dist'),
  prefix: '/'
});

// 3. API Route Registration
server.register(authRoutes, { prefix: '/api/auth' });
server.register(featureRoutes, { prefix: '/api/features' });
server.register(sectionRoutes, { prefix: '/api/sections' });
server.register(voteRoutes, { prefix: '/api/features' }); // Voting nested under features

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
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Server listening on http://localhost:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
