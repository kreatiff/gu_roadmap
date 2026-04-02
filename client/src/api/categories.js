import api from './client';

export const getCategories = () => {
  return api('/api/categories');
};

export const createCategory = (data) => {
  return api('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const updateCategory = (id, data) => {
  return api(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const deleteCategory = (id, reassignTo) => {
  return api(`/api/categories/${id}`, {
    method: 'DELETE',
    body: reassignTo ? JSON.stringify({ reassignTo }) : undefined
  });
};

export const reorderCategories = (ids) => {
  return api('/api/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids })
  });
};
