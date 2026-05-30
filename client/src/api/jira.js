import api from './client';

export const generateJiraPreview = (data) => {
  return api('/api/jira/preview', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const fetchJiraEpics = () => {
  return api('/api/jira/epics');
};

export const pushToJira = (data) => {
  return api('/api/jira/push', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const fetchJiraConfig = () => {
  return api('/api/jira/config');
};

export const fetchJiraLabels = () =>
  api('/api/jira/labels');

export const fetchJiraIssues = (keys) =>
  api(`/api/jira/issues?keys=${Array.isArray(keys) ? keys.join(',') : keys}`);

export const linkJiraIssue = (featureId, data) =>
  api(`/api/jira/link/${featureId}`, { method: 'POST', body: JSON.stringify(data) });

export const saveJiraDraft = (data) =>
  api('/api/jira/draft', { method: 'POST', body: JSON.stringify(data) });

export const fetchJiraDraft = (featureId) =>
  api(`/api/jira/draft/${featureId}`);

export const discardJiraDraft = (featureId) =>
  api(`/api/jira/draft/${featureId}`, { method: 'DELETE' });

export const unlinkJiraFeature = (featureId, issueKey) => {
  const query = issueKey ? `?issueKey=${encodeURIComponent(issueKey)}` : '';
  return api(`/api/jira/link/${featureId}${query}`, { method: 'DELETE' });
};
