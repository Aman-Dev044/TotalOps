'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh } from '@/lib/hooks';
import type { ProjectDetail } from '@/lib/types';

export type RunFn = <T = any>(action: string, payload?: Record<string, unknown>, success?: string) => Promise<T | null>;
export type TabProps = { p: ProjectDetail; run: RunFn; busy: string | null; reload: () => Promise<unknown> };

/** Calls POST /projects/:id/action, toasts the outcome and revalidates dependent views. Returns null on failure. */
export function useProjectAction(projectId: string, reload: () => Promise<unknown>) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback<RunFn>(
    async (action, payload = {}, success) => {
      setBusy(action);
      try {
        const res = await api.action(projectId, action, payload);
        if (success) toast.success(success);
        await reload();
        refresh('/projects', '/dashboard', '/schedule', '/activities', '/notes');
        return res;
      } catch (err) {
        toast.error(errorMessage(err));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [projectId, reload],
  );
  return { run, busy };
}
