import api from './client';

export const getSections = () => {
  return api('/api/sections');
};

export const createSection = (data) => {
  return api('/api/sections', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const updateSection = (id, data) => {
  return api(`/api/sections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const deleteSection = (id) => {
  return api(`/api/sections/${id}`, {
    method: 'DELETE'
  });
};
