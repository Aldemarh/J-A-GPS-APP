import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStorage } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' mientras se verifica un token guardado al abrir la app.
  const [status, setStatus] = useState('loading');

  // Al cargar la app, si hay token guardado, se valida contra /auth/me.
  useEffect(() => {
    if (!tokenStorage.get()) {
      setStatus('anonymous');
      return;
    }
    authApi
      .me()
      .then(({ user: profile }) => {
        setUser(profile);
        setStatus('authenticated');
      })
      .catch(() => {
        tokenStorage.clear();
        setStatus('anonymous');
      });
  }, []);

  const saveSession = ({ token, user: profile }) => {
    tokenStorage.set(token);
    setUser(profile);
    setStatus('authenticated');
  };

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    saveSession(data);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    saveSession(data);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
