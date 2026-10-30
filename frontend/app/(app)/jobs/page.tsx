'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock, ExternalLink, Layers, LogIn, MapPin, Phone, Ruler, Truck, Wrench } from 'lucide-react';
import { useApi, useLocalState, useStaff } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { addDays, fmtDate, fmtTime, minutesBetween, todayStr, vehicleLabel } from '@/lib/format';
import type { ScheduleItem } from '@/lib/types';
import { ApptStatusBadge, SegmentBadge } from '@/components/badges';
import { Avatar, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, StatCard, cn } from '@/components/ui';
import { runVisitAction } from '@/components/schedule/visit-drawer';
import { apptTypeLabel } from '@/components/schedule/appointment-modal';

export default function MyDayPage() {
  const [installerId, setInstallerId] = useLocalState('myday.installer', '');
  const [date, setDate] = useState(todayStr());
  const { storeId } = useStoreScope();
  const { data: staff } = useStaff();
  const qs = new URLSearchParams({ from: date, to: date });
  if (installerId) qs.set('installerId', installerId);
  else if (storeId) qs.set('storeId', storeId);
  const { data, error, isLoading, mutate } = useApi<ScheduleItem[]>(`/schedule?${qs.toString()}`, { refreshInterval: 30_000 });
  const [busy, setBusy] = useState('');

  const installers = (staff || []).filter((s) => s.role === 'installer' && s.active);
  const me = installers.find((s) => s._id === installerId);
  const items = data || [];
  const stats = useMemo(
    () => ({
      total: items.length,
      ready: items.filter((i) => i.status === 'scheduled' || i.status === 'dispatched').length,
      active: items.filter((i) => i.status === 'checked_in').length,
      done: items.filter((i) => i.status === 'completed').length,
      hours: items.reduce((t, i) => t + minutesBetween(i.start, i.end), 0) / 60,
    }),
    [items],
  );

  const act = async (i: ScheduleItem, action: 'appointment.checkin' | 'appointment.complete' | 'appointment.dispatch', label: string) => {
    setBusy(`${i._id}${action}`);
    await runVisitAction(i, action, label);
    setBusy('');
    mutate();
  };

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        eyebrow="Field view"
        title={me ? `${me.name.split(' ')[0]}'s day` : 'My Day'}
        subtitle="Run sheet, check-ins and job cards for the field team."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select className="h-10 w-52" value={installerId} onChange={(e) => setInstallerId(e.target.value)} aria-label="Installer">
              <option value="">All installers (Mine: pick one)</option>
              {installers.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </Select>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Input type="date" className="h-10 w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <Button size="icon" variant="ghost" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="On the run sheet" value={stats.total} icon={ClipboardList} sub={`${stats.hours.toFixed(1)} h booked`} />
        <StatCard index={1} label="Ready to work" value={stats.ready} icon={Clock} tone="info" sub="Scheduled or dispatched" />
        <StatCard index={2} label="In progress" value={stats.active} icon={Wrench} tone="warning" sub="Checked in" />
        <StatCard index={3} label="Completed" value={stats.done} icon={CheckCircle2} tone="success" sub={fmtDate(date)} />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-56" />)}</div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No appointments assigned" description="Switch the installer filter or book an appointment in Calendar." action={<Link href="/calendar"><Button variant="outline">Open calendar</Button></Link>} />
        </Card>
      ) : (
        <div className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-0.5 before:bg-line">
          {items.map((i, k) => {
            const done = i.status === 'completed';
            const color = i.installer?.color || '#6366f1';
            return (
              <motion.div key={`${i.projectId}-${i._id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }} className="relative">
                <span className={cn('absolute -left-6 top-6 grid h-5 w-5 place-items-center rounded-full ring-4 ring-bg', done ? 'bg-success' : i.status === 'checked_in' ? 'bg-warning' : 'bg-primary')}>
                  {done ? <CheckCircle2 className="h-3 w-3 text-white" /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <Card className={cn('overflow-hidden', done && 'opacity-75')}>
                  <div className="h-1" style={{ background: color }} />
                  <div className="grid gap-4 p-5 lg:grid-cols-[180px_1fr_auto]">
                    <div>
                      <p className="font-display text-2xl font-extrabold">{fmtTime(i.start)}</p>
                      <p className="text-xs text-muted-fg">until {fmtTime(i.end)} · {(minutesBetween(i.start, i.end) / 60).toFixed(1)} h</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ApptStatusBadge status={i.status} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-muted-fg">{apptTypeLabel(i.type)}{i.bay ? ` · ${i.bay}` : ''}</p>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-bold">{i.contact?.name || 'Customer'}</p>
                        <SegmentBadge segment={i.segment} />
                        <span className="text-xs text-muted-fg">{i.projectNumber}</span>
                      </div>
                      <p className="text-sm">{i.projectTitle}</p>
                      <div className="grid gap-1.5 text-sm text-muted-fg sm:grid-cols-2">
                        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{i.address || i.store?.address || '—'}</span></span>
                        <span className="flex items-center gap-2"><Layers className="h-4 w-4 shrink-0" />{i.film ? `${i.film.brand} ${i.film.name}${i.filmShade ? ` · ${i.filmShade}%` : ''}` : 'Film not set'}</span>
                        <span className="flex items-center gap-2"><Ruler className="h-4 w-4 shrink-0" />{i.panes} panes{i.segment === 'automotive' && vehicleLabel(i.vehicle) ? ` · ${vehicleLabel(i.vehicle)}` : ''}{i.vehicle?.rego ? ` · ${i.vehicle.rego}` : ''}</span>
                        <span className="flex items-center gap-2">
                          {i.installer ? <Avatar name={i.installer.name} color={i.installer.color} size={20} /> : null}
                          {i.installer?.name || 'Unassigned'}{i.coInstallers.length ? ` + ${i.coInstallers.map((c) => c.name.split(' ')[0]).join(', ')}` : ''}
                        </span>
                      </div>
                      {i.notes ? <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{i.notes}</p> : null}
                    </div>
                    <div className="flex flex-row flex-wrap gap-2 lg:w-44 lg:flex-col">
                      {i.contact?.phone ? (
                        <a href={`tel:${i.contact.phone}`} className="flex-1 lg:flex-none"><Button className="w-full" variant="outline" icon={Phone}>Call</Button></a>
                      ) : null}
                      <a className="flex-1 lg:flex-none" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address || i.store?.address || '')}`} target="_blank" rel="noreferrer">
                        <Button className="w-full" variant="outline" icon={MapPin}>Directions</Button>
                      </a>
                      {i.status === 'scheduled' && i.location === 'on_site' ? (
                        <Button variant="secondary" icon={Truck} loading={busy === `${i._id}appointment.dispatch`} onClick={() => act(i, 'appointment.dispatch', 'Customer notified — on the way')}>On the way</Button>
                      ) : null}
                      {i.status === 'scheduled' || i.status === 'dispatched' ? (
                        <Button icon={LogIn} loading={busy === `${i._id}appointment.checkin`} onClick={() => act(i, 'appointment.checkin', 'Appointment checked in')}>Check in</Button>
                      ) : null}
                      {i.status === 'checked_in' ? (
                        <Button variant="success" icon={CheckCircle2} loading={busy === `${i._id}appointment.complete`} onClick={() => act(i, 'appointment.complete', 'Visit completed')}>Mark complete</Button>
                      ) : null}
                      <Link className="flex-1 lg:flex-none" href={`/projects/${i.projectId}?tab=measurements`}><Button className="w-full" variant="ghost" icon={Ruler}>Measurements</Button></Link>
                      <Link className="flex-1 lg:flex-none" href={`/projects/${i.projectId}`}><Button className="w-full" variant="ghost" icon={ExternalLink}>Job card</Button></Link>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
