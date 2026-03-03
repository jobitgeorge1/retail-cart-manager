import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SessionUser } from '../types';
import { getCurrentUser, signIn, signOut, signUp } from '../services/authService';

type AuthContextValue = {
  loading: boolean;
  user: SessionUser | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = await getCurrentUser();
      if (!mounted) return;
      setUser(current);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const current = await signIn(identifier, password);
    setUser(current);
  }, []);

  const register = useCallback(async (name: string, email: string, username: string, password: string) => {
    const current = await signUp(name, email, username, password);
    setUser(current);
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ loading, user, login, register, logout }),
    [loading, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
