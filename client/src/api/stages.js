import api from './client';

export const getStages = () => {
  return api('/api/stages');
};

export const createStage = (data) => {
  return api('/api/stages', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const updateStage = (id, data) => {
  return api(`/api/stages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const deleteStage = (id, reassignTo = null) => {
  return api(`/api/stages/${id}`, {
    method: 'DELETE',
    body: reassignTo ? JSON.stringify({ reassignTo }) : undefined
  });
};

export const reorderStages = (stageIds) => {
  return api('/api/stages/reorder', {
    method: 'POST',
    body: JSON.stringify({ stageIds })
  });
};
