// Adapted from AXETASKS/src/context/AuthContext.tsx — same auth flow (JWT
// issued by POST /api/auth/login|signup, verified via GET /api/auth/me on
// boot), swapping the web's synchronous localStorage calls for the async
// SecureStore-backed token helpers in ../lib/api.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api, getStoredToken, setStoredToken, removeStoredToken, onAuthExpired } from '../lib/api';
import { unregisterPushToken } from '../lib/pushToken';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, email?: string, avatar_url?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const checkAuth = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
      setError(null);
    } catch {
      setUser(null);
      await removeStoredToken();
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    const unsubscribe = onAuthExpired(() => {
      setUser(null);
      setError('Votre session a expiré. Veuillez vous reconnecter.');
    });
    return () => { unsubscribe(); };
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    try {
      clearError();
      const res = await api.login(email.trim(), password);
      await setStoredToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides ou erreur de connexion.');
      throw err;
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      clearError();
      const res = await api.signup(name.trim(), email.trim(), password);
      await setStoredToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du compte.');
      throw err;
    }
  };

  const logout = async () => {
    // Stop pushing this user's notifications to a phone they've left.
    await unregisterPushToken();
    await removeStoredToken();
    setUser(null);
    clearError();
  };

  const updateProfile = async (name: string, email?: string, avatar_url?: string) => {
    const res = await api.updateProfile(name, email, avatar_url);
    setUser(res.user);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  };

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, error, clearError, login, signup, logout, updateProfile, changePassword, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
