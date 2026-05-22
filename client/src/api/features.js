import api from './client';

export const getFeatures = (params = {}) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params)
      .filter(([_, v]) => v != null && v !== '' && (Array.isArray(v) ? v.length > 0 : true))
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v])
  );
  const query = new URLSearchParams(cleanParams).toString();
  return api(`/api/features?${query}`);
};

export const getFeatureTags = () => api('/api/features/tags');
export const getFeatureOwners = () => api('/api/features/owners');
export const getFeatureStakeholders = () => api('/api/features/stakeholders');

export const getFeatureById = (id) => {
  return api(`/api/features/${id}`);
};

export const createFeature = (data) => {
  return api('/api/features', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const updateFeature = (id, data) => {
  return api(`/api/features/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const deleteFeature = (id) => {
  return api(`/api/features/${id}`, {
    method: 'DELETE'
  });
};

export const getFeatureRevisions = (id) => {
  return api(`/api/features/${id}/revisions`);
};

export const updateStageSortOrders = (items) => {
  return api('/api/features/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });
};
