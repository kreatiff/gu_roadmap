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

const jwtSecret = process.env.JWT_SECRET;
const cookieSecret = process.env.COOKIE_SECRET;

if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
if (cookieSecret.length < 32) {
  throw new Error('COOKIE_SECRET must be at least 32 characters long');
}

const bootstrapAdmin = {
  email: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
};

if (bootstrapAdmin.password && bootstrapAdmin.password.length < 12) {
  throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be ≥12 characters');
}
delete process.env.BOOTSTRAP_ADMIN_PASSWORD; // scrub from process memory

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',

  jwtSecret,
  cookieSecret,
  jwtExpiry: process.env.JWT_EXPIRY ?? '8h',

  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  bootstrapAdmin,

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
    // All three must be present for OIDC to be active; a partial config fails silently otherwise
    enabled: Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
  },

  devAuthEnabled: process.env.DEV_AUTH_ENABLED === 'true',
};
