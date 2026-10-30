'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, CalendarRange, ChevronLeft, ChevronRight, Clock, Gauge, MoreHorizontal, Pencil, Phone, Plus, Power, RadioTower, Star, Trash2, UserPlus, Users, ZoomIn, ZoomOut, LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi, useStaff, useStores } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { addDays, fmtDate, fmtTime, minutesBetween, todayStr } from '@/lib/format';
import type { ScheduleItem, Staff, Store } from '@/lib/types';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Menu, MenuItem, PageHeader, PageLoader, Progress, SearchInput, Select, StatCard, Tabs, cn, useConfirm } from '@/components/ui';
import { StaffModal } from '@/components/team/staff-modal';
import { mondayOf } from '@/components/schedule/layout';

type Tab = 'members' | 'workload' | 'dispatch';

export default function TeamPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TeamInner />
    </Suspense>
  );
}

function TeamInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>('members');
  const { data: staff, error, mutate } = useStaff();
  const { data: stores } = useStores();
  const [editing, setEditing] = useState<Staff | null | undefined>(undefined);
  const focus = params.get('member');

  useEffect(() => {
    if (focus && staff) {
      setTab('members');
      setTimeout(() => document.getElementById(`member-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [focus, staff]);

  return (
    <div>
      <PageHeader
        icon={Users}
        eyebrow="My team & operations"
        title="Team"
        subtitle="Manage team members, monitor real-time installer workload capacity, and track live job dispatches across every store."
        actions={<Button icon={UserPlus} onClick={() => setEditing(null)}>Add team member</Button>}
      />
      <Tabs
        className="mb-5 w-fit"
        layoutId="team-tabs"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'members', label: 'Team members', icon: Users, count: (staff || []).length },
          { key: 'workload', label: 'Workload capacity', icon: Gauge },
          { key: 'dispatch', label: 'Live dispatch', icon: RadioTower },
        ]}
      />
      {error ? <ErrorState error={error} onRetry={() => mutate()} /> : !staff ? <PageLoader /> : tab === 'members' ? <Members staff={staff} stores={stores || []} focus={focus} onEdit={setEditing} /> : tab === 'workload' ? <Workload staff={staff} stores={stores || []} /> : <Dispatch staff={staff} stores={stores || []} />}
      <StaffModal open={editing !== undefined} member={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
}

/* ------------------------------------------------------------ Members */
function Members({ staff, stores, focus, onEdit }: { staff: Staff[]; stores: Store[]; focus: string | null; onEdit: (s: Staff) => void }) {
  const { storeId: scope } = useStoreScope();
  const [store, setStore] = useState<string | null>(null);
  const storeId = store ?? scope;
  const [q, setQ] = useState('');
  const confirm = useConfirm();
  const today = todayStr();
  const { data: upcoming } = useApi<ScheduleItem[]>(`/schedule?from=${today}&to=${addDays(today, 13)}`);

  const list = staff.filter((s) => (!storeId || String(s.storeId) === storeId) && (!q || [s.name, s.title, ...(s.skills || [])].join(' ').toLowerCase().includes(q.toLowerCase())));
  const nextJob = (id: string) => (upcoming || []).find((i) => (String(i.installerId) === id || i.coInstallers.some((c) => c._id === id)) && i.status !== 'completed');
  const weekDone = (id: string) => (upcoming || []).filter((i) => String(i.installerId) === id && i.status === 'completed').length;

  const toggleActive = async (s: Staff) => {
    try {
      await api.patch(`/staff/${s._id}`, { active: !s.active });
      toast.success(s.active ? `${s.name} marked inactive` : `${s.name} reactivated`);
      refresh('/staff');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (s: Staff) => {
    const ok = await confirm({ title: `Delete ${s.name}?`, description: 'Team members with appointments or projects cannot be deleted — mark them inactive instead.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.del(`/staff/${s._id}`);
      toast.success('Team member deleted');
      refresh('/staff');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <SearchInput className="w-full sm:w-80" value={q} onChange={setQ} placeholder="Search installer by name, specialty, skill…" />
        <Select className="h-10 w-52" value={storeId} onChange={(e) => setStore(e.target.value)} aria-label="Filter store">
          <option value="">All stores ({staff.length} staff)</option>
          {stores.map((s) => <option key={s._id} value={s._id}>{s.name} ({staff.filter((x) => String(x.storeId) === s._id).length})</option>)}
        </Select>
      </Card>
      {list.length === 0 ? (
        <Card><EmptyState icon={Users} title="No team members match" description="Try another search or store." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s, k) => {
            const next = nextJob(s._id);
            const st = stores.find((x) => x._id === s.storeId);
            return (
              <motion.div key={s._id} id={`member-${s._id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.03 }}>
                <Card className={cn('relative h-full overflow-hidden p-5', !s.active && 'opacity-60', focus === s._id && 'ring-2 ring-primary')}>
                  <div className="absolute inset-x-0 top-0 h-16 opacity-20" style={{ background: `linear-gradient(135deg, ${s.color}, transparent)` }} />
                  <div className="relative flex items-start gap-3">
                    <Avatar name={s.name} color={s.color} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold">{s.name}</p>
                      <p className="truncate text-xs text-muted-fg">{s.title || s.role}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone="primary">{st?.name || 'No store'}</Badge>
                        <Badge>{s.role}</Badge>
                        {!s.active ? <Badge tone="danger">Inactive</Badge> : null}
                      </div>
                    </div>
                    <Menu trigger={() => <button type="button" aria-label="Member actions" className="rounded-lg p-1.5 text-muted-fg hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>}>
                      {(close) => (
                        <>
                          <MenuItem icon={Pencil} onClick={() => { close(); onEdit(s); }}>Edit</MenuItem>
                          <MenuItem icon={Power} onClick={() => { close(); toggleActive(s); }}>{s.active ? 'Mark inactive' : 'Reactivate'}</MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => { close(); remove(s); }}>Delete</MenuItem>
                        </>
                      )}
                    </Menu>
                  </div>
                  {s.skills?.length ? (
                    <div className="relative mt-3 flex flex-wrap gap-1">
                      {s.skills.map((sk) => <span key={sk} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{sk}</span>)}
                    </div>
                  ) : null}
                  <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted/50 p-2"><p className="text-[10px] uppercase text-muted-fg">Rating</p><p className="flex items-center justify-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{(s.rating || 0).toFixed(1)}</p></div>
                    <div className="rounded-xl bg-muted/50 p-2"><p className="text-[10px] uppercase text-muted-fg">Hours / wk</p><p className="font-bold">{s.hoursPerWeek}</p></div>
                    <div className="rounded-xl bg-muted/50 p-2"><p className="text-[10px] uppercase text-muted-fg">Done (2 wk)</p><p className="font-bold">{weekDone(s._id)}</p></div>
                  </div>
                  <div className="relative mt-3 rounded-xl border border-line p-3 text-xs">
                    <p className="font-semibold text-muted-fg">Next job</p>
                    {next ? (
                      <Link href={`/projects/${next.projectId}`} className="mt-0.5 block truncate font-semibold hover:text-primary">
                        {fmtDate(next.date)} {fmtTime(next.start)} · {next.contact?.name || next.projectTitle}
                      </Link>
                    ) : <p className="mt-0.5 text-muted-fg">Nothing booked in the next two weeks</p>}
                  </div>
                  <div className="relative mt-3 flex gap-2">
                    {s.phone ? <a href={`tel:${s.phone}`} className="flex-1"><Button size="sm" variant="outline" icon={Phone} className="w-full">Call</Button></a> : null}
                    <Link href={`/jobs`} className="flex-1" onClick={() => { try { localStorage.setItem('totalops.myday.installer', JSON.stringify(s._id)); } catch { /* ignore */ } }}>
                      <Button size="sm" variant="ghost" icon={CalendarRange} className="w-full">Run sheet</Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ Workload */
function Workload({ staff, stores }: { staff: Staff[]; stores: Store[] }) {
  const { storeId } = useStoreScope();
  const [week, setWeek] = useState(mondayOf(todayStr()));
  const days = Array.from({ length: 7 }, (_, k) => addDays(week, k));
  const { data, error, mutate } = useApi<ScheduleItem[]>(`/schedule?from=${week}&to=${days[6]}`);
  const techs = staff.filter((s) => s.role === 'installer' && s.active && (!storeId || String(s.storeId) === storeId));

  const rows = useMemo(
    () =>
      techs.map((t) => {
        const daily = days.map((d) => (data || []).filter((i) => i.date === d && (String(i.installerId) === t._id || i.coInstallers.some((c) => c._id === t._id))).reduce((h, i) => h + minutesBetween(i.start, i.end) / 60, 0));
        const booked = daily.reduce((a, b) => a + b, 0);
        return { t, daily, booked, util: t.hoursPerWeek ? (booked / t.hoursPerWeek) * 100 : 0 };
      }).sort((a, b) => b.util - a.util),
    [techs, data, days],
  );
  const capacity = techs.reduce((t, s) => t + (s.hoursPerWeek || 0), 0);
  const booked = rows.reduce((t, r) => t + r.booked, 0);
  const util = capacity ? (booked / capacity) * 100 : 0;
  const maxDay = Math.max(8, ...rows.flatMap((r) => r.daily));

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  return (
    <>
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={() => setWeek(addDays(week, -7))}>Previous week</Button>
        <p className="px-2 font-display font-bold">Week of {fmtDate(week, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <Button size="sm" variant="ghost" iconRight={ChevronRight} onClick={() => setWeek(addDays(week, 7))}>Next week</Button>
        {week !== mondayOf(todayStr()) ? <Button size="sm" variant="outline" onClick={() => setWeek(mondayOf(todayStr()))}>Jump to current week</Button> : <Badge tone="primary">Current planning week</Badge>}
      </Card>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Total weekly capacity" value={capacity} format={(n) => `${n.toFixed(0)} h`} icon={Clock} sub={`${techs.length} technicians`} />
        <StatCard index={1} label="Hours booked" value={booked} format={(n) => `${n.toFixed(1)} h`} icon={CalendarRange} tone="info" sub="Bay & on-site appointments" />
        <StatCard index={2} label="Capacity utilisation" value={util} format={(n) => `${n.toFixed(0)}%`} icon={Gauge} tone={util > 90 ? 'danger' : util >= 70 ? 'success' : 'warning'} sub="Optimal range 70–85%" />
        <StatCard index={3} label="Open slots" value={Math.max(0, capacity - booked)} format={(n) => `${n.toFixed(0)} h`} icon={Plus} tone="success" sub="Ready for new installs" />
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="Technician load" subtitle="Weekly booked hours versus contracted hours, with a daily breakdown." />
        {rows.length === 0 ? <EmptyState icon={Users} title="No active installers" /> : null}
        <div className="overflow-x-auto">
          <table className="table-base min-w-[900px]">
            <thead>
              <tr>
                <th>Technician</th>
                <th className="w-64">Weekly booked load</th>
                {days.map((d) => <th key={d} className="text-center">{fmtDate(d, { weekday: 'short', day: 'numeric' })}</th>)}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, daily, booked: b, util: u }) => (
                <tr key={t._id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={t.name} color={t.color} size={30} />
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-fg">{stores.find((s) => s._id === t.storeId)?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Progress value={b} max={t.hoursPerWeek || 38} tone={u > 95 ? 'danger' : u >= 70 ? 'success' : 'warning'} />
                    <p className="mt-1 text-xs text-muted-fg">{b.toFixed(1)} / {t.hoursPerWeek} h · {Math.round(u)}%</p>
                  </td>
                  {daily.map((h, k) => (
                    <td key={k} className="text-center">
                      <div className="mx-auto flex h-12 w-6 items-end overflow-hidden rounded-md bg-muted">
                        <motion.div className="w-full rounded-md" style={{ background: t.color }} initial={{ height: 0 }} animate={{ height: `${(h / maxDay) * 100}%` }} transition={{ duration: 0.6, delay: k * 0.03 }} />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-fg">{h ? `${h.toFixed(1)}h` : '—'}</p>
                    </td>
                  ))}
                  <td>{u > 95 ? <Badge tone="danger">Over capacity</Badge> : u >= 70 ? <Badge tone="success">Optimal load</Badge> : u > 0 ? <Badge tone="warning">Spare capacity</Badge> : <Badge>Available</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ Dispatch */
type LiveState = 'In-shop' | 'On-site' | 'En-route' | 'Standby';
const STATE_TONE: Record<LiveState, string> = { 'In-shop': '#6366f1', 'On-site': '#10b981', 'En-route': '#f59e0b', Standby: '#94a3b8' };

function Dispatch({ staff, stores }: { staff: Staff[]; stores: Store[] }) {
  const today = todayStr();
  const { data, error, mutate } = useApi<ScheduleItem[]>(`/schedule?from=${today}&to=${today}`, { refreshInterval: 30_000 });
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState<LiveState | ''>('');
  const techs = staff.filter((s) => s.role === 'installer' && s.active);

  const live = techs.map((t) => {
    const mine = (data || []).filter((i) => String(i.installerId) === t._id || i.coInstallers.some((c) => c._id === t._id));
    const current = mine.find((i) => i.status === 'checked_in') || mine.find((i) => i.status === 'dispatched');
    const next = mine.find((i) => i.status === 'scheduled');
    const state: LiveState = !current ? 'Standby' : current.status === 'dispatched' ? 'En-route' : current.location === 'on_site' ? 'On-site' : 'In-shop';
    return { t, mine, current, next, state };
  });

  // Project store coordinates into the SVG viewport.
  const pts = stores.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number');
  const lats = pts.map((s) => s.lat!);
  const lngs = pts.map((s) => s.lng!);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const W = 800, H = 460, PAD = 80;
  const proj = (s: Store) => ({
    x: PAD + (maxLng === minLng ? 0.5 : (s.lng! - minLng) / (maxLng - minLng)) * (W - PAD * 2),
    y: PAD + (maxLat === minLat ? 0.5 : (maxLat - s.lat!) / (maxLat - minLat)) * (H - PAD * 2),
  });

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  const counts = (['In-shop', 'On-site', 'En-route', 'Standby'] as LiveState[]).map((k) => ({ k, n: live.filter((l) => l.state === k).length }));

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card className="overflow-hidden">
        <CardHeader icon={Activity} title="Real-time technician dispatch map" subtitle="Live positions by hub, on-site arrival tracking and bay installation progress." actions={
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Reset view" onClick={() => setZoom(1)}><LocateFixed className="h-4 w-4" /></Button>
          </div>
        } />
        <div className="relative overflow-hidden bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)]">
          <div className="bg-grid absolute inset-0 opacity-60" />
          <svg viewBox={`0 0 ${W} ${H}`} className="relative h-[420px] w-full" preserveAspectRatio="xMidYMid meet">
            <g style={{ transform: `scale(${zoom})`, transformOrigin: '50% 50%', transition: 'transform .4s cubic-bezier(.2,.7,.2,1)' }}>
              <path d={`M ${W * 0.08} ${H * 0.05} C ${W * 0.12} ${H * 0.4}, ${W * 0.05} ${H * 0.7}, ${W * 0.1} ${H * 0.98}`} stroke="hsl(var(--info))" strokeOpacity="0.35" strokeWidth="26" fill="none" strokeLinecap="round" />
              <text x={W * 0.03} y={H * 0.5} className="fill-info text-[11px] font-semibold" opacity={0.6} transform={`rotate(-80 ${W * 0.03} ${H * 0.5})`}>Indian Ocean coast</text>
              {pts.length > 1 ? pts.slice(1).map((s, k) => { const a = proj(pts[k]); const b = proj(s); return <line key={s._id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(var(--muted-fg))" strokeOpacity="0.25" strokeDasharray="4 6" />; }) : null}
              {pts.map((s) => {
                const p = proj(s);
                const here = live.filter((l) => String(l.t.storeId) === s._id);
                return (
                  <g key={s._id}>
                    <circle cx={p.x} cy={p.y} r={26} fill={s.color} opacity={0.12}>
                      <animate attributeName="r" values="18;34;18" dur="3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.25;0.03;0.25" dur="3s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={p.x} cy={p.y} r={10} fill={s.color} stroke="hsl(var(--card))" strokeWidth={3} />
                    <text x={p.x} y={p.y - 18} textAnchor="middle" className="fill-fg text-[13px] font-bold">{s.name} hub</text>
                    {here.map((l, k) => {
                      const angle = (k / Math.max(1, here.length)) * Math.PI * 2 - Math.PI / 2;
                      const dist = l.state === 'In-shop' || l.state === 'Standby' ? 30 : l.state === 'En-route' ? 52 : 70;
                      const x = p.x + Math.cos(angle) * dist;
                      const y = p.y + 30 + Math.sin(angle) * dist * 0.6;
                      const dim = filter && filter !== l.state;
                      return (
                        <g key={l.t._id} opacity={dim ? 0.2 : 1}>
                          <line x1={p.x} y1={p.y} x2={x} y2={y} stroke={STATE_TONE[l.state]} strokeOpacity="0.4" strokeDasharray={l.state === 'En-route' ? '3 3' : undefined} />
                          <circle cx={x} cy={y} r={11} fill={l.t.color} stroke={STATE_TONE[l.state]} strokeWidth={3} />
                          <text x={x} y={y + 3.5} textAnchor="middle" className="fill-white text-[9px] font-bold">{l.t.name.split(' ').map((n) => n[0]).join('')}</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {counts.map(({ k, n }) => (
              <button key={k} type="button" onClick={() => setFilter(filter === k ? '' : k)} className={cn('flex items-center gap-1.5 rounded-full border bg-card/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur', filter === k ? 'border-primary' : 'border-line')}>
                <span className="h-2 w-2 rounded-full" style={{ background: STATE_TONE[k] }} /> {k} · {n}
              </button>
            ))}
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title={`Today's jobs · ${(data || []).length}`} subtitle={`${fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })} · refreshes every 30s`} />
        <div className="max-h-[480px] divide-y divide-line overflow-y-auto">
          {live.filter((l) => !filter || l.state === filter).map((l) => {
            const job = l.current || l.next;
            const done = l.mine.filter((i) => i.status === 'completed').length;
            return (
              <div key={l.t._id} className="flex gap-3 p-4">
                <Avatar name={l.t.name} color={l.t.color} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{l.t.name}</p>
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: STATE_TONE[l.state] }}>{l.state}</span>
                  </div>
                  <p className="text-xs text-muted-fg">{l.t.title} · {stores.find((s) => s._id === l.t.storeId)?.name}</p>
                  {job ? (
                    <Link href={`/projects/${job.projectId}`} className="mt-1.5 block rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs hover:bg-muted">
                      <span className="font-semibold">{l.current ? 'Now' : 'Next'}: {fmtTime(job.start)}–{fmtTime(job.end)}</span> · {job.contact?.name || job.projectTitle}
                      <span className="block truncate text-muted-fg">{job.film ? `Film: ${job.film.brand} ${job.film.name}` : job.projectTitle}{job.location === 'on_site' ? ` · ${job.address || ''}` : job.bay ? ` · ${job.bay}` : ''}</span>
                    </Link>
                  ) : <p className="mt-1.5 text-xs text-muted-fg">No current active installation. Ready for dispatch or in-shop prep.</p>}
                  {l.mine.length ? <Progress className="mt-2" height={5} value={done} max={l.mine.length} tone="success" /> : null}
                  {l.mine.length ? <p className="mt-0.5 text-[10px] text-muted-fg">{done}/{l.mine.length} jobs completed today</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
