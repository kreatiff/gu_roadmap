import api from './client';

export const castVote = (featureId) => {
  return api(`/api/features/${featureId}/vote`, {
    method: 'POST'
  });
};

export const removeVote = (featureId) => {
  return api(`/api/features/${featureId}/vote`, {
    method: 'DELETE'
  });
};
