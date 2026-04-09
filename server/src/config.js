import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const required = ['JWT_SECRET', 'COOKIE_SECRET', 'COSMOS_ENDPOINT', 'COSMOS_KEY', 'COSMOS_DATABASE_ID'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. Copy .env.example to .env and fill in values.`);
  }
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',

  jwtSecret: process.env.JWT_SECRET,
  cookieSecret: process.env.COOKIE_SECRET,

  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  cosmos: {
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
    databaseId: process.env.COSMOS_DATABASE_ID,
  },

  oidc: {
    issuer: process.env.OIDC_ISSUER ?? '',
    clientId: process.env.OIDC_CLIENT_ID ?? '',
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? '',
    redirectUri: process.env.OIDC_REDIRECT_URI ?? 'http://localhost:3001/api/auth/callback',
    enabled: Boolean(process.env.OIDC_ISSUER),
  },
};
