'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Copy, ExternalLink, Eye, Inbox, Megaphone, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi, useStores } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';
import type { Segment } from '@/lib/types';
import { SegmentBadge } from '@/components/badges';
import { Badge, Button, Card, Drawer, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Select, Switch, Textarea, useConfirm } from '@/components/ui';

type Submission = { at: string; data: Record<string, string>; contactId?: string; projectId?: string; test?: boolean };
type LeadForm = { _id: string; name: string; slug: string; heading?: string; intro?: string; fields: string[]; segment: Segment; storeId?: string; active: boolean; submissions: Submission[] };

const FIELD_OPTIONS = ['Name', 'Company', 'Email', 'Phone', 'Vehicle', 'Address', 'Scope', 'Message'];
const EMPTY: Partial<LeadForm> = { name: '', slug: '', heading: '', intro: '', fields: ['Name', 'Email', 'Phone', 'Scope'], segment: 'automotive', active: true };
const SAMPLE: Record<string, string> = { Name: 'Test Customer', Company: 'Test Co', Email: 'test.customer@example.com', Phone: '0400 123 456', Vehicle: '2024 Toyota RAV4', Address: '1 Test Street, Mandurah WA', Scope: 'Ceramic tint, sides & rear', Message: 'Please call after 3pm' };

export default function LeadFormsPage() {
  const { data, isLoading, error, mutate } = useApi<LeadForm[]>('/leadforms');
  const { data: stores } = useStores();
  const [edit, setEdit] = useState<Partial<LeadForm> | null>(null);
  const [test, setTest] = useState<LeadForm | null>(null);
  const [subs, setSubs] = useState<LeadForm | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const link = (f: LeadForm) => (typeof window !== 'undefined' ? `${window.location.origin}/f/${f.slug}` : `/f/${f.slug}`);

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Form name is required');
    if (!edit.fields?.includes('Name')) return toast.error('Keep the Name field — every lead needs a name');
    if (!edit.fields.includes('Email') && !edit.fields.includes('Phone')) return toast.error('Include Email or Phone so you can reply');
    setSaving(true);
    try {
      const body = { ...edit, storeId: edit.storeId || undefined, slug: edit.slug || undefined };
      if (edit._id) await api.patch(`/leadforms/${edit._id}`, body);
      else await api.post('/leadforms', body);
      await mutate();
      toast.success('Form saved');
      setEdit(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (f: LeadForm, active: boolean) => {
    try {
      await api.patch(`/leadforms/${f._id}`, { active });
      await mutate();
      toast.success(active ? 'Form published' : 'Form paused');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async (f: LeadForm) => {
    if (!(await confirm({ title: `Delete “${f.name}”?`, description: 'The public link stops working. Leads already created stay in the CRM.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/leadforms/${f._id}`);
      await mutate();
      toast.success('Form deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const copy = async (f: LeadForm) => {
    try {
      await navigator.clipboard.writeText(link(f));
      toast.success('Form link copied');
    } catch {
      toast.error('Copy failed — select the link manually');
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <PageLoader />;
  return (
    <div>
      <PageHeader
        icon={Megaphone}
        eyebrow="Operations"
        title="Lead capture forms"
        subtitle="Publish forms on your website. Every submission creates a contact and a new lead project automatically."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY, storeId: stores?.[0]?._id })}>
            New form
          </Button>
        }
      />
      {!data.length ? (
        <Card>
          <EmptyState icon={Megaphone} title="No lead forms yet" action={<Button icon={Plus} onClick={() => setEdit({ ...EMPTY })}>Create lead form</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((f, i) => {
            const real = (f.submissions || []).filter((s) => !s.test).length;
            return (
              <motion.div key={f._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card flex flex-col overflow-hidden">
                <div className="relative bg-gradient-to-br from-primary/90 to-fuchsia-500/90 p-5 text-white">
                  <div className="bg-grid absolute inset-0 opacity-30" />
                  <div className="relative flex items-start justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">{f.name}</p>
                    {f.active ? <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">LIVE</span> : <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold">PAUSED</span>}
                  </div>
                  <p className="relative mt-2 font-display text-lg font-extrabold leading-tight">{f.heading || f.name}</p>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SegmentBadge segment={f.segment} />
                    <Badge>{stores?.find((s) => s._id === f.storeId)?.name || 'Any store'}</Badge>
                    <Badge tone="info">
                      <Inbox className="h-3 w-3" /> {real} submissions
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-fg">Fields: {f.fields.join(', ')}</p>
                  <div className="mt-3 truncate rounded-lg bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-fg">{link(f)}</div>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                    <Button size="xs" variant="outline" icon={Copy} onClick={() => copy(f)}>
                      Copy link
                    </Button>
                    <Button size="xs" variant="outline" icon={ExternalLink} onClick={() => window.open(link(f), '_blank', 'noopener')}>
                      Open
                    </Button>
                    <Button size="xs" variant="outline" icon={Eye} onClick={() => setTest(f)}>
                      Preview / test
                    </Button>
                    <Button size="xs" variant="ghost" icon={Inbox} onClick={() => setSubs(f)}>
                      Submissions
                    </Button>
                    <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ ...f })}>
                      Edit
                    </Button>
                    <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => remove(f)}>
                      Delete
                    </Button>
                    <span className="ml-auto">
                      <Switch size="sm" checked={f.active} onChange={(v) => toggle(f, v)} />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        size="lg"
        icon={Megaphone}
        title={edit?._id ? 'Edit lead form' : 'Create lead form'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save form
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Form name" required>
              <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Website · Get a quote" />
            </Field>
            <Field label="Web address" hint={`/f/${edit.slug || 'auto-from-name'}`}>
              <Input value={edit.slug || ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="get-a-quote" />
            </Field>
            <Field label="Heading" className="sm:col-span-2">
              <Input value={edit.heading || ''} onChange={(e) => setEdit({ ...edit, heading: e.target.value })} placeholder="Let’s make your car more comfortable." />
            </Field>
            <Field label="Intro" className="sm:col-span-2">
              <Textarea rows={2} value={edit.intro || ''} onChange={(e) => setEdit({ ...edit, intro: e.target.value })} />
            </Field>
            <Field label="Segment">
              <Select value={edit.segment} onChange={(e) => setEdit({ ...edit, segment: e.target.value as Segment })}>
                <option value="automotive">Automotive</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </Select>
            </Field>
            <Field label="Receiving store">
              <Select value={edit.storeId || ''} onChange={(e) => setEdit({ ...edit, storeId: e.target.value })}>
                <option value="">First store</option>
                {(stores || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <FieldsEditor value={edit.fields || []} onChange={(v) => setEdit({ ...edit, fields: v })} />
            </div>
            <Switch checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="Published / active" />
          </div>
        ) : null}
      </Modal>

      <TestModal form={test} onClose={() => setTest(null)} onDone={() => mutate()} />

      <Drawer open={!!subs} onClose={() => setSubs(null)} title="Submissions" subtitle={subs?.name}>
        {!subs?.submissions?.length ? (
          <EmptyState icon={Inbox} title="No submissions yet" description="Share the form link or run a test submission." />
        ) : (
          <div className="space-y-3">
            {subs.submissions.map((s, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-muted-fg">{timeAgo(s.at)}</span>
                  <span className="flex gap-1">
                    {s.test ? <Badge tone="warning">Test</Badge> : <Badge tone="success">Live</Badge>}
                    {s.projectId ? (
                      <Link href={`/projects/${s.projectId}`} className="font-semibold text-primary hover:underline">
                        Open project →
                      </Link>
                    ) : null}
                  </span>
                </div>
                <dl className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 text-sm">
                  {Object.entries(s.data || {}).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="capitalize text-muted-fg">{k}</dt>
                      <dd className="break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function FieldsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const move = (i: number, d: number) => {
    const n = [...value];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const unused = FIELD_OPTIONS.filter((f) => !value.includes(f));
  return (
    <div>
      <p className="label">Fields</p>
      <div className="space-y-1.5">
        {value.map((f, i) => (
          <motion.div layout key={f} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm">
            <span className="flex-1 font-medium">{f}</span>
            <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="rounded p-1 text-muted-fg hover:bg-muted">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="rounded p-1 text-muted-fg hover:bg-muted">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label={`Remove ${f}`} onClick={() => onChange(value.filter((x) => x !== f))} className="rounded p-1 text-muted-fg hover:text-danger">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
      {unused.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.map((f) => (
            <button key={f} type="button" onClick={() => onChange([...value, f])} className="rounded-lg border border-dashed border-line px-2 py-1 text-xs font-semibold text-muted-fg hover:border-primary hover:text-primary">
              + {f}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TestModal({ form, onClose, onDone }: { form: LeadForm | null; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fill = () => setData(Object.fromEntries((form?.fields || []).map((f) => [f, SAMPLE[f] || ''])));
  const submit = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const r = await api.ops<{ projectId: string; number: string }>('leadforms', form._id, 'test', { data });
      onDone();
      toast.success(`Test lead created · ${r.number}`, { action: { label: 'Open', onClick: () => router.push(`/projects/${r.projectId}`) } });
      setData({});
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!form}
      onClose={onClose}
      icon={Eye}
      title="Preview with a test submission"
      description="Test submit creates a contact and a lead project tagged “Test submission”."
      footer={
        <>
          <Button variant="ghost" onClick={fill}>
            Fill sample data
          </Button>
          <Button icon={Send} loading={busy} onClick={submit}>
            Submit test
          </Button>
        </>
      }
    >
      {form ? (
        <div className="rounded-2xl border border-line p-5">
          <p className="font-display text-xl font-extrabold">{form.heading || form.name}</p>
          {form.intro ? <p className="mt-1 text-sm text-muted-fg">{form.intro}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {form.fields.map((f) => (
              <Field key={f} label={f} className={['Scope', 'Message', 'Address'].includes(f) ? 'sm:col-span-2' : ''}>
                {['Scope', 'Message'].includes(f) ? (
                  <Textarea rows={2} value={data[f] || ''} onChange={(e) => setData({ ...data, [f]: e.target.value })} />
                ) : (
                  <Input value={data[f] || ''} onChange={(e) => setData({ ...data, [f]: e.target.value })} />
                )}
              </Field>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
