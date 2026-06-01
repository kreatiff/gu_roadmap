// Module-level in-memory store for dashboard unlock tokens.
// Lost on page refresh/tab close. Not accessible to XSS.
const tokens = new Map();

export const getDashboardToken = (slug) => tokens.get(slug) || null;
export const setDashboardToken = (slug, token) => tokens.set(slug, token);
export const clearDashboardToken = (slug) => tokens.delete(slug);
