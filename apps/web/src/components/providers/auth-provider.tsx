'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export interface User {
  id: string;
  email: string;
  role: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    role: string;
    heardFrom?: string;
    onboardingReason?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiClient.get<User>('/auth/me');
        setUser(response.data);
        setIsAuthenticated(true);
      } catch {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<any>('/auth/login', { email, password });
      const userData = response.data?.user || response.data;
      const token = response.data?.token;

      if (token && typeof window !== 'undefined') {
        window.localStorage.setItem('classpod_auth_token', token);
      }

      setUser(userData);
      setIsAuthenticated(true);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, []);

  const register = useCallback(async (data: {
    email: string;
    password: string;
    name: string;
    role: string;
    heardFrom?: string;
    onboardingReason?: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<any>('/auth/register', data);
      const userData = response.data?.user || response.data;
      const token = response.data?.token;

      if (token && typeof window !== 'undefined') {
        window.localStorage.setItem('classpod_auth_token', token);
      }

      setUser(userData);
      setIsAuthenticated(true);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/logout');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('classpod_auth_token');
      }
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      router.push('/login');
    } catch (err: any) {
      setIsLoading(false);
      const message = err?.message || 'Logout is disabled while attendance is in progress.';
      if (typeof window !== 'undefined') {
        window.alert(message);
      }
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isAuthenticated, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
