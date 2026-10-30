'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquareQuote, Pencil, Plus, Send, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDateTime, timeAgo } from '@/lib/format';
import type { Project } from '@/lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Select, Stagger, StaggerItem, Tabs, Textarea, cn, useConfirm } from '@/components/ui';

type Review = { _id: string; projectId?: string; customerName?: string; rating: number; quote?: string; platform: string; status: 'draft' | 'queued' | 'sent' | 'published'; log: { at: string; channel: string; message: string; simulated: boolean }[]; createdAt: string };
const STATUS_TONE = { draft: 'neutral', queued: 'info', sent: 'warning', published: 'success' } as const;
const STATUS_LABEL = { draft: 'Draft', queued: 'Queued', sent: 'Request sent', published: 'Published' };

function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= (hover || value);
        return (
          <button
            key={i}
            type="button"
            disabled={!onChange}
            onMouseEnter={() => onChange && setHover(i)}
            onClick={() => onChange?.(i)}
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            className={cn('transition', onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default')}
          >
            <Star style={{ width: size, height: size }} className={on ? 'fill-amber-400 text-amber-400' : 'text-muted-fg/40'} />
          </button>
        );
      })}
    </span>
  );
}

export default function ReviewsPage() {
  const { data, error, isLoading, mutate } = useApi<Review[]>('/reviews');
  const { data: projects } = useApi<Project[]>('/projects?archived=all');
  const confirm = useConfirm();
  const [tab, setTab] = useState<'all' | Review['status']>('all');
  const [editing, setEditing] = useState<Review | 'new' | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const reviews = data || [];
  const summary = useMemo(() => {
    const rated = reviews.filter((r) => r.rating);
    const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: rated.filter((r) => Math.round(r.rating) === n).length }));
    return { avg, total: rated.length, dist, published: reviews.filter((r) => r.status === 'published').length };
  }, [reviews]);
  const log = useMemo(
    () => reviews.flatMap((r) => (r.log || []).map((l) => ({ ...l, review: r }))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 30),
    [reviews],
  );
  const list = reviews.filter((r) => tab === 'all' || r.status === tab);
  const projectOf = (id?: string) => projects?.find((p) => p._id === id);

  const send = async (r: Review) => {
    setSending(r._id);
    try {
      await api.ops('reviews', r._id, 'send');
      toast.success('Review request sent (simulation only — no SMS was delivered)');
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(null);
    }
  };

  const remove = async (r: Review) => {
    if (!(await confirm({ title: 'Delete this review?', description: r.quote?.slice(0, 120), confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(`/reviews/${r._id}`);
      toast.success('Review deleted');
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <div>
      <PageHeader
        icon={Star}
        eyebrow="Reputation"
        title="Reviews"
        subtitle="Collect customer feedback and send review requests after every closed job."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Add review
          </Button>
        }
      />

      {isLoading && !data ? (
        <PageLoader />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <div className="space-y-6">
            <Card className="relative overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Average rating</p>
              <div className="mt-2 flex items-end gap-3">
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-5xl font-extrabold">
                  {summary.avg ? summary.avg.toFixed(1) : '—'}
                </motion.span>
                <div className="pb-1.5">
                  <Stars value={Math.round(summary.avg)} />
                  <p className="text-xs text-muted-fg">
                    {summary.total} reviews · {summary.published} published
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {summary.dist.map((d) => (
                  <div key={d.n} className="flex items-center gap-2 text-xs">
                    <span className="w-6 font-semibold">{d.n}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div className="h-full rounded-full bg-amber-400" initial={{ width: 0 }} animate={{ width: `${summary.total ? (d.count / summary.total) * 100 : 0}%` }} transition={{ duration: 0.8 }} />
                    </div>
                    <span className="w-6 text-right text-muted-fg">{d.count}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={Send} title="Simulation log" subtitle="Review requests are simulated — nothing is sent." />
              <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
                {!log.length ? <p className="py-6 text-center text-sm text-muted-fg">No simulations yet. Use “Simulate send” on a review request.</p> : null}
                {log.map((l, i) => (
                  <div key={i} className="rounded-xl bg-muted/60 p-3 text-xs">
                    <p className="font-semibold">
                      {l.review.customerName || 'Customer'} · {l.channel.toUpperCase()}
                    </p>
                    <p className="mt-1 text-muted-fg">{l.message}</p>
                    <p className="mt-1 text-[11px] text-muted-fg/80">{fmtDateTime(l.at)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <Tabs
              className="mb-4"
              layoutId="review-tabs"
              tabs={[
                { key: 'all', label: 'All', count: reviews.length },
                { key: 'draft', label: 'Draft', count: reviews.filter((r) => r.status === 'draft').length },
                { key: 'sent', label: 'Request sent', count: reviews.filter((r) => r.status === 'sent').length },
                { key: 'published', label: 'Published', count: summary.published },
              ]}
              value={tab}
              onChange={setTab}
            />
            {!list.length ? (
              <Card>
                <EmptyState icon={MessageSquareQuote} title="No reviews here" description="Add customer feedback or create a review request for a closed job." action={<Button icon={Plus} onClick={() => setEditing('new')}>Add review</Button>} />
              </Card>
            ) : (
              <Stagger className="grid gap-4 lg:grid-cols-2">
                {list.map((r) => {
                  const p = projectOf(r.projectId);
                  return (
                    <StaggerItem key={r._id}>
                      <Card className="flex h-full flex-col p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{r.customerName || p?.contact?.name || 'Customer'}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <Stars value={r.rating} size={14} />
                              <span className="text-xs text-muted-fg">{r.platform}</span>
                            </div>
                          </div>
                          <Badge tone={STATUS_TONE[r.status] || 'neutral'} dot>
                            {STATUS_LABEL[r.status] || r.status}
                          </Badge>
                        </div>
                        <blockquote className="mt-3 flex-1 border-l-2 border-amber-400/60 pl-3 text-sm italic text-fg/90">{r.quote ? `“${r.quote}”` : <span className="not-italic text-muted-fg">No quote yet</span>}</blockquote>
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                          {p ? (
                            <Link href={`/projects/${p._id}`} className="mr-auto truncate text-xs font-semibold text-primary hover:underline">
                              {p.number} · {p.title}
                            </Link>
                          ) : (
                            <span className="mr-auto text-xs text-muted-fg">Unknown project</span>
                          )}
                          <span className="text-[11px] text-muted-fg">{timeAgo(r.createdAt)}</span>
                          <Button size="xs" variant="outline" icon={Send} loading={sending === r._id} onClick={() => send(r)}>
                            Simulate send
                          </Button>
                          <button type="button" aria-label="Edit review" onClick={() => setEditing(r)} className="rounded-lg p-1.5 text-muted-fg hover:bg-muted">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" aria-label="Delete review" onClick={() => remove(r)} className="rounded-lg p-1.5 text-muted-fg hover:bg-danger/10 hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Card>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
          </div>
        </div>
      )}

      <ReviewModal review={editing} projects={(projects || []).filter((p) => p.stage === 'closed' || p.stage === 'invoicing')} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </div>
  );
}

function ReviewModal({ review, projects, onClose, onSaved }: { review: Review | 'new' | null; projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');
  const [platform, setPlatform] = useState('Google');
  const [status, setStatus] = useState<Review['status']>('draft');
  const [busy, setBusy] = useState(false);
  const isNew = review === 'new';

  useEffect(() => {
    if (!review) return;
    const r = review === 'new' ? null : review;
    setProjectId(r?.projectId || '');
    setCustomerName(r?.customerName || '');
    setRating(r?.rating || 5);
    setQuote(r?.quote || '');
    setPlatform(r?.platform || 'Google');
    setStatus(r?.status || 'draft');
  }, [review]);

  const save = async () => {
    if (!projectId && !customerName.trim()) return toast.error('Choose a project or enter the customer name');
    setBusy(true);
    const body = { projectId: projectId || null, customerName: customerName.trim() || projects.find((p) => p._id === projectId)?.contact?.name || '', rating, quote: quote.trim(), platform, status };
    try {
      if (isNew) await api.post('/reviews', body);
      else if (review) await api.patch(`/reviews/${review._id}`, body);
      toast.success('Review saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!review}
      onClose={onClose}
      icon={Star}
      title={isNew ? 'Add review' : 'Edit review'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save review
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project (completed jobs)" className="sm:col-span-2">
          <Select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              const p = projects.find((x) => x._id === e.target.value);
              if (p?.contact?.name && !customerName) setCustomerName(p.contact.name);
            }}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.number} · {p.contact?.name || ''} · {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Customer name">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </Field>
        <Field label="Rating (1–5)">
          <div className="flex h-10 items-center">
            <Stars value={rating} size={24} onChange={setRating} />
          </div>
        </Field>
        <Field label="Customer quote" className="sm:col-span-2">
          <Textarea rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="What did the customer say?" />
        </Field>
        <Field label="Platform">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {['Google', 'Facebook', 'ProductReview', 'Website', 'Other'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Review['status'])}>
            <option value="draft">Draft</option>
            <option value="queued">Queued</option>
            <option value="sent">Request sent</option>
            <option value="published">Published</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
