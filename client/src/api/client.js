/**
 * Base fetch wrapper for interaction with the Fastify backend.
 * Automatically includes credentials (cookies) for session management.
 * Also attaches the dashboard unlock token when viewing a public dashboard.
 */

import { getDashboardToken as getTokenFromMap } from '../utils/dashboardTokens';

function getDashboardToken() {
  const match = window.location.pathname.match(/^\/d\/([^/]+)/);
  if (match) {
    return getTokenFromMap(match[1]);
  }
  return null;
}

const api = async (path, options = {}) => {
  const { headers, method = 'GET', ...rest } = options;
  const upperMethod = method.toUpperCase();
  
  // Fastify/Strict JSON: Body cannot be empty if Content-Type is application/json
  const hasBodyContent = rest.body !== undefined;
  const needsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod);
  
  const dashboardToken = getDashboardToken();
  
  const finalOptions = {
    method: upperMethod,
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(dashboardToken ? { 'X-Dashboard-Token': dashboardToken } : {}),
      ...headers,
    },
    credentials: 'include',
  };

  if (needsBody && !hasBodyContent) {
    finalOptions.body = JSON.stringify({});
  }

  const response = await fetch(path, finalOptions);

  if (!response.ok) {
    // Don't force-reload on 401 for:
    //  • session check — expected to 401 when logged out
    //  • login — error is shown in the form
    //  • public dashboard API calls — unauthenticated viewers should see an error, not a reload loop
    const isPublicDashboardPath = window.location.pathname.startsWith('/d/');
    if (
      response.status === 401 &&
      path !== '/api/auth/me' &&
      path !== '/api/auth/login' &&
      !isPublicDashboardPath
    ) {
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'unauthorized' } }));
      window.location.replace('/');
      return;
    }
    const error = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw error;
  }

  // Handle 204 No Content or empty responses
  if (response.status === 204) return null;
  
  return response.json();
};

export default api;
