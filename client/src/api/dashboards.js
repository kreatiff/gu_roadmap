import api from './client';

export const getDashboards = () =>
  api('/api/dashboards');

export const getDashboardBySlug = (slug) =>
  api(`/api/dashboards/${slug}`);

export const getDashboardMeta = (slug) =>
  api(`/api/dashboards/${slug}/meta`);

export const unlockDashboard = (slug, password) =>
  api(`/api/dashboards/${slug}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

export const createDashboard = (data) =>
  api('/api/dashboards', { method: 'POST', body: JSON.stringify(data) });

export const updateDashboard = (id, data) =>
  api(`/api/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteDashboard = (id) =>
  api(`/api/dashboards/${id}`, { method: 'DELETE' });
