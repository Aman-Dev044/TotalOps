'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { api, getToken, setToken } from '@/lib/api';
import { ConfirmProvider } from './ui';

/* ---------------- Theme ---------------- */
type Theme = 'light' | 'dark';
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({ theme: 'light', setTheme: () => {}, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  useEffect(() => {
    let t: Theme = 'light';
    try {
      const saved = localStorage.getItem('totalops.theme');
      t = saved === 'dark' || saved === 'light' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      /* ignore */
    }
    setThemeState(t);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('totalops.theme', t);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo(() => ({ theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }), [theme, setTheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/* ---------------- Auth (admin only) ---------------- */
export type Admin = { _id: string; name: string; email: string; phone?: string };
type AuthState = { admin: Admin | null; ready: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void; refresh: () => Promise<void> };
const AuthCtx = createContext<AuthState>({ admin: null, ready: false, login: async () => {}, logout: () => {}, refresh: async () => {} });
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setAdmin(null);
      setReady(true);
      return;
    }
    try {
      setAdmin(await api.get<Admin>('/auth/me'));
    } catch {
      setAdmin(null);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; admin: Admin }>('/auth/login', { email, password }, { auth: false });
    setToken(res.token);
    setAdmin(res.admin);
  }, []);
  const logout = useCallback(() => {
    setToken('');
    setAdmin(null);
    window.location.href = '/login';
  }, []);
  return <AuthCtx.Provider value={{ admin, ready, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}

/* ---------------- Store scope (global store filter) ---------------- */
const StoreCtx = createContext<{ storeId: string; setStoreId: (id: string) => void }>({ storeId: '', setStoreId: () => {} });
export const useStoreScope = () => useContext(StoreCtx);

function StoreScopeProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStore] = useState('');
  useEffect(() => {
    try {
      setStore(localStorage.getItem('totalops.store') || '');
    } catch {
      /* ignore */
    }
  }, []);
  const setStoreId = useCallback((id: string) => {
    setStore(id);
    try {
      localStorage.setItem('totalops.store', id);
    } catch {
      /* ignore */
    }
  }, []);
  return <StoreCtx.Provider value={{ storeId, setStoreId }}>{children}</StoreCtx.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SWRConfig value={{ shouldRetryOnError: (err: any) => !(err?.status >= 400 && err?.status < 500), errorRetryCount: 2 }}>
        <AuthProvider>
          <StoreScopeProvider>
            <ConfirmProvider>
              {children}
              <ThemedToaster />
            </ConfirmProvider>
          </StoreScopeProvider>
        </AuthProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" richColors closeButton toastOptions={{ style: { borderRadius: 14 } }} />;
}
