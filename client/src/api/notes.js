import api from './client';

export const getFeatureNotes = (featureId) =>
  api(`/api/features/${featureId}/notes`);

export const createFeatureNote = (featureId, content) =>
  api(`/api/features/${featureId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

export const updateFeatureNote = (featureId, noteId, content) =>
  api(`/api/features/${featureId}/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });

export const deleteFeatureNote = (featureId, noteId) =>
  api(`/api/features/${featureId}/notes/${noteId}`, { method: 'DELETE' });

export const generateNotesSummary = (featureId) =>
  api(`/api/features/${featureId}/notes/summary`, { method: 'POST' });

export const updateNotesSummary = (featureId, content) =>
  api(`/api/features/${featureId}/notes/summary`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
