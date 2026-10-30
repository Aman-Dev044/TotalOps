'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Copy, ExternalLink, Eye, FileText, KanbanSquare, List, PenLine, Send, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi, useLocalState } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { money, timeAgo, fmtDate, todayStr, PROPOSAL_STATUS } from '@/lib/format';
import type { Project } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, SearchInput, Segmented, Select, StatCard, cn } from '@/components/ui';
import { SegmentBadge } from '@/components/badges';
import { ApprovalModal } from '@/components/business/approval-modal';

const COLUMNS = ['draft', 'sent', 'viewed', 'approved'] as const;
type Status = (typeof COLUMNS)[number];
const COL_ICON = { draft: PenLine, sent: Send, viewed: Eye, approved: CheckCircle2 };

async function copyLink(p: Project) {
  const link = p.proposal?.token ? `${window.location.origin}/review/${p.proposal.token}` : '';
  if (!link) {
    toast.error('Send the proposal (or create a review link) from the project first.');
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    toast.success('Customer review link copied');
  } catch {
    toast.message('Copy this link', { description: link });
  }
}

const activityText = (p: Project) => {
  const pr = p.proposal!;
  if (pr.approvedAt) return `Approved ${timeAgo(pr.approvedAt)}${pr.approvedBy ? ` by ${pr.approvedBy}` : ''}`;
  if (pr.viewedAt) return `Viewed ${timeAgo(pr.viewedAt)}`;
  if (pr.sentAt) return `Sent ${timeAgo(pr.sentAt)}`;
  return 'Not sent yet';
};

export default function ProposalsPage() {
  const { storeId } = useStoreScope();
  const { data, error, isLoading, mutate } = useApi<Project[]>(`/projects?proposal=true${storeId ? `&storeId=${storeId}` : ''}`);
  const [view, setView] = useLocalState<'list' | 'kanban'>('proposals.view', 'kanban');
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('');
  const [approving, setApproving] = useState<Project | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || []).filter((p) => p.proposal && (!segment || p.segment === segment) && (!s || [p.number, p.title, p.contact?.name, p.contact?.company].some((x) => (x || '').toLowerCase().includes(s))));
  }, [data, q, segment]);

  const stats = useMemo(() => {
    const all = (data || []).filter((p) => p.proposal);
    const total = (p: Project) => p.totals?.proposal?.total || 0;
    const awaiting = all.filter((p) => ['sent', 'viewed'].includes(p.proposal!.status));
    const approved = all.filter((p) => p.proposal!.status === 'approved');
    const decided = all.filter((p) => p.proposal!.status !== 'draft').length;
    return {
      drafts: all.filter((p) => p.proposal!.status === 'draft').length,
      awaiting: awaiting.length,
      awaitingValue: awaiting.reduce((s, p) => s + total(p), 0),
      approved: approved.length,
      approvedValue: approved.reduce((s, p) => s + total(p), 0),
      winRate: decided ? (approved.length / decided) * 100 : 0,
    };
  }, [data]);

  const move = async (p: Project, status: Status) => {
    if (!p.proposal || p.proposal.status === status) return;
    if (p.proposal.status === 'approved') {
      toast.error('This proposal is already approved.');
      return;
    }
    if (status === 'approved') {
      setApproving(p);
      return;
    }
    setMoving(p._id);
    try {
      await api.action(p._id, 'proposal.status', { status });
      toast.success(`${p.number} moved to ${PROPOSAL_STATUS[status].label}`);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMoving(null);
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <div>
      <PageHeader
        icon={FileText}
        eyebrow="Commercial workspace"
        title="Proposals"
        subtitle="Track draft, sent, viewed and approved quotes. Drag cards to move them through the workflow."
        actions={
          <Segmented
            options={[
              { key: 'kanban', label: <span className="flex items-center gap-1.5"><KanbanSquare className="h-4 w-4" /> Board</span> },
              { key: 'list', label: <span className="flex items-center gap-1.5"><List className="h-4 w-4" /> List</span> },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Drafts" value={stats.drafts} icon={PenLine} tone="neutral" sub="being prepared" />
        <StatCard index={1} label="Awaiting customer" value={stats.awaiting} icon={Clock} tone="warning" sub={`${money(stats.awaitingValue, { cents: false })} in play`} />
        <StatCard index={2} label="Approved value" value={stats.approvedValue} format={(n) => money(n, { cents: false })} icon={Trophy} tone="success" sub={`${stats.approved} approved`} />
        <StatCard index={3} label="Win rate" value={stats.winRate} format={(n) => `${Math.round(n)}%`} icon={CheckCircle2} tone="primary" sub="of sent proposals" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search proposals, customers…" className="w-full sm:w-80" />
        <Select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-44" aria-label="Segment">
          <option value="">All segments</option>
          <option value="automotive">Automotive</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
        </Select>
        <p className="ml-auto text-xs text-muted-fg">{list.length} proposals</p>
      </div>

      {isLoading && !data ? (
        <PageLoader />
      ) : !list.length ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={q || segment ? 'No proposals match' : 'No proposals yet'}
            description="Create a proposal from a project — from service lines, a package or the saved measurement sheet."
            action={
              <Link href="/projects">
                <Button>Open projects</Button>
              </Link>
            }
          />
        </Card>
      ) : view === 'kanban' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = list.filter((p) => p.proposal?.status === col);
            const Icon = COL_ICON[col];
            const value = items.reduce((s, p) => s + (p.totals?.proposal?.total || 0), 0);
            return (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOver !== col) setDragOver(col);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const p = list.find((x) => x._id === e.dataTransfer.getData('text/plain'));
                  if (p) move(p, col);
                }}
                className={cn('flex min-h-[320px] flex-col rounded-2xl border border-line bg-muted/40 p-3 transition', dragOver === col && 'border-primary/60 bg-primary/5 ring-4 ring-primary/10')}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 font-display text-sm font-bold">
                    <Icon className="h-4 w-4 text-primary" /> {PROPOSAL_STATUS[col].label}
                    <span className="rounded-full bg-card px-2 text-xs text-muted-fg">{items.length}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted-fg">{money(value, { cents: false })}</span>
                </div>
                <div className="flex-1 space-y-2.5">
                  {items.map((p, i) => (
                    <ProposalCard key={p._id} p={p} index={i} busy={moving === p._id} />
                  ))}
                  {!items.length ? <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs text-muted-fg">Drop a proposal here</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Proposal</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Valid until</th>
                <th>Status</th>
                <th>Activity</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const pr = p.proposal!;
                const expired = pr.status !== 'approved' && pr.validUntil < todayStr();
                return (
                  <tr key={p._id}>
                    <td>
                      <Link href={`/projects/${p._id}`} className="font-semibold hover:text-primary">
                        {p.number}
                      </Link>
                      <p className="max-w-[260px] truncate text-xs text-muted-fg">{p.title}</p>
                    </td>
                    <td>
                      <p className="font-medium">{p.contact?.name || '—'}</p>
                      <SegmentBadge segment={p.segment} />
                    </td>
                    <td className="font-semibold">{money(p.totals?.proposal?.total)}</td>
                    <td className="whitespace-nowrap">
                      <span className={cn(expired && 'text-danger')}>{fmtDate(pr.validUntil)}</span>
                      {expired ? <Badge tone="danger" className="ml-1.5">Expired</Badge> : null}
                    </td>
                    <td>
                      <Select aria-label="Proposal status" value={pr.status} onChange={(e) => move(p, e.target.value as Status)} className="h-8 w-32 text-xs" disabled={pr.status === 'approved' || moving === p._id}>
                        {COLUMNS.map((c) => (
                          <option key={c} value={c}>
                            {PROPOSAL_STATUS[c].label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="text-xs text-muted-fg">{activityText(p)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="ghost" icon={Copy} onClick={() => copyLink(p)}>
                          Link
                        </Button>
                        <Link href={`/projects/${p._id}`}>
                          <Button size="xs" variant="outline" icon={ExternalLink}>
                            Open
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ApprovalModal project={approving} open={!!approving} onClose={() => setApproving(null)} onDone={() => mutate()} />
    </div>
  );
}

function ProposalCard({ p, index, busy }: { p: Project; index: number; busy: boolean }) {
  const pr = p.proposal!;
  const expired = pr.status !== 'approved' && pr.validUntil < todayStr();
  const draggable = pr.status !== 'approved';
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: busy ? 0.5 : 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <div
        draggable={draggable}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', p._id)}
        className={cn('card group p-3.5 transition hover:shadow-lift', draggable ? 'cursor-grab active:cursor-grabbing' : '')}
      >
        <div className="flex items-start justify-between gap-2">
          <Link href={`/projects/${p._id}`} className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-fg">{p.number}</p>
            <p className="truncate text-sm font-semibold group-hover:text-primary">{p.contact?.name || p.title}</p>
          </Link>
          <p className="font-display text-sm font-bold">{money(p.totals?.proposal?.total, { cents: false })}</p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-fg">{p.title}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <SegmentBadge segment={p.segment} />
          {expired ? <Badge tone="danger">Expired</Badge> : <span className="text-[11px] text-muted-fg">Valid to {fmtDate(pr.validUntil, { day: 'numeric', month: 'short' })}</span>}
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
          <span className="truncate text-[11px] text-muted-fg">{activityText(p)}</span>
          <button type="button" onClick={() => copyLink(p)} title="Copy customer link" aria-label="Copy customer link" className="rounded-md p-1 text-muted-fg hover:bg-muted hover:text-primary">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
