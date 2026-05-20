import api from './client';

export const login = (email, password) => {
  return api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
};

export const logout = () => {
  return api('/api/auth/logout', {
    method: 'POST'
  });
};

export const getMe = () => {
  return api('/api/auth/me', {
    method: 'GET'
  });
};
