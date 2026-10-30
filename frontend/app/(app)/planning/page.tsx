'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, CarFront, ChevronLeft, ChevronRight, Download, Expand, Gauge, MapPinned, Minimize2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api, downloadFrom, errorMessage } from '@/lib/api';
import { refresh, useApi, useStaff, useStores } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { addDays, fmtDate, fmtTime, minutesBetween, money, todayStr, vehicleLabel } from '@/lib/format';
import type { Project, ScheduleItem, Staff, Store } from '@/lib/types';
import { SegmentBadge, StageBadge } from '@/components/badges';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader, Progress, SearchInput, Segmented, Select, Skeleton, StatCard, cn, useConfirm } from '@/components/ui';
import { AppointmentModal, apptTypeLabel, type AppointmentDraft } from '@/components/schedule/appointment-modal';
import { VisitDrawer } from '@/components/schedule/visit-drawer';
import { itemColor, mondayOf } from '@/components/schedule/layout';

type Mode = 'day' | 'week';

export default function PlanningPage() {
  const { storeId: scope } = useStoreScope();
  const [mode, setMode] = useState<Mode>('week');
  const [cursor, setCursor] = useState(todayStr());
  const [segment, setSegment] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [full, setFull] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<ScheduleItem | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);
  const [dragOver, setDragOver] = useState('');
  const confirm = useConfirm();

  const { data: stores } = useStores();
  const { data: staff } = useStaff();
  const from = mode === 'day' ? cursor : mondayOf(cursor);
  const days = mode === 'day' ? [from] : Array.from({ length: 7 }, (_, k) => addDays(from, k));
  const to = days[days.length - 1];
  const { data, error, isLoading, mutate } = useApi<ScheduleItem[]>(`/schedule?from=${from}&to=${to}`, { refreshInterval: 60_000 });
  const { data: projects, mutate: mutateProjects } = useApi<Project[]>('/projects?limit=500');

  const activeStores: Store[] = useMemo(() => {
    const all = stores || [];
    const ids = picked ?? (scope ? [scope] : all.map((s) => s._id));
    return all.filter((s) => ids.includes(s._id));
  }, [stores, picked, scope]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || []).filter((i) => {
      if (segment && i.segment !== segment) return false;
      if (status && i.status !== status) return false;
      if (!activeStores.some((st) => st._id === String(i.store?._id || i.storeId))) return false;
      if (s && ![i.projectNumber, i.projectTitle, i.contact?.name, i.vehicle?.rego, i.address].filter(Boolean).join(' ').toLowerCase().includes(s)) return false;
      return true;
    });
  }, [data, segment, status, activeStores, q]);

  const installersByStore = useMemo(
    () => activeStores.map((st) => ({ store: st, people: (staff || []).filter((p) => p.role === 'installer' && p.active && String(p.storeId) === st._id) })),
    [activeStores, staff],
  );

  const cellItems = (personId: string, date: string) => items.filter((i) => i.date === date && (String(i.installer?._id || i.installerId) === personId || i.coInstallers.some((c) => c._id === personId)));
  const unassigned = items.filter((i) => !i.installerId);

  const dayHours = (st: Store) => Math.max(1, minutesBetween(st.openTime || '08:00', st.closeTime || '16:00') / 60);
  const capacity = installersByStore.reduce((t, g) => t + g.people.length * dayHours(g.store) * days.length, 0);
  const booked = items.reduce((t, i) => t + (minutesBetween(i.start, i.end) / 60) * (1 + i.coInstallers.length), 0);

  const ready = useMemo(
    () =>
      (projects || []).filter(
        (p) =>
          !p.archived &&
          (p.proposal?.status === 'approved' || p.stage === 'approval' || (['consultation', 'measurements'].includes(p.stage) && !(p.appointments || []).some((a) => a.status !== 'cancelled' && a.status !== 'completed'))) &&
          !(p.appointments || []).some((a) => a.type === 'installation' && a.status !== 'cancelled') &&
          activeStores.some((s) => s._id === p.storeId),
      ),
    [projects, activeStores],
  );

  const move = async (item: ScheduleItem, person: Staff, date: string) => {
    if (String(item.installerId) === person._id && item.date === date) return;
    const ok = await confirm({
      title: 'Move this visit?',
      description: `${item.projectNumber} · ${item.contact?.name || item.projectTitle} → ${person.name}, ${fmtDate(date)} ${fmtTime(item.start)}–${fmtTime(item.end)}. Conflicts are checked before saving.`,
      confirmLabel: 'Move visit',
    });
    if (!ok) return;
    try {
      const sameStore = String(person.storeId) === String(item.storeId);
      await api.action(item.projectId, 'appointment.save', {
        appointment: { ...item, date, installerId: person._id, storeId: person.storeId, bay: sameStore ? item.bay : '', coInstallerIds: (item.coInstallerIds || []).filter((x) => x !== person._id) },
      });
      toast.success('Plan saved. Store schedules and project history are updated.');
      mutate();
      refresh('/projects', '/dashboard');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onDrop = (e: React.DragEvent, person: Staff, date: string) => {
    e.preventDefault();
    setDragOver('');
    const key = e.dataTransfer.getData('text/plain');
    const item = items.find((i) => `${i.projectId}:${i._id}` === key);
    if (item) move(item, person, date);
  };

  const title = mode === 'day' ? fmtDate(from, { weekday: 'long', day: 'numeric', month: 'long' }) : `Week of ${fmtDate(from, { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <div className={cn(full && 'fixed inset-0 z-[60] overflow-y-auto bg-bg p-4 sm:p-6')}>
      <PageHeader
        icon={MapPinned}
        eyebrow="Total planning"
        title="Planning board"
        subtitle="Bring your people, bookings and available capacity into one clear view."
        actions={
          <>
            <Button variant="outline" icon={Download} onClick={() => downloadFrom('/export/schedule', 'schedule.csv').catch((e) => toast.error(errorMessage(e)))}>Export plan</Button>
            <Button variant="outline" icon={full ? Minimize2 : Expand} onClick={() => setFull(!full)}>{full ? 'Exit full screen' : 'Full screen'}</Button>
            <Button icon={Plus} onClick={() => setDraft({ date: mode === 'day' ? cursor : todayStr(), start: '09:00', end: '12:00' })}>Plan a job</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Scheduled visits" value={items.length} icon={MapPinned} sub={title} />
        <StatCard index={1} label="Vehicle tinting jobs" value={items.filter((i) => i.segment === 'automotive').length} icon={CarFront} tone="info" sub="Ceramic, privacy & heat rejection" />
        <StatCard index={2} label="Flat glass visits" value={items.filter((i) => i.segment !== 'automotive').length} icon={Building2} tone="accent" sub="Homes & commercial" />
        <StatCard index={3} label="Open capacity" value={Math.max(0, capacity - booked)} format={(n) => `${n.toFixed(0)} h`} icon={Gauge} tone="success" sub={`${capacity ? Math.round((booked / capacity) * 100) : 0}% utilised`} />
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous" onClick={() => setCursor(addDays(cursor, mode === 'day' ? -1 : -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" className="h-9 w-40" value={cursor} onChange={(e) => e.target.value && setCursor(e.target.value)} aria-label="Planning date" />
          <Button size="icon" variant="ghost" aria-label="Next" onClick={() => setCursor(addDays(cursor, mode === 'day' ? 1 : 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor(todayStr())}>Today</Button>
        </div>
        <Segmented size="sm" value={mode} onChange={setMode} options={[{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }]} />
        <Select className="h-9 w-40" value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Service type">
          <option value="">All services</option>
          <option value="automotive">Automotive</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
        </Select>
        <Select className="h-9 w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Job status">
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="dispatched">Dispatched</option>
          <option value="checked_in">Checked in</option>
          <option value="completed">Completed</option>
        </Select>
        <SearchInput className="w-full sm:w-64" value={q} onChange={setQ} placeholder="Find job or customer…" />
        <div className="flex w-full flex-wrap gap-1.5">
          {(stores || []).map((s) => {
            const on = activeStores.some((x) => x._id === s._id);
            return (
              <button
                key={s._id}
                type="button"
                onClick={() => {
                  const base = activeStores.map((x) => x._id);
                  const next = on ? base.filter((x) => x !== s._id) : [...base, s._id];
                  setPicked(next.length ? next : base);
                }}
                className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition', on ? 'border-transparent text-white' : 'border-line text-muted-fg hover:text-fg')}
                style={on ? { background: s.color } : undefined}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <CardHeader title="All-site planning board" subtitle="Drag a booked job to another installer or day to review the move before saving. Capacity covers home-team hours." />
          {error ? (
            <ErrorState error={error} onRetry={() => mutate()} />
          ) : isLoading && !data ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((k) => <Skeleton key={k} className="h-14" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: mode === 'day' ? 520 : 1120 }}>
                <div className="grid border-b border-line bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-fg" style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(0,1fr))` }}>
                  <div className="px-3 py-2">Store & installer</div>
                  {days.map((d) => (
                    <div key={d} className={cn('border-l border-line px-2 py-2 text-center', d === todayStr() && 'text-primary')}>{fmtDate(d)}</div>
                  ))}
                </div>
                {installersByStore.map(({ store, people }) => (
                  <div key={store._id}>
                    <div className="flex items-center gap-2 border-b border-line bg-muted/20 px-3 py-1.5 text-xs font-bold" style={{ color: store.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: store.color }} />
                      {store.name} · {people.length} installers · {store.openTime}–{store.closeTime}
                    </div>
                    {people.map((person) => {
                      const mine = items.filter((i) => String(i.installerId) === person._id || i.coInstallers.some((c) => c._id === person._id));
                      const hrs = mine.reduce((t, i) => t + minutesBetween(i.start, i.end) / 60, 0);
                      const cap = dayHours(store) * days.length;
                      const util = cap ? (hrs / cap) * 100 : 0;
                      return (
                        <div key={person._id} className="grid border-b border-line/70" style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(0,1fr))` }}>
                          <div className="flex items-center gap-2.5 px-3 py-2">
                            <Avatar name={person.name} color={person.color} size={30} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{person.name}</p>
                              <Progress value={hrs} max={cap} height={5} tone={util > 95 ? 'danger' : util > 80 ? 'warning' : 'success'} className="mt-1" />
                              <p className="mt-0.5 text-[10px] text-muted-fg">{hrs.toFixed(1)} / {cap.toFixed(0)} h · {Math.round(util)}%</p>
                            </div>
                          </div>
                          {days.map((d) => {
                            const key = `${person._id}|${d}`;
                            const list = cellItems(person._id, d);
                            return (
                              <div
                                key={d}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
                                onDragLeave={() => setDragOver((k) => (k === key ? '' : k))}
                                onDrop={(e) => onDrop(e, person, d)}
                                onDoubleClick={() => setDraft({ date: d, start: '09:00', end: '12:00', storeId: store._id, installerId: person._id })}
                                className={cn('min-h-[64px] space-y-1 border-l border-line/70 p-1 transition', dragOver === key && 'bg-primary/10 ring-2 ring-inset ring-primary/40', d === todayStr() && 'bg-primary/[0.03]')}
                              >
                                {list.map((i) => {
                                  const color = itemColor(i);
                                  const lead = String(i.installerId) === person._id;
                                  return (
                                    <button
                                      type="button"
                                      key={`${i.projectId}-${i._id}`}
                                      draggable={lead}
                                      onDragStart={(e) => e.dataTransfer.setData('text/plain', `${i.projectId}:${i._id}`)}
                                      onClick={() => setSelected(i)}
                                      className={cn('block w-full rounded-lg border-l-[3px] px-1.5 py-1 text-left text-[11px] shadow-sm transition hover:scale-[1.02]', lead ? 'cursor-grab active:cursor-grabbing' : 'opacity-70', i.status === 'completed' && 'opacity-60')}
                                      style={{ borderColor: color, background: `${color}1f` }}
                                      title={lead ? 'Drag to reschedule' : 'Assisting on this job'}
                                    >
                                      <p className="truncate font-semibold" style={{ color }}>{fmtTime(i.start)}–{fmtTime(i.end)}</p>
                                      <p className="truncate font-medium text-fg">{i.contact?.name || i.projectTitle}</p>
                                      <p className="truncate text-muted-fg">{apptTypeLabel(i.type)}{lead ? '' : ' · assist'}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {people.length === 0 ? <p className="border-b border-line px-3 py-3 text-xs text-muted-fg">No installers at this store.</p> : null}
                  </div>
                ))}
                {unassigned.length ? (
                  <div className="border-b border-line bg-warning/5 p-3">
                    <p className="mb-2 text-xs font-bold text-warning">Unassigned visits ({unassigned.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {unassigned.map((i) => (
                        <button
                          type="button"
                          key={`${i.projectId}-${i._id}`}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', `${i.projectId}:${i._id}`)}
                          onClick={() => setSelected(i)}
                          className="cursor-grab rounded-lg border border-line bg-card px-2 py-1 text-left text-xs shadow-sm"
                        >
                          {fmtDate(i.date)} {fmtTime(i.start)} · {i.contact?.name || i.projectTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {installersByStore.length === 0 ? <EmptyState icon={MapPinned} title="Select stores to compare schedules" /> : null}
              </div>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader icon={Sparkles} title={`Ready to plan · ${ready.length}`} subtitle="Approved jobs and site visits without an active booking." />
          <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
            {ready.length === 0 ? <EmptyState title="Every active project has a booking" description="Your team is ready." /> : null}
            {ready.map((p, k) => (
              <motion.div key={p._id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.03 }} className="rounded-xl border border-line p-3 transition hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.contact?.name || p.title}</p>
                    <p className="truncate text-xs text-muted-fg">{p.number} · {p.segment === 'automotive' ? vehicleLabel(p.vehicle) || p.title : p.title}</p>
                  </div>
                  <Badge tone="accent">{money(p.value, { cents: false })}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1"><StageBadge stage={p.stage} /><SegmentBadge segment={p.segment} /></div>
                  <Button
                    size="xs"
                    onClick={() => setDraft({ projectId: p._id, type: p.proposal?.status === 'approved' ? 'installation' : p.stage === 'consultation' ? 'consultation' : 'measurement', date: mode === 'day' ? cursor : todayStr(), start: '09:00', end: '12:00', storeId: p.storeId })}
                  >
                    Schedule
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <AppointmentModal open={!!draft} initial={draft} onClose={() => setDraft(null)} onSaved={() => { mutate(); mutateProjects(); }} />
      <VisitDrawer item={selected} onClose={() => { setSelected(null); mutate(); }} onEdit={(i) => { setSelected(null); setDraft({ ...i, projectId: String(i.projectId) }); }} />
    </div>
  );
}
