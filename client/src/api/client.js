/**
 * Base fetch wrapper for interaction with the Fastify backend.
 * Automatically includes credentials (cookies) for session management.
 */
const api = async (path, options = {}) => {
  const { headers, ...rest } = options;
  
  const response = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Critically important for HttpOnly cookie sessions
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw error;
  }

  // Handle 204 No Content or empty responses
  if (response.status === 204) return null;
  
  return response.json();
};

export default api;
