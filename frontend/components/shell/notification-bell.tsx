'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';
import type { Activity } from '@/lib/types';
import { Menu, cn } from '../ui';

export function NotificationBell() {
  const router = useRouter();
  const { data, mutate } = useApi<Activity[]>('/activities?limit=12', { refreshInterval: 30_000 });
  const unread = (data || []).filter((a) => !a.read).length;
  const markAll = async () => {
    await api.post('/ops/activities/all', { action: 'readAll' }).catch(() => undefined);
    mutate();
  };
  return (
    <Menu
      width={360}
      trigger={() => (
        <button type="button" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-xl text-muted-fg transition hover:bg-muted hover:text-fg">
          <Bell className="h-[18px] w-[18px]" />
          {unread ? (
            <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-danger" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
            </span>
          ) : null}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
            <p className="font-display text-sm font-bold">Notifications {unread ? <span className="text-primary">· {unread} new</span> : null}</p>
            <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Read all
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(data || []).length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-fg">You&apos;re all caught up</p> : null}
            {(data || []).map((a, i) => (
              <motion.button
                key={a._id}
                type="button"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={async () => {
                  close();
                  if (!a.read) api.patch(`/activities/${a._id}`, { read: true }).then(() => mutate()).catch(() => undefined);
                  if (a.link) router.push(a.link);
                }}
                className="flex w-full gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted"
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.read ? 'bg-transparent' : 'bg-primary')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.title}</span>
                  {a.text ? <span className="block truncate text-xs text-muted-fg">{a.text}</span> : null}
                  <span className="text-[11px] text-muted-fg/80">{timeAgo(a.createdAt)}</span>
                </span>
              </motion.button>
            ))}
          </div>
          <Link href="/notifications" onClick={close} className="mt-1 block rounded-lg px-2.5 py-2 text-center text-xs font-semibold text-primary hover:bg-muted">
            View all notifications
          </Link>
        </div>
      )}
    </Menu>
  );
}
