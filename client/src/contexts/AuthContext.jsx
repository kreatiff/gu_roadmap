import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. On mount: Verify session via /api/auth/me
  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await api('/api/auth/me');
        setUser(data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Poll every 5 minutes to detect role/session changes server-side
    const interval = setInterval(() => {
      checkSession();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Listen for auth:logout events from api client on 401
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  // 2. Login: Local credentials authentication
  const login = async (email, password) => {
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await api('/api/auth/me');
      setUser(data);
    } catch (err) {
      throw new Error(err?.error ?? 'Login failed');
    }
  };

  // 3. Navigate to Login (SSO Bypass redirect)
  const navigateToLogin = () => {
    window.location.href = '/api/auth/login';
  };

  // 4. Logout: Call backend and clear local state
  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, navigateToLogin, isAuthenticated: !!user, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
