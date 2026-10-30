'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CarFront, CheckCircle2, ChevronLeft, ChevronRight, Copy, ExternalLink, Eye, Hourglass, Plus, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi, useDealers, useStores } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { SHOP_STATUS, addDays, fmtDate, fmtTime, timeAgo, todayStr, vehicleLabel } from '@/lib/format';
import type { ScheduleItem } from '@/lib/types';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, StatCard, cn } from '@/components/ui';
import { AppointmentModal, type AppointmentDraft } from '@/components/schedule/appointment-modal';

const FLOW = ['booked', 'arrived', 'in_bay', 'installing', 'ready', 'collected'] as const;
const FLOW_CLS: Record<string, string> = {
  booked: 'bg-slate-500',
  arrived: 'bg-info',
  in_bay: 'bg-primary',
  installing: 'bg-warning',
  ready: 'bg-success',
  collected: 'bg-slate-400',
};

export default function ShopDayPage() {
  const { storeId: scope } = useStoreScope();
  const [store, setStore] = useState<string | null>(null);
  const storeId = store ?? scope;
  const [date, setDate] = useState(todayStr());
  const [account, setAccount] = useState('all');
  const { data: stores } = useStores();
  const { data: dealers } = useDealers();
  const qs = new URLSearchParams({ from: date, to: date });
  if (storeId) qs.set('storeId', storeId);
  const { data, error, isLoading, mutate, isValidating } = useApi<ScheduleItem[]>(`/schedule?${qs.toString()}`, { refreshInterval: 30_000 });
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);
  const [synced, setSynced] = useState<string>(new Date().toISOString());

  const all = useMemo(() => (data || []).filter((i) => i.segment === 'automotive'), [data]);
  const rows = useMemo(() => {
    const list = all.filter((i) => account === 'all' || (account === 'retail' ? !i.dealerName : i.dealerName === account));
    return [...list].sort((a, b) => a.start.localeCompare(b.start) || (a.bay || '').localeCompare(b.bay || ''));
  }, [all, account]);

  const counts = {
    total: all.length,
    inBay: all.filter((i) => i.shopStatus === 'in_bay' || i.shopStatus === 'installing').length,
    queued: all.filter((i) => i.shopStatus === 'booked' || i.shopStatus === 'arrived').length,
    ready: all.filter((i) => i.shopStatus === 'ready').length,
  };

  const setStatus = async (i: ScheduleItem, s: string) => {
    if (i.shopStatus === s) return;
    setBusy(`${i._id}${s}`);
    try {
      await api.action(i.projectId, 'appointment.shopStatus', { appointmentId: i._id, shopStatus: s });
      toast.success(`${vehicleLabel(i.vehicle) || i.projectNumber} → ${SHOP_STATUS[s]?.label}`);
      await mutate();
      setSynced(new Date().toISOString());
      refresh('/projects', '/dashboard');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const dealerLink = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/dealer/${token}`;
  const copy = async (token: string, name: string) => {
    try {
      await navigator.clipboard.writeText(dealerLink(token));
      toast.success(`Live dealer link for ${name} copied`);
    } catch {
      toast.message('Copy this link', { description: dealerLink(token) });
    }
  };

  const visibleDealers = (dealers || []).filter((d) => d.active !== false && (!storeId || !d.storeId || d.storeId === storeId));

  return (
    <div>
      <PageHeader
        icon={CarFront}
        eyebrow="Automotive day shop"
        title="Auto Shop Day"
        subtitle="High-volume automotive run sheet with live dealership portal sync."
        actions={
          <>
            <Button variant="outline" icon={RefreshCw} loading={isValidating} onClick={async () => { await mutate(); setSynced(new Date().toISOString()); }}>
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => setDraft({ date, start: '08:30', end: '11:30', type: 'installation', storeId: storeId || undefined })}>
              Book vehicle
            </Button>
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" className="h-9 w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <Button size="icon" variant="ghost" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
          {date !== todayStr() ? <Button size="sm" variant="ghost" onClick={() => setDate(todayStr())}>Today</Button> : null}
        </div>
        <Select className="h-9 w-44" value={storeId} onChange={(e) => setStore(e.target.value)} aria-label="Store">
          <option value="">All stores</option>
          {(stores || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </Select>
        <Select className="h-9 w-60" value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Dealership / account">
          <option value="all">All accounts (retail & dealers)</option>
          <option value="retail">Retail drop-offs</option>
          {(dealers || []).map((d) => <option key={d._id} value={d.name}>{d.name}</option>)}
        </Select>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-fg">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" /><span className="relative h-2 w-2 rounded-full bg-success" /></span>
          Live auto-sync · last synced {timeAgo(synced)}
        </span>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Vehicles booked" value={counts.total} icon={CarFront} sub={fmtDate(date)} />
        <StatCard index={1} label="In tint bay now" value={counts.inBay} icon={Wrench} tone="warning" sub="In bay or installing" />
        <StatCard index={2} label="Queued / drop-off" value={counts.queued} icon={Hourglass} tone="info" sub="Booked or arrived" />
        <StatCard index={3} label="Ready for pickup" value={counts.ready} icon={CheckCircle2} tone="success" sub="Keys at front desk" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardHeader title={`Run sheet · ${rows.length} vehicle${rows.length === 1 ? '' : 's'}`} subtitle="Tap a status to move the vehicle through the shop. Dealers see changes live." />
          {error ? (
            <ErrorState error={error} onRetry={() => mutate()} />
          ) : isLoading && !data ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-16" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={CarFront} title="No vehicles for this filter" description="Switch account or date, or book a vehicle into a bay." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[980px]">
                <thead>
                  <tr>
                    <th>Time & bay</th>
                    <th>Vehicle & rego</th>
                    <th>Account / dealer</th>
                    <th>Film package</th>
                    <th>Assigned tech(s)</th>
                    <th>One-tap shop status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map((i) => (
                      <motion.tr key={`${i.projectId}-${i._id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <td>
                          <p className="font-display font-bold">{fmtTime(i.start)}</p>
                          <p className="text-xs text-muted-fg">{i.bay || 'No bay'} · {i.store?.name}</p>
                        </td>
                        <td>
                          <Link href={`/projects/${i.projectId}`} className="font-semibold hover:text-primary">{vehicleLabel(i.vehicle) || i.projectTitle}</Link>
                          <p className="text-xs text-muted-fg">
                            {i.vehicle?.rego || 'No rego'}{i.vehicle?.color ? ` · ${i.vehicle.color}` : ''}{i.vehicle?.stockPo ? ` · PO ${i.vehicle.stockPo}` : ''}
                          </p>
                        </td>
                        <td>{i.dealerName ? <Badge tone="primary">{i.dealerName}</Badge> : <span className="text-sm text-muted-fg">Retail · {i.contact?.name}</span>}</td>
                        <td>
                          {i.film ? (
                            <span className="flex items-center gap-2">
                              <span className="h-4 w-4 rounded-md ring-1 ring-line" style={{ background: i.film.tintColor }} />
                              <span className="text-sm">{i.film.brand} {i.film.name}{i.filmShade ? ` · ${i.filmShade}%` : ''}</span>
                            </span>
                          ) : <span className="text-sm text-muted-fg">Not set</span>}
                        </td>
                        <td>
                          <div className="flex -space-x-2">
                            {[i.installer, ...i.coInstallers].filter(Boolean).map((t) => <Avatar key={t!._id} name={t!.name} color={t!.color} size={28} />)}
                            {!i.installer ? <span className="text-sm text-muted-fg">Unassigned</span> : null}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {FLOW.map((s) => {
                              const active = i.shopStatus === s;
                              const idx = FLOW.indexOf(i.shopStatus as (typeof FLOW)[number]);
                              const past = FLOW.indexOf(s) < idx;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => setStatus(i, s)}
                                  className={cn(
                                    'relative rounded-lg px-2 py-1 text-[11px] font-semibold transition disabled:cursor-wait',
                                    active ? `${FLOW_CLS[s]} text-white shadow-sm` : past ? 'bg-muted text-muted-fg line-through decoration-muted-fg/40' : 'bg-muted/60 text-muted-fg hover:bg-muted hover:text-fg',
                                  )}
                                >
                                  {busy === `${i._id}${s}` ? '…' : SHOP_STATUS[s].label.replace(' for Pickup', '')}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Live dealer portals" subtitle="Share a read-only live view with dealership staff." />
          <div className="space-y-3 p-4">
            {visibleDealers.length === 0 ? <p className="text-sm text-muted-fg">No dealer accounts yet. Add them in Settings → Dealers.</p> : null}
            {visibleDealers.map((d) => {
              const n = all.filter((i) => i.dealerName === d.name).length;
              return (
                <div key={d._id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{d.name}</p>
                    <Badge tone={n ? 'primary' : 'neutral'}>{n} today</Badge>
                  </div>
                  <p className="text-xs text-muted-fg">{d.contactName}{d.phone ? ` · ${d.phone}` : ''}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" icon={Copy} onClick={() => copy(d.token, d.name)}>Copy live link</Button>
                    <a href={`/dealer/${d.token}`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" icon={Eye}>Preview</Button></a>
                  </div>
                </div>
              );
            })}
            <p className="flex items-center gap-1.5 text-xs text-muted-fg"><ExternalLink className="h-3.5 w-3.5" /> Links refresh automatically every 20 seconds.</p>
          </div>
        </Card>
      </div>

      <AppointmentModal open={!!draft} initial={draft} onClose={() => setDraft(null)} onSaved={() => mutate()} />
    </div>
  );
}
