import api from './client';

export const getMetadata = (type) => api(`/api/metadata/${type}`);

export const renameMetadata = (type, oldValue, newValue) => api(`/api/metadata/${type}/rename`, {
  method: 'PUT',
  body: JSON.stringify({ oldValue, newValue })
});

export const deleteMetadata = (type, value) => api(`/api/metadata/${type}`, {
  method: 'DELETE',
  body: JSON.stringify({ value })
});
