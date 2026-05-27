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
