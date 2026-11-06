import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { refreshSession, request, setAccessToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    refreshSession()
      .then((restoredUser) => { if (active) setUser(restoredUser); })
      .catch(() => { if (active) setAccessToken(null); })
      .finally(() => { if (active) setInitializing(false); });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const data = await request('/auth/login', { method: 'POST', body: credentials });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await request('/auth/logout', { method: 'POST', body: {}, authenticated: true });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, initializing, signIn, signOut, clearSession }), [user, initializing, signIn, signOut, clearSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
