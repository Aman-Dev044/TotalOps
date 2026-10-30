'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarClock, GripVertical, KanbanSquare, Plus } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi, useStaff, useStores } from '@/lib/hooks';
import { fmtDate, money, SEGMENT_META, STAGES } from '@/lib/format';
import type { Project, Segment } from '@/lib/types';
import { useStoreScope } from '@/components/providers';
import { Avatar, Badge, Button, ErrorState, PageHeader, SearchInput, Select, Skeleton, cn } from '@/components/ui';
import { SegmentBadge } from '@/components/badges';
import { NewProjectModal } from '@/components/projects/new-project-modal';

type GroupBy = 'stage' | 'store' | 'segment' | 'installer';
type Column = { key: string; label: string; hex: string; items: Project[] };

export default function PipelinePage() {
  const { storeId } = useStoreScope();
  const { data: stores } = useStores();
  const { data: staff } = useStaff();
  const [groupBy, setGroupBy] = useState<GroupBy>('stage');
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const { data, error, isLoading, mutate } = useApi<Project[]>(`/projects${storeId ? `?storeId=${storeId}` : ''}`);

  const projects = useMemo(() => {
    const s = q.toLowerCase();
    return (data || [])
      .map((p) => (overrides[p._id] ? { ...p, stage: overrides[p._id] as Project['stage'] } : p))
      .filter((p) => (!segment || p.segment === segment) && (!s || [p.title, p.number, p.contact?.name, p.vehicle?.rego].some((v) => (v || '').toLowerCase().includes(s))));
  }, [data, overrides, q, segment]);

  const columns = useMemo<Column[]>(() => {
    if (groupBy === 'stage') return STAGES.map((s) => ({ key: s.key, label: s.label, hex: s.hex, items: projects.filter((p) => p.stage === s.key) }));
    if (groupBy === 'segment') return (['automotive', 'residential', 'commercial'] as Segment[]).map((s) => ({ key: s, label: SEGMENT_META[s].label, hex: SEGMENT_META[s].hex, items: projects.filter((p) => p.segment === s) }));
    if (groupBy === 'store') return (stores || []).map((s) => ({ key: s._id, label: `${s.name} Branch`, hex: s.color, items: projects.filter((p) => p.storeId === s._id) }));
    const installers = (staff || []).filter((s) => s.role === 'installer');
    const cols: Column[] = installers.map((s) => ({ key: s._id, label: s.name, hex: s.color, items: projects.filter((p) => p.nextAppointment?.installerId === s._id) }));
    cols.unshift({ key: 'none', label: 'Unassigned', hex: '#94a3b8', items: projects.filter((p) => !p.nextAppointment?.installerId) });
    return cols;
  }, [groupBy, projects, stores, staff]);

  const move = async (id: string, stage: string) => {
    const p = projects.find((x) => x._id === id);
    if (!p || p.stage === stage) return;
    setOverrides((o) => ({ ...o, [id]: stage }));
    try {
      await api.action(id, 'stage', { stage });
      toast.success(`${p.number} moved to ${STAGES.find((s) => s.key === stage)?.label}`);
      await mutate();
      refresh('/dashboard');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setOverrides((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
    }
  };

  const draggable = groupBy === 'stage';

  return (
    <div>
      <PageHeader
        eyebrow="Revenue workflow"
        title="Pipeline"
        icon={KanbanSquare}
        subtitle="Move work from first enquiry to completed job. Drag cards between stages — workflow rules are checked automatically."
        actions={<Button icon={Plus} onClick={() => setNewOpen(true)}>New lead</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Filter cards…" className="min-w-[220px] flex-1 sm:max-w-xs" />
        <Select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-auto" aria-label="Segment">
          <option value="">All segments</option>
          <option value="automotive">Automotive</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
        </Select>
        <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted-fg">
          Kanban grouping:
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="h-9 w-auto">
            <option value="stage">Project stage</option>
            <option value="store">Store location</option>
            <option value="segment">Service type</option>
            <option value="installer">Assigned installer</option>
          </Select>
        </div>
      </div>
      {!draggable ? <p className="mb-3 rounded-xl bg-info/10 px-3 py-2 text-xs font-medium text-info">Drag & drop is available when grouping by project stage.</p> : null}

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="flex gap-4 overflow-hidden">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[60vh] w-72 shrink-0" />)}</div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          <div className="flex gap-3">
            {columns.map((col) => {
              const total = col.items.reduce((s, p) => s + (p.value || 0), 0);
              const isOver = overCol === col.key && draggable;
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    if (!draggable || !dragId) return;
                    e.preventDefault();
                    setOverCol(col.key);
                  }}
                  onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    setOverCol(null);
                    setDragId(null);
                    if (draggable && id) move(id, col.key);
                  }}
                  className={cn('flex w-[290px] shrink-0 flex-col rounded-2xl border bg-muted/40 transition', isOver ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-line')}
                >
                  <div className="sticky top-0 rounded-t-2xl px-3 pb-2 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: col.hex }} />
                        <span className="truncate text-sm font-bold">{col.label}</span>
                      </span>
                      <Badge>{col.items.length}</Badge>
                    </div>
                    <p className="mt-0.5 pl-[18px] text-xs text-muted-fg">{money(total, { cents: false })}</p>
                    <div className="mt-2 h-1 rounded-full" style={{ background: `${col.hex}40` }} />
                  </div>
                  <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: '68vh' }}>
                    <AnimatePresence initial={false}>
                      {col.items.map((p) => (
                        <motion.div
                          layout
                          key={p._id}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: dragId === p._id ? 0.4 : 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        >
                          <div
                            draggable={draggable}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', p._id);
                              e.dataTransfer.effectAllowed = 'move';
                              setDragId(p._id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverCol(null);
                            }}
                            className={cn('group rounded-xl border border-line bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-soft', draggable && 'cursor-grab active:cursor-grabbing')}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link href={`/projects/${p._id}`} className="text-[11px] font-bold text-primary hover:underline">{p.number}</Link>
                              {draggable ? <GripVertical className="h-4 w-4 text-muted-fg/50 group-hover:text-muted-fg" /> : null}
                            </div>
                            <Link href={`/projects/${p._id}`} className="mt-1 block text-sm font-semibold leading-snug hover:text-primary">{p.title}</Link>
                            <p className="mt-0.5 truncate text-xs text-muted-fg">{p.contact?.name || 'Unassigned contact'}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <SegmentBadge segment={p.segment} />
                              <span className="text-sm font-bold tabular-nums">{money(p.value, { cents: false })}</span>
                            </div>
                            {p.nextAppointment ? (
                              <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[11px] text-muted-fg">
                                <CalendarClock className="h-3 w-3" />
                                {fmtDate(p.nextAppointment.date)} {p.nextAppointment.start}
                                {p.nextAppointment.installer ? <Avatar name={p.nextAppointment.installer} size={18} className="ml-auto ring-1" /> : null}
                              </div>
                            ) : null}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {!col.items.length ? <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted-fg">{draggable ? 'Drop a project here' : 'Nothing here'}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
