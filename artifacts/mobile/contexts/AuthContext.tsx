import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken, type User } from '@/services/api';
import { restoreOrCreatePrivateSession } from '@/services/privateSession';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  sessionError: string | null;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  retrySession: () => Promise<void>;
  resetPrivateData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setSessionError(null);
    try {
      const newUser = await restoreOrCreatePrivateSession({
        getStoredToken: getToken,
        storeToken: setToken,
        clearStoredToken: clearToken,
        restoreUser: api.auth.me,
        createAnonymousSession: api.auth.anonymous,
      });
      setUser(newUser);
    } catch {
      setUser(null);
      setSessionError('Unable to start your private session. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    startSession();
  }, [startSession]);

  const resetPrivateData = useCallback(async () => {
    await api.auth.deletePrivateData();
    await clearToken();
    setUser(null);
    await startSession();
  }, [startSession]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user, token } = await api.auth.me();
      await setToken(token);
      setUser(user);
    } catch {
      // A fresh session will be created on the next app launch.
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        sessionError,
        updateUser,
        refreshUser,
        retrySession: startSession,
        resetPrivateData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
