import { useCallback, useEffect, useState } from 'react';

// An error from the API, carrying the HTTP status and any per-field form messages.
export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// Calls the Express API. The session cookie is sent automatically (same origin).
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check that it is running and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // If the session ran out mid-use, tell the app so it can show the login page.
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(res.status, data.error || `Request failed (${res.status}).`, data.fields);
  }
  return data;
}

// Loads `path` when a screen opens. Returns { data, loading, error, reload }.
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await api(path), loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
  }, [path]);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
