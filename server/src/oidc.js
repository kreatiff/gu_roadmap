import { config } from './config.js';
import crypto from 'crypto';

/**
 * Since the user requested to "leave OIDC for now", 
 * we use this module to provide a dev-only login flow.
 * In a real scenario, this would use openid-client.
 */

export const getOidcAuthUrl = () => {
  // In dev, we just redirect directly to our internal callback with a dummy code
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Normally this would be the university's SSO URL
  // For now, we simulate it by returning our own callback URL
  return {
    url: `${config.clientOrigin}/api/auth/callback?code=dev_code&state=${state}`,
    state,
    nonce
  };
};

export const exchangeCodeForUser = async (code) => {
  // Mock user for development
  if (code === 'dev_code') {
    return {
      sub: 'dev_user_123', // This will be hashed in the callback route
      email: 'o.estrin@griffith.edu.au', // The requested admin email
      name: 'Oleg Estrin (Dev)'
    };
  }
  throw new Error('Invalid dev code');
};
