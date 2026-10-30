'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, BadgeDollarSign, Banknote, Boxes, Briefcase, CalendarCheck, CarFront, CheckCircle2, Clock, FileText, Inbox, MessageSquareReply,
  PackageOpen, Sparkles, TrendingUp, UserPlus, Users, Wand2,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '@/lib/hooks';
import { useAuth, useStoreScope } from '@/components/providers';
import { money, num, timeAgo, fmtTime, vehicleLabel, SEGMENT_META, STAGES } from '@/lib/format';
import { tooltipStyle, useChartColors } from '@/lib/chart-colors';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Progress, Segmented, Skeleton, StatCard, cn } from '@/components/ui';
import { ApptStatusBadge } from '@/components/badges';
import type { Segment } from '@/lib/types';

type Dash = {
  kpis: {
    revenue: number; revenuePrev: number; received: number; receivedPrev: number; activeProjects: number; activeBySegment: Record<Segment, number>;
    outstanding: { amount: number; count: number; overdueCount: number; avgDaysOverdue: number }; proposalsAwaiting: { count: number; value: number };
    pipelineValue: number; newLeadsToday: number; newLeadsWeek: number; bookedToday: number; conversionRate: number;
  };
  revenueTrend: { key: string; label: string; revenue: number; received: number; jobs: number }[];
  quarterly: { label: string; revenue: number }[];
  jobsBySegment: { segment: Segment; count: number }[];
  revenueBySegment: { segment: Segment; value: number }[];
  stageCounts: { stage: string; label: string; count: number; value: number }[];
  leadSources: { source: string; count: number; won: number; value: number }[];
  today: any[];
  workload: { _id: string; name: string; title?: string; color: string; store: string; hoursBooked: number; capacity: number; utilisation: number; jobsToday: number }[];
  lowStock: { _id: string; name: string; brand?: string; remainingM2: number; reorderAtM2: number; reorderPending: boolean; store: string }[];
  actions: { kind: string; severity: 'high' | 'medium' | 'low'; title: string; detail: string; link: string }[];
  tasks: { _id: string; text: string; assignedTo?: string; dueDate?: string }[];
  recentActivity: { _id: string; title: string; text?: string; link?: string; createdAt: string; type: string }[];
};

const RANGES = [
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '12 months' },
] as const;

const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
const ACTION_ICON: Record<string, any> = { overdue: Banknote, proposal: FileText, schedule: CalendarCheck, lead: UserPlus, reply: MessageSquareReply, stock: PackageOpen };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const { admin } = useAuth();
  const { storeId } = useStoreScope();
  const [range, setRange] = useState<'30' | '90' | '365'>('30');
  const { data, error, isLoading, mutate } = useApi<Dash>(`/dashboard?range=${range}${storeId ? `&storeId=${storeId}` : ''}`, { refreshInterval: 60_000 });

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;
  const k = data?.kpis;
  const moneyFmt = (n: number) => money(n, { cents: false });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-line bg-[#0d0d22] p-6 text-white shadow-lift sm:p-8">
        <div className="bg-grid absolute inset-0 opacity-30" />
        <motion.div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-600/40 blur-3xl" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-500/40 blur-3xl" animate={{ x: [0, 40, 0] }} transition={{ duration: 12, repeat: Infinity }} />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {greeting()}, {(admin?.name || 'there').split(' ')[0]} <span className="inline-block animate-floaty">👋</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Here&apos;s what&apos;s happening with your tinting business today
              {k ? (
                <>
                  {' '}— <b className="text-white">{k.bookedToday}</b> jobs booked, <b className="text-white">{k.proposalsAwaiting.count}</b> proposals awaiting approval and{' '}
                  <b className="text-white">{money(k.outstanding.amount, { cents: false })}</b> outstanding.
                </>
              ) : (
                '.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/visualizer">
              <Button variant="accent" icon={Wand2}>
                3D Visualizer
              </Button>
            </Link>
            <Link href="/advisor">
              <Button className="bg-white/10 text-white shadow-none ring-1 ring-white/20 hover:bg-white/20" icon={Sparkles}>
                Smart Advisor
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Business overview</h2>
        <Segmented options={RANGES.map((r) => ({ key: r.key, label: r.label }))} value={range} onChange={setRange} />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !k ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)
        ) : (
          <>
            <StatCard index={0} label="Revenue (invoiced)" value={k.revenue} format={moneyFmt} icon={TrendingUp} tone="primary" delta={delta(k.revenue, k.revenuePrev)} sub="vs previous period" />
            <StatCard index={1} label="Collected" value={k.received} format={moneyFmt} icon={BadgeDollarSign} tone="success" delta={delta(k.received, k.receivedPrev)} sub="payments received" />
            <StatCard
              index={2}
              label="Active projects"
              value={k.activeProjects}
              icon={Briefcase}
              tone="info"
              sub={
                <span className="flex gap-2">
                  {(['automotive', 'residential', 'commercial'] as Segment[]).map((s) => (
                    <span key={s} title={SEGMENT_META[s].label}>
                      {SEGMENT_META[s].label.slice(0, 4)} <b className="text-fg">{k.activeBySegment[s] || 0}</b>
                    </span>
                  ))}
                </span>
              }
            />
            <StatCard index={3} label="Outstanding payments" value={k.outstanding.amount} format={moneyFmt} icon={AlertTriangle} tone="danger" sub={`${k.outstanding.count} invoices · ${k.outstanding.overdueCount} overdue${k.outstanding.avgDaysOverdue ? ` (avg ${k.outstanding.avgDaysOverdue}d)` : ''}`} />
            <StatCard index={4} label="Proposals awaiting" value={k.proposalsAwaiting.count} icon={FileText} tone="warning" sub={`${money(k.proposalsAwaiting.value, { cents: false })} in play`} />
            <StatCard index={5} label="Pipeline value" value={k.pipelineValue} format={moneyFmt} icon={Sparkles} tone="accent" sub={`${k.conversionRate}% conversion`} />
            <StatCard index={6} label="Booked today" value={k.bookedToday} icon={CalendarCheck} tone="primary" sub="appointments on the run sheet" />
            <StatCard index={7} label="New leads" value={k.newLeadsWeek} icon={UserPlus} tone="success" sub={`${k.newLeadsToday} today · last 7 days`} />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <RevenueTrend data={data} />
        <SegmentMix data={data} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ActionCentre data={data} />
        <TodaySchedule data={data} />
        <RecentActivity data={data} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <StageFunnel data={data} />
        <Workload data={data} />
        <div className="space-y-4">
          <LowStock data={data} />
          <LeadSources data={data} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Revenue trend */
function RevenueTrend({ data }: { data?: Dash }) {
  const c = useChartColors();
  const [mode, setMode] = useState<'monthly' | 'quarterly'>('monthly');
  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Revenue trend" subtitle="Invoiced vs collected, last 12 months" icon={TrendingUp} actions={<Segmented size="sm" options={[{ key: 'monthly', label: 'Monthly' }, { key: 'quarterly', label: 'Quarterly' }]} value={mode} onChange={setMode} />} />
      <div className="h-[300px] px-2 pb-4 pt-4">
        {!data ? (
          <Skeleton className="mx-3 h-full" />
        ) : mode === 'monthly' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.revenueTrend} margin={{ left: 8, right: 16, top: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.series[0]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c.series[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => money(v, { compact: true, cents: false })} width={64} />
              <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [money(v), n === 'revenue' ? 'Invoiced' : 'Collected']} />
              <Legend verticalAlign="top" align="right" height={28} iconType="circle" formatter={(v) => <span className="text-xs text-muted-fg">{v === 'revenue' ? 'Invoiced' : 'Collected'}</span>} />
              <Area type="monotone" dataKey="revenue" stroke={c.series[0]} strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }} animationDuration={900} />
              <Area type="monotone" dataKey="received" stroke={c.series[1]} strokeWidth={2} fill="transparent" strokeDasharray="5 4" activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }} animationDuration={1100} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.quarterly} margin={{ left: 8, right: 16, top: 20 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => money(v, { compact: true, cents: false })} width={64} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: number) => [money(v), 'Invoiced']} />
              <Bar dataKey="revenue" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={56} animationDuration={900}>
                <LabelList dataKey="revenue" position="top" formatter={(v: number) => money(v, { compact: true, cents: false })} className="fill-[hsl(var(--muted-fg))] text-[11px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Segment mix */
function SegmentMix({ data }: { data?: Dash }) {
  const c = useChartColors();
  const [view, setView] = useState<'jobs' | 'revenue'>('jobs');
  const rows = useMemo(() => {
    if (!data) return [];
    return view === 'jobs'
      ? data.jobsBySegment.map((r) => ({ key: r.segment, name: SEGMENT_META[r.segment].label, value: r.count }))
      : data.revenueBySegment.map((r) => ({ key: r.segment, name: SEGMENT_META[r.segment].label, value: r.value }));
  }, [data, view]);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const fmt = (v: number) => (view === 'jobs' ? num(v) : money(v, { cents: false }));
  return (
    <Card>
      <CardHeader title={view === 'jobs' ? 'Active jobs by segment' : 'Revenue by segment'} subtitle={view === 'jobs' ? 'Open projects right now' : 'Invoiced in this period'} icon={CarFront} actions={<Segmented size="sm" options={[{ key: 'jobs', label: 'Jobs' }, { key: 'revenue', label: 'Revenue' }]} value={view} onChange={setView} />} />
      <div className="p-4">
        {!data ? (
          <Skeleton className="h-60" />
        ) : total === 0 ? (
          <EmptyState icon={Inbox} title="Nothing yet" description="Data appears here as projects move through the workflow." />
        ) : (
          <>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [fmt(v), n]} />
                  <Pie data={rows} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke={c.surface} strokeWidth={2} animationDuration={900}>
                    {rows.map((r) => (
                      <Cell key={r.key} fill={c.segment[r.key as Segment]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="font-display text-2xl font-extrabold">{view === 'jobs' ? num(total) : money(total, { compact: true, cents: false })}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-fg">Total</p>
                </div>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.segment[r.key as Segment] }} />
                  <span className="flex-1 text-muted-fg">{r.name}</span>
                  <span className="font-semibold">{fmt(r.value)}</span>
                  <span className="w-10 text-right text-xs text-muted-fg">{total ? Math.round((r.value / total) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Action centre */
function ActionCentre({ data }: { data?: Dash }) {
  const sev = { high: 'bg-danger/10 text-danger', medium: 'bg-warning/15 text-warning', low: 'bg-info/10 text-info' };
  return (
    <Card>
      <CardHeader title="Action centre" subtitle="What needs your attention" icon={AlertTriangle} actions={data ? <Badge tone={data.actions.length ? 'danger' : 'success'}>{data.actions.length}</Badge> : null} />
      <div className="max-h-[380px] space-y-1 overflow-y-auto p-2">
        {!data ? (
          <Skeleton className="m-2 h-48" />
        ) : data.actions.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="You're all caught up" description="No overdue invoices, stale proposals or unbooked approvals." />
        ) : (
          data.actions.map((a, i) => {
            const Icon = ACTION_ICON[a.kind] || AlertTriangle;
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={a.link} className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-muted">
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', sev[a.severity])}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{a.title}</span>
                    <span className="block truncate text-xs text-muted-fg">{a.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 text-muted-fg opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              </motion.div>
            );
          })
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Today's schedule */
function TodaySchedule({ data }: { data?: Dash }) {
  return (
    <Card>
      <CardHeader title="Today's schedule" subtitle="Run sheet across stores" icon={Clock} actions={<Link href="/calendar" className="text-xs font-semibold text-primary hover:underline">View calendar</Link>} />
      <div className="max-h-[380px] overflow-y-auto p-4">
        {!data ? (
          <Skeleton className="h-48" />
        ) : data.today.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No visits scheduled" description="Book appointments from a project or the calendar." />
        ) : (
          <ol className="relative space-y-4 border-l border-line pl-5">
            {data.today.map((a, i) => (
              <motion.li key={a._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="relative">
                <span className={cn('absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-card', a.status === 'completed' ? 'bg-success' : a.status === 'checked_in' ? 'bg-primary' : 'bg-muted-fg/50')} />
                <Link href={`/projects/${a.projectId}`} className="block rounded-xl p-2 -m-2 transition hover:bg-muted">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-primary">
                      {fmtTime(a.start)} – {fmtTime(a.end)}
                    </p>
                    <ApptStatusBadge status={a.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold">{a.contact?.name || a.projectTitle}</p>
                  <p className="truncate text-xs text-muted-fg">
                    {a.segment === 'automotive' ? vehicleLabel(a.vehicle) || a.projectTitle : a.projectTitle} · {a.store}
                    {a.installer ? ` · ${a.installer}` : ''}
                  </p>
                </Link>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Recent activity */
function RecentActivity({ data }: { data?: Dash }) {
  return (
    <Card>
      <CardHeader title="Recent activity" subtitle="Live feed from the workspace" icon={Sparkles} actions={<Link href="/notifications" className="text-xs font-semibold text-primary hover:underline">View all</Link>} />
      <div className="max-h-[380px] overflow-y-auto p-2">
        {!data ? (
          <Skeleton className="m-2 h-48" />
        ) : data.recentActivity.length === 0 ? (
          <EmptyState icon={Inbox} title="No activity yet" />
        ) : (
          data.recentActivity.map((a, i) => (
            <motion.div key={a._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
              <Link href={a.link || '/notifications'} className="flex gap-3 rounded-xl p-2.5 transition hover:bg-muted">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.title}</span>
                  {a.text ? <span className="block truncate text-xs text-muted-fg">{a.text}</span> : null}
                </span>
                <span className="shrink-0 text-[11px] text-muted-fg">{timeAgo(a.createdAt)}</span>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Stage funnel */
function StageFunnel({ data }: { data?: Dash }) {
  const c = useChartColors();
  const rows = (data?.stageCounts || []).map((s) => ({ ...s, label: STAGES.find((x) => x.key === s.stage)?.label || s.label }));
  return (
    <Card>
      <CardHeader title="Projects by stage" subtitle="Count of projects in each workflow stage" icon={Briefcase} actions={<Link href="/pipeline" className="text-xs font-semibold text-primary hover:underline">Open pipeline</Link>} />
      <div className="h-[330px] p-3">
        {!data ? (
          <Skeleton className="h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
              <CartesianGrid stroke={c.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={96} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: number, _n, p: any) => [`${v} projects · ${money(p.payload.value, { cents: false })}`, 'Stage']} />
              <Bar dataKey="count" fill={c.series[0]} radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={900}>
                <LabelList dataKey="count" position="right" className="fill-[hsl(var(--fg))] text-[11px] font-semibold" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Installer workload */
function Workload({ data }: { data?: Dash }) {
  return (
    <Card>
      <CardHeader title="Installer workload" subtitle="Hours booked this week vs capacity" icon={Users} actions={<Link href="/team" className="text-xs font-semibold text-primary hover:underline">My team</Link>} />
      <div className="max-h-[330px] space-y-3 overflow-y-auto p-4">
        {!data ? (
          <Skeleton className="h-60" />
        ) : data.workload.length === 0 ? (
          <EmptyState icon={Users} title="No installers yet" />
        ) : (
          data.workload.map((w) => (
            <div key={w._id} className="flex items-center gap-3">
              <Avatar name={w.name} color={w.color} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{w.name}</span>
                  <span className="shrink-0 text-xs text-muted-fg">
                    {w.hoursBooked}h / {w.capacity}h
                  </span>
                </div>
                <Progress value={w.hoursBooked} max={w.capacity} tone={w.utilisation > 95 ? 'danger' : w.utilisation >= 70 ? 'success' : 'info'} height={6} className="mt-1" />
                <p className="mt-0.5 text-[11px] text-muted-fg">
                  {w.store} · {w.jobsToday} today · {w.utilisation}% utilised
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Low stock */
function LowStock({ data }: { data?: Dash }) {
  return (
    <Card>
      <CardHeader title={`Low stock${data ? ` (${data.lowStock.length})` : ''}`} subtitle="Rolls at or below reorder point" icon={Boxes} actions={<Link href="/inventory" className="text-xs font-semibold text-primary hover:underline">Inventory</Link>} />
      <div className="space-y-2 p-4">
        {!data ? (
          <Skeleton className="h-24" />
        ) : data.lowStock.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-fg">All film rolls are above their reorder point.</p>
        ) : (
          data.lowStock.map((r) => (
            <div key={r._id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-2.5">
              <PackageOpen className="h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {r.brand} {r.name}
                </p>
                <p className="text-xs text-muted-fg">
                  {r.remainingM2} m² left · {r.store}
                </p>
              </div>
              {r.reorderPending ? <Badge tone="success">Ordered ✓</Badge> : <Badge tone="warning">Reorder</Badge>}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Lead sources */
function LeadSources({ data }: { data?: Dash }) {
  const max = Math.max(1, ...(data?.leadSources || []).map((s) => s.count));
  return (
    <Card>
      <CardHeader title="Lead sources" subtitle="Leads and won jobs per channel" icon={UserPlus} />
      <div className="space-y-2.5 p-4">
        {!data ? (
          <Skeleton className="h-24" />
        ) : (
          data.leadSources.slice(0, 6).map((s) => (
            <div key={s.source}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-fg">{s.source}</span>
                <span className="font-semibold">
                  {s.count} <span className="text-xs font-normal text-muted-fg">· {s.won} won</span>
                </span>
              </div>
              <Progress value={s.count} max={max} height={6} className="mt-1" />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
