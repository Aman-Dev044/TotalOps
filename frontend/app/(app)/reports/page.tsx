'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Boxes, CheckCircle2, CircleDollarSign, Download, FileSpreadsheet, Gauge, HandCoins, Ruler, Star, Table2, Target, TrendingUp, Trophy, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFrom, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { money, num, SEGMENT_META } from '@/lib/format';
import { tooltipStyle, useChartColors } from '@/lib/chart-colors';
import { useStoreScope } from '@/components/providers';
import { Avatar, Button, Card, CardHeader, ErrorState, PageHeader, Progress, Segmented, Skeleton, StatCard } from '@/components/ui';
import type { Segment } from '@/lib/types';

type Report = {
  range: string;
  metrics: { projects: number; pipelineValue: number; wonValue: number; closedJobs: number; invoiced: number; collected: number; outstanding: number; measuredAreaM2: number; stockOnHandM2: number; stockValue: number; averageJobValue: number; winRate: number };
  conversion: { step: string; count: number }[];
  byStage: { stage: string; label: string; count: number; value: number }[];
  bySegment: { segment: Segment; count: number; value: number; areaM2: number }[];
  byStore: { store: string; color: string; projects: number; invoiced: number; pipeline: number }[];
  films: { film: string; projects: number; areaM2: number }[];
  installers: { name: string; store: string; jobs: number; hours: number; value: number; rating: number }[];
};

const RANGES = [
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '12 months' },
  { key: 'all', label: 'All time' },
] as const;
const EXPORTS = [
  { kind: 'projects', label: 'Projects' },
  { kind: 'contacts', label: 'Contacts' },
  { kind: 'stock', label: 'Stock' },
  { kind: 'payments', label: 'Payments' },
  { kind: 'schedule', label: 'Schedule' },
  { kind: 'backup', label: 'Full backup (JSON)' },
];

const axisProps = (c: { axis: string }) => ({ tick: { fill: c.axis, fontSize: 11 }, tickLine: false, axisLine: false });
const moneyFmt = (n: number) => money(n, { cents: false });

export default function ReportsPage() {
  const { storeId } = useStoreScope();
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('90');
  const [view, setView] = useState<'charts' | 'table'>('charts');
  const [busy, setBusy] = useState('');
  const { data, error, isLoading, mutate } = useApi<Report>(`/reports?range=${range}${storeId ? `&storeId=${storeId}` : ''}`);
  const c = useChartColors();

  const dl = async (kind: string) => {
    setBusy(kind);
    try {
      await downloadFrom(`/export/${kind}`, `totalops-${kind}`);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  const m = data?.metrics;
  const segTotal = (data?.bySegment || []).reduce((s, x) => s + x.count, 0);
  const leads = data?.conversion[0]?.count || 0;

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        eyebrow="Analytics & exports"
        title="Reports"
        subtitle="Metrics are derived from live CRM records and can be exported as CSV."
        actions={
          <>
            <Segmented size="sm" value={range} onChange={setRange} options={RANGES.map((r) => ({ key: r.key, label: r.label }))} />
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { key: 'charts', label: <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Charts</span> },
                { key: 'table', label: <span className="flex items-center gap-1"><Table2 className="h-3.5 w-3.5" /> Tables</span> },
              ]}
            />
          </>
        }
      />

      {isLoading || !m || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard index={0} label="Pipeline value" value={m.pipelineValue} format={moneyFmt} icon={TrendingUp} />
            <StatCard index={1} label="Won value" value={m.wonValue} format={moneyFmt} icon={Trophy} tone="success" />
            <StatCard index={2} label="Closed jobs" value={m.closedJobs} icon={CheckCircle2} tone="info" />
            <StatCard index={3} label="Invoiced" value={m.invoiced} format={moneyFmt} icon={CircleDollarSign} tone="accent" />
            <StatCard index={4} label="Collected" value={m.collected} format={moneyFmt} icon={HandCoins} tone="success" />
            <StatCard index={5} label="Outstanding" value={m.outstanding} format={moneyFmt} icon={Wallet} tone="danger" sub="all open invoices" />
            <StatCard index={6} label="Measured glass" value={m.measuredAreaM2} format={(n) => `${num(n, 1)} m²`} icon={Ruler} tone="info" />
            <StatCard index={7} label="Stock on hand" value={m.stockOnHandM2} format={(n) => `${num(n, 1)} m²`} icon={Boxes} sub={`${moneyFmt(m.stockValue)} at cost`} />
            <StatCard index={8} label="Avg job value" value={m.averageJobValue} format={moneyFmt} icon={Gauge} tone="accent" />
            <StatCard index={9} label="Win rate" value={m.winRate} format={(n) => `${Math.round(n)}%`} icon={Target} tone="success" sub="approved / proposals" />
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Projects by stage" subtitle="Count of projects in each workflow stage" />
              <div className="p-4">
                {view === 'table' ? (
                  <SimpleTable head={['Stage', 'Projects', 'Value']} rows={data.byStage.map((s) => [s.label, s.count, moneyFmt(s.value)])} />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <BarChart data={data.byStage} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis dataKey="label" {...axisProps(c)} interval={0} tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)} />
                        <YAxis allowDecimals={false} {...axisProps(c)} />
                        <Tooltip {...tooltipStyle} cursor={{ fill: c.grid, opacity: 0.5 }} formatter={(v: number, _n, p: any) => [`${v} projects · ${moneyFmt(p.payload.value)}`, 'Stage']} />
                        <Bar dataKey="count" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={34} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Projects by segment" subtitle={`${segTotal} projects`} />
              <div className="p-4">
                {view === 'table' ? (
                  <SimpleTable head={['Segment', 'Projects', 'Value', 'Glass m²']} rows={data.bySegment.map((s) => [SEGMENT_META[s.segment].label, s.count, moneyFmt(s.value), num(s.areaM2, 1)])} />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={data.bySegment.filter((s) => s.count > 0)}
                          dataKey="count"
                          nameKey="segment"
                          innerRadius="55%"
                          outerRadius="80%"
                          paddingAngle={0}
                          stroke={c.surface}
                          strokeWidth={2}
                          label={({ count, percent }: any) => `${count} · ${Math.round(percent * 100)}%`}
                          labelLine={false}
                        >
                          {data.bySegment.filter((s) => s.count > 0).map((s) => (
                            <Cell key={s.segment} fill={c.segment[s.segment]} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipStyle} formatter={(v: number, n: string, p: any) => [`${v} projects · ${moneyFmt(p.payload.value)}`, SEGMENT_META[n as Segment]?.label || n]} />
                        <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs text-fg">{SEGMENT_META[v as Segment]?.label || v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader title="Store performance" subtitle="Invoiced in range vs open pipeline" />
              <div className="p-4">
                {view === 'table' ? (
                  <SimpleTable head={['Store', 'Projects', 'Invoiced', 'Pipeline']} rows={data.byStore.map((s) => [s.store, s.projects, moneyFmt(s.invoiced), moneyFmt(s.pipeline)])} />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <BarChart data={data.byStore} margin={{ top: 16, right: 8, left: 8, bottom: 0 }} barGap={2}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis dataKey="store" {...axisProps(c)} />
                        <YAxis {...axisProps(c)} tickFormatter={(v: number) => money(v, { compact: true, cents: false })} width={64} />
                        <Tooltip {...tooltipStyle} cursor={{ fill: c.grid, opacity: 0.5 }} formatter={(v: number, n: string) => [moneyFmt(v), n === 'invoiced' ? 'Invoiced' : 'Open pipeline']} />
                        <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs text-fg">{v === 'invoiced' ? 'Invoiced' : 'Open pipeline'}</span>} />
                        <Bar dataKey="invoiced" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="pipeline" fill={c.series[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Conversion funnel" subtitle="Share of leads reaching each step" />
              <div className="space-y-4 p-5">
                {data.conversion.map((s, i) => {
                  const pct = leads ? Math.round((s.count / leads) * 100) : 0;
                  return (
                    <div key={s.step} title={`${s.step}: ${s.count} (${pct}% of leads)`}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-medium">{s.step}</span>
                        <span className="tabular-nums text-muted-fg">
                          <b className="text-fg">{s.count}</b> · {pct}%
                        </span>
                      </div>
                      <Progress value={s.count} max={leads || 1} tone={i === data.conversion.length - 1 ? 'success' : 'primary'} height={10} />
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="xl:col-span-1">
              <CardHeader title="Film usage" subtitle="Measured glass area by film" />
              <div className="p-4">
                {!data.films.length ? (
                  <p className="py-10 text-center text-sm text-muted-fg">No film assigned to projects in this range.</p>
                ) : view === 'table' ? (
                  <SimpleTable head={['Film', 'Projects', 'Glass m²']} rows={data.films.map((f) => [f.film, f.projects, num(f.areaM2, 1)])} />
                ) : (
                  <div style={{ height: Math.max(200, data.films.length * 38 + 30) }}>
                    <ResponsiveContainer>
                      <BarChart data={data.films} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke={c.grid} />
                        <XAxis type="number" {...axisProps(c)} tickFormatter={(v: number) => `${v} m²`} />
                        <YAxis type="category" dataKey="film" {...axisProps(c)} width={130} tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
                        <Tooltip {...tooltipStyle} cursor={{ fill: c.grid, opacity: 0.5 }} formatter={(v: number, _n, p: any) => [`${num(v, 1)} m² · ${p.payload.projects} projects`, 'Glass']} />
                        <Bar dataKey="areaM2" fill={c.series[1]} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fill: c.axis, fontSize: 11, formatter: (v: number) => num(v, 1) }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader icon={Trophy} title="Installer leaderboard" subtitle="Completed visits in range" />
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Installer</th>
                      <th>Store</th>
                      <th className="text-right">Jobs</th>
                      <th className="text-right">Hours</th>
                      <th className="text-right">Value</th>
                      <th className="text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.installers.map((r, i) => (
                      <tr key={r.name}>
                        <td className="font-bold text-muted-fg">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                        <td>
                          <span className="flex items-center gap-2">
                            <Avatar name={r.name} size={28} />
                            <span className="font-semibold">{r.name}</span>
                          </span>
                        </td>
                        <td className="text-muted-fg">{r.store}</td>
                        <td className="text-right tabular-nums">{r.jobs}</td>
                        <td className="text-right tabular-nums">{num(r.hours, 1)}</td>
                        <td className="text-right font-semibold tabular-nums">{moneyFmt(r.value)}</td>
                        <td className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {r.rating?.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader icon={Download} title="Exports" subtitle="Download portable snapshots for accounting, backups or spreadsheets." />
            <div className="flex flex-wrap gap-2 p-5">
              {EXPORTS.map((e) => (
                <Button key={e.kind} variant={e.kind === 'backup' ? 'primary' : 'outline'} icon={e.kind === 'backup' ? Download : FileSpreadsheet} loading={busy === e.kind} onClick={() => dl(e.kind)}>
                  {e.label}
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i ? 'text-right' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, k) => (
                <td key={k} className={k ? 'text-right tabular-nums' : 'font-medium'}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
