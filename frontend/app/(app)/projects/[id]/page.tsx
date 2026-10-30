'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Archive, ArchiveRestore, ArrowLeft, CalendarDays, Check, ChevronDown, Copy, FileText, FolderOpen, Hammer, LayoutDashboard, Mail, MessageSquare, MoreHorizontal,
  Pencil, Phone, Ruler, Trash2, UserRound,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi } from '@/lib/hooks';
import { money, STAGES, vehicleLabel } from '@/lib/format';
import type { ProjectDetail } from '@/lib/types';
import { Badge, Button, ErrorState, Menu, MenuItem, PageLoader, Progress, Tabs, cn, useConfirm } from '@/components/ui';
import { PaymentStatusBadge, SegmentBadge, StageBadge } from '@/components/badges';
import { useProjectAction } from '@/components/projects/use-project-action';
import { EditContactModal, EditProjectModal } from '@/components/projects/edit-modals';
import { OverviewTab } from '@/components/projects/overview-tab';
import { AppointmentsTab } from '@/components/projects/appointments-tab';
import { MeasurementsTab } from '@/components/projects/measurements-tab';
import { QuoteTab } from '@/components/projects/quote-tab';
import { InstallTab } from '@/components/projects/install-tab';
import { FilesTab } from '@/components/projects/files-tab';
import { MessagesTab } from '@/components/projects/messages-tab';

type TabKey = 'overview' | 'appointments' | 'measurements' | 'quote' | 'install' | 'files' | 'messages';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: p, error, isLoading, mutate } = useApi<ProjectDetail>(id ? `/projects/${id}` : null);
  const reload = useCallback(() => mutate(), [mutate]);
  const { run, busy } = useProjectAction(id, reload);
  const [tab, setTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !p) return <PageLoader label="Loading project…" />;

  const stageIdx = STAGES.findIndex((s) => s.key === p.stage);
  const quoted = p.totals.proposal?.total || 0;
  const value = p.invoice ? p.invoice.total : quoted || p.value;

  const moveStage = async (stage: string) => {
    if (stage === p.stage) return;
    await run('stage', { stage }, `Moved to ${STAGES.find((s) => s.key === stage)?.label}`);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Project link copied');
    } catch {
      toast.error('Select the address bar and copy the link manually.');
    }
  };

  const duplicate = async () => {
    const res = await run<{ duplicated: { _id: string; number: string } }>('duplicate', {}, 'Project duplicated');
    if (res?.duplicated) router.push(`/projects/${res.duplicated._id}`);
  };

  const archive = async () => {
    const ok = await confirm({
      title: p.archived ? 'Restore project?' : 'Archive project?',
      description: 'This is reversible and does not delete the record or payment history.',
      confirmLabel: p.archived ? 'Restore' : 'Archive',
    });
    if (ok) await run(p.archived ? 'restore' : 'archive', {}, p.archived ? 'Project restored' : 'Project archived');
  };

  const destroy = async () => {
    const ok = await confirm({ title: 'Delete project permanently?', description: 'Notes and activity for this project are removed. This cannot be undone.', confirmLabel: 'Delete forever', danger: true });
    if (!ok) return;
    try {
      await api.del(`/projects/${p._id}`);
      toast.success('Project deleted');
      refresh('/projects', '/dashboard');
      router.push('/projects');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const tabProps = { p, run, busy, reload };
  const TABS: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'appointments', label: 'Appointments', icon: CalendarDays, count: p.appointments.filter((a) => a.status !== 'cancelled').length },
    { key: 'measurements', label: 'Measurements', icon: Ruler, count: p.totals.panes || undefined },
    { key: 'quote', label: 'Quote & invoice', icon: FileText },
    { key: 'install', label: 'Install & notes', icon: Hammer, count: p.notes.length || undefined },
    { key: 'files', label: 'Files & photos', icon: FolderOpen, count: p.files.length || undefined },
    { key: 'messages', label: 'Messages', icon: MessageSquare, count: p.messages.length || undefined },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-fg hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
        {p.archived ? <Badge tone="warning">Archived</Badge> : null}
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card relative mb-5 overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-primary/25 to-fuchsia-500/10 blur-3xl" />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">Job #{p.number}</span>
                <StageBadge stage={p.stage} />
                <SegmentBadge segment={p.segment} />
                {p.priority === 'high' ? <Badge tone="danger">High priority</Badge> : null}
                {p.tags.map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
              <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{p.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-fg">
                <button type="button" onClick={() => setContactOpen(true)} className="flex items-center gap-1.5 font-semibold text-fg hover:text-primary">
                  <UserRound className="h-4 w-4" /> {p.contact?.name || 'Contact details pending'}
                </button>
                {p.contact?.phone ? <a href={`tel:${p.contact.phone}`} className="flex items-center gap-1.5 hover:text-fg"><Phone className="h-3.5 w-3.5" />{p.contact.phone}</a> : null}
                {p.contact?.email ? <a href={`mailto:${p.contact.email}`} className="flex items-center gap-1.5 hover:text-fg"><Mail className="h-3.5 w-3.5" />{p.contact.email}</a> : null}
                {p.segment === 'automotive' && vehicleLabel(p.vehicle) ? <span>{vehicleLabel(p.vehicle)}{p.vehicle.rego ? ` · ${p.vehicle.rego}` : ''}</span> : null}
                {p.store ? <span>{p.store.name} store</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
              <Menu
                width={240}
                trigger={(open) => (
                  <Button variant="secondary" icon={MoreHorizontal} iconRight={ChevronDown} className={cn(open && 'ring-4 ring-primary/15')}>
                    Actions
                  </Button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem icon={Pencil} onClick={() => { close(); setEditOpen(true); }}>Edit project details</MenuItem>
                    <MenuItem icon={UserRound} onClick={() => { close(); setContactOpen(true); }}>Edit customer contact</MenuItem>
                    <MenuItem icon={MessageSquare} onClick={() => { close(); setTab('messages'); }}>Send customer message</MenuItem>
                    <MenuItem icon={Copy} onClick={() => { close(); copyLink(); }}>Copy project link</MenuItem>
                    <MenuItem icon={Copy} onClick={() => { close(); duplicate(); }}>Duplicate project</MenuItem>
                    <div className="my-1 h-px bg-line" />
                    <MenuItem icon={p.archived ? ArchiveRestore : Archive} onClick={() => { close(); archive(); }}>{p.archived ? 'Restore project' : 'Archive project'}</MenuItem>
                    {p.archived ? <MenuItem icon={Trash2} danger onClick={() => { close(); destroy(); }}>Delete permanently</MenuItem> : null}
                  </>
                )}
              </Menu>
            </div>
          </div>

          {/* Money strip */}
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Project value', value: money(value), sub: p.invoice ? `Invoice ${p.invoice.number}` : p.proposal ? `Proposal · ${p.proposal.status}` : 'No proposal yet' },
              { label: 'Amount paid', value: money(p.totals.paid), sub: `${p.payments.length} payment${p.payments.length === 1 ? '' : 's'}` },
              { label: 'Balance due', value: money(p.invoice ? p.totals.balance : Math.max(0, value - p.totals.paid)), sub: <PaymentStatusBadge status={p.totals.status} /> },
              { label: 'Measured glass', value: `${p.totals.measuredM2} m²`, sub: `${p.totals.panes} panes` },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-xl border border-line bg-bg/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-fg">{s.label}</p>
                <p className="mt-0.5 font-display text-xl font-extrabold">{s.value}</p>
                <div className="mt-0.5 text-xs text-muted-fg">{s.sub}</div>
              </motion.div>
            ))}
          </div>
          {value > 0 ? <Progress className="mt-3" value={p.totals.paid} max={value} tone={p.totals.status === 'paid' ? 'success' : 'primary'} height={6} /> : null}

          {/* Stage stepper */}
          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center">
              {STAGES.map((s, i) => {
                const done = i < stageIdx;
                const current = i === stageIdx;
                return (
                  <div key={s.key} className="flex items-center">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => moveStage(s.key)}
                      title={`Move to ${s.label}`}
                      className={cn('group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition', current ? 'border-transparent text-white shadow-glow' : done ? 'border-line bg-card text-fg hover:border-primary/40' : 'border-dashed border-line text-muted-fg hover:border-primary/40 hover:text-fg')}
                      style={current ? { background: s.hex } : undefined}
                    >
                      <span className={cn('grid h-5 w-5 place-items-center rounded-full text-[10px]', current ? 'bg-white/25' : done ? 'bg-success text-white' : 'bg-muted')}>
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      {s.label}
                    </button>
                    {i < STAGES.length - 1 ? <span className={cn('mx-1 h-0.5 w-5', i < stageIdx ? 'bg-success' : 'bg-line')} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} layoutId="project-tabs" className="mb-5" />

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === 'overview' ? <OverviewTab {...tabProps} goTo={(t) => setTab(t as TabKey)} /> : null}
        {tab === 'appointments' ? <AppointmentsTab {...tabProps} /> : null}
        {tab === 'measurements' ? <MeasurementsTab {...tabProps} /> : null}
        {tab === 'quote' ? <QuoteTab {...tabProps} /> : null}
        {tab === 'install' ? <InstallTab {...tabProps} /> : null}
        {tab === 'files' ? <FilesTab {...tabProps} /> : null}
        {tab === 'messages' ? <MessagesTab {...tabProps} /> : null}
      </motion.div>

      <EditProjectModal p={p} open={editOpen} onClose={() => setEditOpen(false)} reload={reload} />
      <EditContactModal p={p} open={contactOpen} onClose={() => setContactOpen(false)} run={run} />
    </div>
  );
}
