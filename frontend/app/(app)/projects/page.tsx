'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Briefcase, CalendarClock, Download, LayoutGrid, List, Plus, Store as StoreIcon, User } from 'lucide-react';
import { downloadFrom, errorMessage } from '@/lib/api';
import { useApi, useDebounced, useLocalState, useMeta, useStores } from '@/lib/hooks';
import { fmtDate, fmtTime, money, STAGES, timeAgo, vehicleLabel } from '@/lib/format';
import type { Project } from '@/lib/types';
import { useStoreScope } from '@/components/providers';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SearchInput, Select, Skeleton, Switch, Tabs } from '@/components/ui';
import { PaymentStatusBadge, SegmentBadge, StageBadge } from '@/components/badges';
import { NewProjectModal } from '@/components/projects/new-project-modal';

type SortKey = 'updated' | 'value' | 'created' | 'number';

function ProjectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { storeId } = useStoreScope();
  const { data: meta } = useMeta();
  const { data: stores } = useStores();
  const [view, setView] = useLocalState<'table' | 'grid'>('projects.view', 'table');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [segment, setSegment] = useState('');
  const [source, setSource] = useState('');
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState<SortKey>('updated');
  const [newOpen, setNewOpen] = useState(false);
  const dq = useDebounced(q, 250);

  useEffect(() => {
    if (params.get('new') === '1') setNewOpen(true);
  }, [params]);

  const qs = new URLSearchParams();
  if (dq) qs.set('q', dq);
  if (stage) qs.set('stage', stage);
  if (segment) qs.set('segment', segment);
  if (source) qs.set('source', source);
  if (storeId) qs.set('storeId', storeId);
  if (archived) qs.set('archived', 'true');
  const { data, error, isLoading, mutate } = useApi<Project[]>(`/projects?${qs.toString()}`);

  const list = useMemo(() => {
    const arr = [...(data || [])];
    if (sort === 'value') arr.sort((a, b) => (b.value || 0) - (a.value || 0));
    if (sort === 'created') arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'number') arr.sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }));
    return arr;
  }, [data, sort]);

  const totalValue = list.reduce((s, p) => s + (p.value || 0), 0);
  const closeNew = () => {
    setNewOpen(false);
    if (params.get('new')) router.replace('/projects');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Delivery workspace"
        title="Projects"
        icon={Briefcase}
        subtitle="Every lead, job and customer outcome in one operational list."
        actions={
          <>
            <Button variant="outline" icon={Download} onClick={() => downloadFrom('/export/projects', 'projects.csv').catch((e) => toast.error(errorMessage(e)))}>
              Export CSV
            </Button>
            <Button icon={Plus} onClick={() => setNewOpen(true)}>New project</Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search title, number, customer, rego…" className="min-w-[220px] flex-1" />
          <Select value={stage} onChange={(e) => setStage(e.target.value)} className="w-auto min-w-[150px]" aria-label="Stage">
            <option value="">All stages</option>
            {(meta?.stages || STAGES).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <Select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-auto min-w-[150px]" aria-label="Segment">
            <option value="">All segments</option>
            <option value="automotive">Automotive</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </Select>
          <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-auto min-w-[140px]" aria-label="Source">
            <option value="">All sources</option>
            {(meta?.sources || []).map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto min-w-[150px]" aria-label="Sort">
            <option value="updated">Recently updated</option>
            <option value="created">Newest first</option>
            <option value="value">Highest value</option>
            <option value="number">Job number</option>
          </Select>
          <Switch checked={archived} onChange={setArchived} label={<span className="text-xs font-semibold text-muted-fg">Archived</span>} size="sm" />
          <Tabs
            layoutId="proj-view"
            value={view}
            onChange={setView}
            tabs={[
              { key: 'table', label: <span className="sr-only">Table</span>, icon: List },
              { key: 'grid', label: <span className="sr-only">Cards</span>, icon: LayoutGrid },
            ]}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 px-1 text-xs text-muted-fg">
          <span><b className="text-fg">{list.length}</b> projects</span>
          <span>Value <b className="text-fg">{money(totalValue, { cents: false })}</b></span>
          {storeId ? <span className="flex items-center gap-1"><StoreIcon className="h-3 w-3" /> {stores?.find((s) => s._id === storeId)?.name}</span> : null}
        </div>
      </Card>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !list.length ? (
        <Card>
          <EmptyState icon={Briefcase} title={archived ? 'No archived projects' : 'No projects match'} description="Try another search or create a new lead." action={<Button icon={Plus} onClick={() => setNewOpen(true)}>New project</Button>} />
        </Card>
      ) : view === 'table' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Stage</th>
                  <th>Segment</th>
                  <th>Next appointment</th>
                  <th>Store</th>
                  <th className="text-right">Value</th>
                  <th>Payment</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <motion.tr key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }} onClick={() => router.push(`/projects/${p._id}`)} className="cursor-pointer">
                    <td className="max-w-[280px]">
                      <p className="text-[11px] font-bold text-primary">
                        {p.number}
                        {p.priority === 'high' ? <Badge tone="danger" className="ml-1.5">High</Badge> : null}
                      </p>
                      <p className="truncate font-semibold">{p.title}</p>
                      {p.segment === 'automotive' && vehicleLabel(p.vehicle) ? <p className="truncate text-xs text-muted-fg">{vehicleLabel(p.vehicle)}{p.vehicle.rego ? ` · ${p.vehicle.rego}` : ''}</p> : null}
                    </td>
                    <td>
                      <p className="font-medium">{p.contact?.name || '—'}</p>
                      <p className="text-xs text-muted-fg">{p.contact?.phone || p.contact?.email}</p>
                    </td>
                    <td><StageBadge stage={p.stage} /></td>
                    <td><SegmentBadge segment={p.segment} /></td>
                    <td className="whitespace-nowrap text-xs">
                      {p.nextAppointment ? (
                        <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-primary" />{fmtDate(p.nextAppointment.date)} · {fmtTime(p.nextAppointment.start)}</span>
                      ) : <span className="text-muted-fg">Not booked</span>}
                    </td>
                    <td className="text-xs">{p.store?.name || '—'}</td>
                    <td className="text-right font-semibold tabular-nums">{money(p.value)}</td>
                    <td><PaymentStatusBadge status={p.totals.status} /></td>
                    <td className="whitespace-nowrap text-xs text-muted-fg">{timeAgo(p.updatedAt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((p, i) => (
            <motion.div key={p._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.03 }} whileHover={{ y: -3 }}>
              <Link href={`/projects/${p._id}`} className="card block h-full p-4 transition hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-primary">{p.number}</span>
                  <StageBadge stage={p.stage} />
                </div>
                <p className="mt-2 line-clamp-2 font-display font-bold leading-snug">{p.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-fg"><User className="h-3.5 w-3.5" />{p.contact?.name || '—'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <SegmentBadge segment={p.segment} />
                  {p.tags.slice(0, 2).map((t) => <Badge key={t}>{t}</Badge>)}
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
                  <div className="text-xs text-muted-fg">
                    {p.nextAppointment ? `${fmtDate(p.nextAppointment.date)} · ${fmtTime(p.nextAppointment.start)}` : 'Not booked'}
                    <p>{p.store?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-extrabold">{money(p.value, { cents: false })}</p>
                    <PaymentStatusBadge status={p.totals.status} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <NewProjectModal open={newOpen} onClose={closeNew} contactId={params.get('contactId') || undefined} />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  );
}
