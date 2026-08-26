/**
 * Data management API — export, import, and backup listing.
 * Uses native fetch throughout. The import route uses FormData (multipart),
 * so Content-Type must NOT be set manually — the browser adds the boundary.
 * The export route returns a file stream, so we use blob() + a synthetic anchor.
 */

export const exportData = async () => {
  const response = await fetch('/api/admin/data/export', {
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Export failed' }));
    throw err;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const contentDisposition = response.headers.get('Content-Disposition');
  const match = contentDisposition?.match(/filename="?([^";\n]+)"?/);
  a.download = match ? match[1] : 'vle-roadmap-backup.json';
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importData = async (formData) => {
  const response = await fetch('/api/admin/data/import', {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Do NOT set Content-Type — the browser sets it automatically with the correct boundary
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw err;
  }

  return response.json();
};

export const listBackups = async () => {
  const response = await fetch('/api/admin/data/backups', {
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to list backups' }));
    throw err;
  }
  return response.json();
};

export const restoreBackup = async (filename) => {
  const response = await fetch(`/api/admin/data/backups/${encodeURIComponent(filename)}/restore`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Restore failed' }));
    throw err;
  }
  return response.json();
};

export const deleteBackup = async (filename) => {
  const response = await fetch(`/api/admin/data/backups/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to delete backup' }));
    throw err;
  }
  return response.json();
};
