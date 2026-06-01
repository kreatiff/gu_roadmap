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

export const getMetadataConfigs = () => api('/api/metadata/configs');

export const upsertMetadataConfig = (value, jira_reporter_email) => api('/api/metadata/configs', {
  method: 'POST',
  body: JSON.stringify({ value, jira_reporter_email })
});

export const fetchUserEmails = () => api('/api/metadata/users/emails');
