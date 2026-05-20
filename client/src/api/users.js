import api from './client';

export const listUsers = ({ search, continuationToken, pageSize } = {}) => {
  const params = {};
  if (search) params.search = search;
  if (continuationToken) params.continuationToken = continuationToken;
  if (pageSize) params.pageSize = pageSize;

  const query = new URLSearchParams(params).toString();
  return api(`/api/users?${query}`);
};

export const createUser = (user) => {
  return api('/api/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
};

export const updateUser = (id, patch) => {
  return api(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
};

export const resetPassword = (id, password) => {
  return api(`/api/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword: password })
  });
};
