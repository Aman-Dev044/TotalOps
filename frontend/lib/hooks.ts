'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR, { mutate as globalMutate, type SWRConfiguration } from 'swr';
import { api } from './api';
import type { Dealer, Film, Meta, Settings, Staff, Store } from './types';

/** SWR wrapper around the authenticated API. Pass null to skip. */
export function useApi<T = any>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, (p: string) => api.get<T>(p), { keepPreviousData: true, ...config });
}

const STATIC: SWRConfiguration = { revalidateOnFocus: false, dedupingInterval: 60_000 };
export const useMeta = () => useApi<Meta>('/meta', STATIC);
export const useSettings = () => useApi<Settings>('/settings', STATIC);
export const useStores = () => useApi<Store[]>('/stores', STATIC);
export const useStaff = () => useApi<Staff[]>('/staff', STATIC);
export const useFilms = () => useApi<Film[]>('/films', STATIC);
export const useDealers = () => useApi<Dealer[]>('/dealers', STATIC);

/** Revalidates every cached request whose key starts with one of the prefixes (e.g. '/projects'). */
export function refresh(...prefixes: string[]) {
  return globalMutate((key) => typeof key === 'string' && prefixes.some((p) => key.startsWith(p)));
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Persists a small UI preference in localStorage (falls back to memory). */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`totalops.${key}`);
      if (raw !== null) setValue(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [key]);
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(`totalops.${key}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );
  return [value, set] as const;
}

/** Runs an async action with a busy flag; returns [run, busy]. */
export function useAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (...args: A) => {
      setBusy(true);
      try {
        return await fn(...args);
      } finally {
        setBusy(false);
      }
    },
    [fn],
  );
  return [run, busy] as const;
}
