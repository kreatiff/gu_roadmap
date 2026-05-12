import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { config } from './src/config.js';

async function test() {
  const fastify = Fastify();
  fastify.register(fastifyJwt, { secret: config.jwtSecret, cookie: { cookieName: 'roadmap_session', signed: false } });
  
  await fastify.ready();
  const token = fastify.jwt.sign({ sub: 'admin', email: 'admin@test.com', isAdmin: true }, { expiresIn: '1h' });
  
  const r = await fetch('http://localhost:3001/api/dashboards/ebf57d70-76cf-4b6a-a094-6450cbd87af8', { 
    method: 'DELETE', 
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json', 'Cookie': 'roadmap_session=' + token }
  });
  console.log('Status:', r.status);
  console.log('Body:', await r.text());
}
test();
