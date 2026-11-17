import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStorage, SESSION_EXPIRED_EVENT } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' mientras se verifica un token guardado al abrir la app; sin token, directo a 'anonymous'.
  const [status, setStatus] = useState(() => (tokenStorage.get() ? 'loading' : 'anonymous'));

  // Al cargar la app, si hay token guardado, se valida contra /auth/me.
  useEffect(() => {
    if (!tokenStorage.get()) return;
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

  // Si cualquier petición detecta el token vencido, se vuelve al estado sin sesión
  // (ProtectedRoute redirige a /login).
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
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
