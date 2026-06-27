import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginWithAppwrite, logoutFromAppwrite, restoreSessionUser } from '../lib/auth.js';
import { setCurrentUser } from '../lib/authSession.js';
import { env } from '../lib/env.js';

const AuthContext = createContext();

function isSessionValid(user) {
  if (!user?.loginAt) return true;
  const maxMs = env.sessionMaxHours * 60 * 60 * 1000;
  return Date.now() - user.loginAt < maxMs;
}

function persistSession(user) {
  const payload = { ...user, loginAt: Date.now() };
  localStorage.setItem('sys_session_meta', JSON.stringify({
    userId: payload.userId,
    role: payload.role,
    loginAt: payload.loginAt,
  }));
  return payload;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const metaRaw = localStorage.getItem('sys_session_meta');
        const meta = metaRaw ? JSON.parse(metaRaw) : null;
        if (meta && !isSessionValid(meta)) {
          localStorage.removeItem('sys_session_meta');
          await logoutFromAppwrite();
          setLoading(false);
          return;
        }
        const restored = await restoreSessionUser();
        if (restored && isSessionValid(meta || restored)) {
          const sessionUser = persistSession(restored);
          setUser(sessionUser);
          setCurrentUser(sessionUser);
        } else {
          localStorage.removeItem('sys_session_meta');
        }
      } catch {
        localStorage.removeItem('sys_session_meta');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password) => {
    setError(null);
    try {
      const authUser = await loginWithAppwrite(username, password);
      const sessionUser = persistSession(authUser);
      setUser(sessionUser);
      setCurrentUser(sessionUser);
      return sessionUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    setUser(null);
    setCurrentUser(null);
    localStorage.removeItem('sys_session_meta');
    await logoutFromAppwrite();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
