'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, BellOff, Boxes, Briefcase, CalendarDays, CheckCheck, CreditCard, FileText, Mail, MailOpen, MessageSquare, Ruler, Sparkles, Star, Trash2, UserPlus, Workflow, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, timeAgo, todayStr, addDays } from '@/lib/format';
import type { Activity } from '@/lib/types';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Tabs, cn, useConfirm } from '@/components/ui';

const TYPE_ICON: Record<string, LucideIcon> = {
  lead: UserPlus, contact: UserPlus, proposal: FileText, payment: CreditCard, invoice: CreditCard, appointment: CalendarDays, shop: CalendarDays, measurement: Ruler,
  inventory: Boxes, automation: Workflow, message: MessageSquare, review: Star, stage: Sparkles, project: Briefcase, install: Sparkles, file: FileText, film: Sparkles,
};

export default function NotificationsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { data, error, isLoading, mutate } = useApi<Activity[]>('/activities?limit=200');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => (data || []).filter((a) => filter === 'all' || !a.read), [data, filter]);
  const unread = (data || []).filter((a) => !a.read).length;

  const groups = useMemo(() => {
    const today = todayStr();
    const yesterday = addDays(today, -1);
    const map = new Map<string, Activity[]>();
    for (const a of list) {
      const d = todayStr(new Date(a.createdAt));
      const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
      map.set(label, [...(map.get(label) || []), a]);
    }
    return Array.from(map.entries());
  }, [list]);

  const setRead = async (a: Activity, read: boolean) => {
    mutate((cur) => cur?.map((x) => (x._id === a._id ? { ...x, read } : x)), { revalidate: false });
    try {
      await api.patch(`/activities/${a._id}`, { read });
    } catch (err) {
      toast.error(errorMessage(err));
      mutate();
    }
  };

  const remove = async (a: Activity) => {
    mutate((cur) => cur?.filter((x) => x._id !== a._id), { revalidate: false });
    try {
      await api.del(`/activities/${a._id}`);
      toast('Notification deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post('/activities', { type: a.type, title: a.title, text: a.text, projectId: a.projectId, link: a.link, read: a.read });
              mutate();
            } catch (err) {
              toast.error(errorMessage(err));
            }
          },
        },
      });
    } catch (err) {
      toast.error(errorMessage(err));
      mutate();
    }
  };

  const bulk = async (action: 'readAll' | 'deleteAll') => {
    if (action === 'deleteAll' && !(await confirm({ title: 'Delete all notifications?', description: 'This clears the activity feed for everyone. Projects, payments and history stay untouched.', confirmLabel: 'Delete all', danger: true }))) return;
    setBusy(true);
    try {
      await api.post('/ops/activities/all', { action });
      toast.success(action === 'readAll' ? 'All notifications marked as read' : 'All notifications deleted');
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const open = (a: Activity) => {
    if (!a.read) setRead(a, true);
    if (a.link) router.push(a.link);
  };

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={Bell}
        eyebrow="Activity"
        title="Notifications"
        subtitle="New leads, bookings, proposals and payments appear here as your team works."
        actions={
          <>
            <Button variant="outline" icon={CheckCheck} disabled={!unread || busy} onClick={() => bulk('readAll')}>
              Read all
            </Button>
            <Button variant="ghost" icon={Trash2} className="text-danger" disabled={!(data || []).length || busy} onClick={() => bulk('deleteAll')}>
              Delete all
            </Button>
          </>
        }
      />
      <Tabs
        className="mb-5 w-fit"
        layoutId="notif-tabs"
        tabs={[
          { key: 'all', label: 'All', count: (data || []).length },
          { key: 'unread', label: 'Unread', count: unread },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {isLoading && !data ? (
        <PageLoader />
      ) : !list.length ? (
        <Card>
          <EmptyState
            icon={filter === 'unread' ? CheckCheck : BellOff}
            title={filter === 'unread' ? 'All caught up' : 'No notifications'}
            description={filter === 'unread' ? "You've read every update. View all to revisit your activity." : 'New leads, bookings, proposals and payments will appear here as you work.'}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <section key={label}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-fg">{label}</p>
              <Card className="divide-y divide-line overflow-hidden">
                <AnimatePresence initial={false}>
                  {items.map((a) => {
                    const Icon = TYPE_ICON[a.type] || Bell;
                    return (
                      <motion.div key={a._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className={cn('group flex items-start gap-3 px-4 py-3.5 transition hover:bg-muted/50', !a.read && 'bg-primary/[0.04]')}>
                        <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', a.read ? 'bg-muted text-muted-fg' : 'bg-primary/10 text-primary')}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <button type="button" onClick={() => open(a)} className="min-w-0 flex-1 text-left">
                          <p className={cn('text-sm', a.read ? 'font-medium' : 'font-bold')}>
                            {a.title}
                            {!a.read ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" /> : null}
                          </p>
                          {a.text ? <p className="truncate text-sm text-muted-fg">{a.text}</p> : null}
                          <p className="mt-0.5 text-xs text-muted-fg/80">{timeAgo(a.createdAt)}</p>
                        </button>
                        <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                          <button type="button" aria-label={a.read ? 'Mark unread' : 'Mark as read'} title={a.read ? 'Mark unread' : 'Mark as read'} onClick={() => setRead(a, !a.read)} className="rounded-lg p-1.5 text-muted-fg hover:bg-card hover:text-fg">
                            {a.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                          </button>
                          <button type="button" aria-label="Delete notification" title="Delete notification" onClick={() => remove(a)} className="rounded-lg p-1.5 text-muted-fg hover:bg-danger/10 hover:text-danger">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
