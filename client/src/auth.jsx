import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

// Knows who is logged in. On first load it asks the server (GET /api/auth/me).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null); // the server couldn't answer, which isn't "logged out"

  const check = useCallback(() => {
    setChecking(true);
    setError(null);
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch((err) => {
        setUser(null);
        if (err.status !== 401) setError(err);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    check();
    const onExpired = () => setUser(null);
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [check]);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setUser(data.user);
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const data = await api('/auth/signup', { method: 'POST', body: { name, email, password } });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, error, retry: check, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
