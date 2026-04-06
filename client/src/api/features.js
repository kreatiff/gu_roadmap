import api from './client';

export const getFeatures = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api(`/api/features?${query}`);
};

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
