import * as client from 'openid-client';
import { config } from './config.js';
import crypto from 'crypto';

// Cached after first successful discovery
let oidcConfig = null;

async function getConfig() {
  if (!oidcConfig) {
    oidcConfig = await client.discovery(
      new URL(config.oidc.issuer),
      config.oidc.clientId,
      config.oidc.clientSecret
    );
  }
  return oidcConfig;
}

export const getOidcAuthUrl = async () => {
  // Dev fallback: no OIDC provider configured
  if (!config.oidc.enabled) {
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    return {
      url: `/api/auth/callback?code=dev_code&state=${state}`,
      state,
      nonce,
    };
  }

  const cfg = await getConfig();
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    redirect_uri: config.oidc.redirectUri,
    scope: 'openid email profile',
    state,
    nonce,
  });

  const authUrl = client.buildAuthorizationUrl(cfg, params);
  return { url: authUrl.href, state, nonce };
};

export const exchangeCodeForUser = async ({ callbackUrl, storedState, storedNonce }) => {
  // Dev fallback
  if (!config.oidc.enabled) {
    const url = new URL(callbackUrl);
    if (url.searchParams.get('code') !== 'dev_code') {
      throw new Error('Invalid dev code');
    }
    return {
      sub: 'dev_user_123',
      email: config.adminEmails[0] ?? 'dev@griffith.edu.au',
      name: 'Dev User',
    };
  }

  const cfg = await getConfig();

  const tokens = await client.authorizationCodeGrant(cfg, new URL(callbackUrl), {
    expectedState: storedState,
    expectedNonce: storedNonce,
  });

  const claims = tokens.claims();

  return {
    sub: claims.sub,
    // Microsoft may return email in `email` or `preferred_username`
    email: claims.email ?? claims.preferred_username,
    name: claims.name,
  };
};
