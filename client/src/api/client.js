/**
 * Base fetch wrapper for interaction with the Fastify backend.
 * Automatically includes credentials (cookies) for session management.
 */
const api = async (path, options = {}) => {
  const { headers, method = 'GET', ...rest } = options;
  const upperMethod = method.toUpperCase();
  
  // Fastify/Strict JSON: Body cannot be empty if Content-Type is application/json
  const hasBodyContent = rest.body !== undefined;
  const needsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod);
  
  const finalOptions = {
    method: upperMethod,
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
  };

  if (needsBody && !hasBodyContent) {
    finalOptions.body = JSON.stringify({});
  }

  const response = await fetch(path, finalOptions);

  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/me') {
      window.location.reload();
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
