/**
 * Data management API — export and import.
 * Uses native fetch for the import because FormData requires the browser to set
 * the multipart boundary in Content-Type automatically. The shared api() client
 * forces Content-Type: application/json which would break multipart uploads.
 */

export const importData = async (formData) => {
  const response = await fetch('/api/admin/data/import', {
    method: 'POST',
    credentials: 'include', // send session cookie
    body: formData,
    // Do NOT set Content-Type — the browser sets it automatically with the correct boundary
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw err;
  }

  return response.json();
};
