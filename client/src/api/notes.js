import api from './client';

export const getFeatureNotes = (featureId) =>
  api(`/api/features/${featureId}/notes`);

export const createFeatureNote = (featureId, content, { discussion = false } = {}) =>
  api(`/api/features/${featureId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content, discussion_point: discussion }),
  });

export const resolveDiscussionPoint = (featureId, noteId, resolution) =>
  api(`/api/features/${featureId}/notes/${noteId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(resolution ? { resolution } : {}),
  });

export const reopenDiscussionPoint = (featureId, noteId) =>
  api(`/api/features/${featureId}/notes/${noteId}/reopen`, { method: 'POST' });

/**
 * Turn whatever a notes call threw into text a person can act on. The server sends
 * { statusCode, error, message } where `message` says exactly what went wrong; a
 * network failure surfaces as a bare TypeError, so explain that case ourselves.
 */
export const getNoteErrorMessage = (err, fallback) => {
  if (err?.message && !(err instanceof TypeError)) return err.message;
  if (err instanceof TypeError) return 'Could not reach the server. Check your connection and try again.';
  return err?.error || fallback;
};

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
