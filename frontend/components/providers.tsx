'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { api, getToken, setToken } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import type { Franchisee, Store } from '@/lib/types';
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

/* ---------------- Store scope (perspective + store filter) ---------------- */
/** Matches no store — used when a franchisee perspective has no stores assigned yet. */
const NO_STORE = '000000000000000000000000';

type StoreScope = {
  /** Query value for ?storeId=: '' (all), one id, or "a,b" (a franchisee's stores). */
  storeId: string;
  /** Stores in scope; empty means every store (head office view). */
  storeIds: string[];
  /** Store list for pickers, limited to the current perspective. */
  scopedStores: Store[];
  /** Single store picked in the header ('' = the whole perspective). */
  pickedStoreId: string;
  /** Best store to pre-fill new records with. */
  defaultStoreId: string;
  franchiseeId: string;
  franchisee: Franchisee | null;
  setStoreId: (id: string) => void;
  setFranchiseeId: (id: string) => void;
  inScope: (storeId: unknown) => boolean;
};

const StoreCtx = createContext<StoreScope>({
  storeId: '', storeIds: [], scopedStores: [], pickedStoreId: '', defaultStoreId: '', franchiseeId: '', franchisee: null,
  setStoreId: () => {}, setFranchiseeId: () => {}, inScope: () => true,
});
export const useStoreScope = () => useContext(StoreCtx);

function readLocal(key: string) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function writeLocal(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function StoreScopeProvider({ children }: { children: React.ReactNode }) {
  const { admin } = useAuth();
  const [picked, setPicked] = useState('');
  const [frId, setFrId] = useState('');
  const [cachedIds, setCachedIds] = useState<string[]>([]);
  const { data: franchisees } = useApi<Franchisee[]>(admin ? '/franchisees' : null, { revalidateOnFocus: false, dedupingInterval: 60_000 });
  const { data: stores } = useApi<Store[]>(admin ? '/stores' : null, { revalidateOnFocus: false, dedupingInterval: 60_000 });

  useEffect(() => {
    setPicked(readLocal('totalops.store'));
    setFrId(readLocal('totalops.franchisee'));
    try {
      setCachedIds(JSON.parse(readLocal('totalops.franchisee.stores') || '[]'));
    } catch {
      /* ignore */
    }
  }, []);

  const franchisee = useMemo(() => (frId && franchisees ? franchisees.find((f) => f._id === frId) || null : null), [frId, franchisees]);

  // A deleted franchisee falls back to the head office view.
  useEffect(() => {
    if (frId && franchisees && !franchisee) {
      setFrId('');
      writeLocal('totalops.franchisee', '');
    }
  }, [frId, franchisees, franchisee]);

  // Until the list loads, scope to the stores remembered from last time so we never flash every store's data.
  const frStores = frId ? (franchisee ? franchisee.storeIds.map(String) : cachedIds) : null;
  useEffect(() => {
    if (franchisee) writeLocal('totalops.franchisee.stores', JSON.stringify(franchisee.storeIds));
  }, [franchisee]);

  const pickedOk = picked && (!frStores || frStores.includes(picked)) ? picked : '';
  const storeIds = pickedOk ? [pickedOk] : frStores || [];
  const storeId = pickedOk || (frStores ? frStores.join(',') || NO_STORE : '');
  const scopedStores = useMemo(() => (stores || []).filter((s) => !frStores || frStores.includes(s._id)), [stores, frStores?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStoreId = useCallback((id: string) => {
    setPicked(id);
    writeLocal('totalops.store', id);
  }, []);
  const setFranchiseeId = useCallback(
    (id: string) => {
      setFrId(id);
      writeLocal('totalops.franchisee', id);
      const f = franchisees?.find((x) => x._id === id);
      setCachedIds(f?.storeIds || []);
      writeLocal('totalops.franchisee.stores', JSON.stringify(f?.storeIds || []));
      setStoreId(''); // a new perspective starts with all of its stores
    },
    [franchisees, setStoreId],
  );
  const inScope = useCallback((sid: unknown) => !storeId || storeIds.includes(String(sid ?? '')), [storeId, storeIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<StoreScope>(
    () => ({
      storeId, storeIds, scopedStores, pickedStoreId: pickedOk, defaultStoreId: pickedOk || frStores?.[0] || '', franchiseeId: frId, franchisee,
      setStoreId, setFranchiseeId, inScope,
    }),
    [storeId, scopedStores, pickedOk, frId, franchisee, setStoreId, setFranchiseeId, inScope], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
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
