'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, History, ListChecks, MessageSquare, Pencil, Play, Plus, Timer, Trash2, Workflow, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi, useMeta } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';
import type { Project, Template } from '@/lib/types';
import { Badge, Button, Card, Drawer, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Select, StatCard, Switch, useConfirm } from '@/components/ui';
import { TemplateEditor } from '@/components/admin/shared';

type Run = { at: string; projectId: string; projectNumber?: string; projectTitle?: string; result: string; preview?: string; manual?: boolean };
type Automation = { _id: string; name: string; trigger: string; delayHours: number; action: 'send_message' | 'create_task'; channel: 'sms' | 'email'; templateId?: string; message?: string; enabled: boolean; runs: Run[] };

const EMPTY: Partial<Automation> = { name: '', trigger: 'lead_created', delayHours: 0, action: 'send_message', channel: 'sms', templateId: '', message: '', enabled: true };

export default function AutomationsPage() {
  const { data, isLoading, error, mutate } = useApi<Automation[]>('/automations');
  const { data: meta } = useMeta();
  const { data: templates } = useApi<Template[]>('/templates');
  const [edit, setEdit] = useState<Partial<Automation> | null>(null);
  const [sim, setSim] = useState<Automation | null>(null);
  const [log, setLog] = useState<Automation | null>(null);
  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const confirm = useConfirm();

  const triggers = meta?.triggers || [];
  const trig = (k: string) => triggers.find((t) => t.key === k);
  const totalRuns = (data || []).reduce((s, a) => s + (a.runs?.length || 0), 0);

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Give the automation a name');
    if (!edit.templateId && !edit.message?.trim()) return toast.error('Choose a template or write a message');
    setSaving(true);
    try {
      const body = { ...edit, delayHours: Number(edit.delayHours) || 0, templateId: edit.templateId || undefined };
      if (edit._id) await api.patch(`/automations/${edit._id}`, body);
      else await api.post('/automations', body);
      await mutate();
      toast.success('Automation saved');
      setEdit(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (a: Automation, enabled: boolean) => {
    mutate((list) => list?.map((x) => (x._id === a._id ? { ...x, enabled } : x)), false);
    try {
      await api.patch(`/automations/${a._id}`, { enabled });
      toast.success(enabled ? 'Automation enabled.' : 'Automation disabled.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
    mutate();
  };
  const remove = async (a: Automation) => {
    if (!(await confirm({ title: `Delete “${a.name}”?`, description: 'Its run log is deleted too.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/automations/${a._id}`);
      await mutate();
      toast.success('Automation deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const sweep = async () => {
    setSweeping(true);
    try {
      const r = await api.post<{ ran: number }>('/ops/automations/sweep', {});
      await mutate();
      toast.success(r.ran ? `${r.ran} timed automation run(s) executed` : 'Timed checks complete — nothing due');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSweeping(false);
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <PageLoader />;
  return (
    <div>
      <PageHeader
        icon={Workflow}
        eyebrow="Operations"
        title="Automations"
        subtitle="Rules that follow up, remind and create tasks for you. Messages are simulated and logged on each project."
        actions={
          <>
            <Button variant="outline" icon={Timer} loading={sweeping} onClick={sweep}>
              Run timed checks now
            </Button>
            <Button icon={Plus} onClick={() => setEdit({ ...EMPTY })}>
              New automation
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard index={0} label="Rules" value={data.length} icon={Workflow} />
        <StatCard index={1} label="Enabled" value={data.filter((a) => a.enabled).length} icon={Zap} tone="success" />
        <StatCard index={2} label="Runs logged" value={totalRuns} icon={History} tone="info" />
      </div>
      {!data.length ? (
        <Card>
          <EmptyState icon={Workflow} title="No automations yet" description="Create a rule to follow up proposals, remind customers or create tasks." action={<Button icon={Plus} onClick={() => setEdit({ ...EMPTY })}>New automation</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((a, i) => {
            const t = trig(a.trigger);
            const tpl = templates?.find((x) => x._id === a.templateId);
            const last = a.runs?.[0];
            return (
              <motion.div key={a._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`card relative overflow-hidden p-5 ${a.enabled ? '' : 'opacity-70'}`}>
                {a.enabled ? <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-fuchsia-500" /> : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold">{a.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge tone="primary">
                        <Zap className="h-3 w-3" /> {t?.label || a.trigger}
                      </Badge>
                      {a.delayHours ? (
                        <Badge tone="warning">
                          <Clock className="h-3 w-3" /> {a.delayHours}h delay
                        </Badge>
                      ) : null}
                      <span className="text-muted-fg">→</span>
                      <Badge tone={a.action === 'create_task' ? 'accent' : 'info'}>
                        {a.action === 'create_task' ? <ListChecks className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                        {a.action === 'create_task' ? 'Internal task' : `${a.channel.toUpperCase()} message`}
                      </Badge>
                    </div>
                  </div>
                  <Switch checked={a.enabled} onChange={(v) => toggle(a, v)} />
                </div>
                <p className="mt-3 line-clamp-2 rounded-xl bg-muted/50 p-2.5 text-sm text-muted-fg">{tpl ? `Template · ${tpl.name}: ${tpl.body}` : a.message || '—'}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-fg">
                    {a.runs?.length || 0} runs{last ? ` · last ${timeAgo(last.at)}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button size="xs" variant="outline" icon={Play} onClick={() => setSim(a)}>
                      Simulate run
                    </Button>
                    <Button size="xs" variant="ghost" icon={History} onClick={() => setLog(a)}>
                      Run log
                    </Button>
                    <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ ...a, templateId: a.templateId || '' })}>
                      Edit
                    </Button>
                    <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => remove(a)}>
                      Delete
                    </Button>
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
        icon={Workflow}
        title={edit?._id ? 'Edit automation' : 'New automation'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save automation
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rule name" required className="sm:col-span-2">
              <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Proposal follow-up" />
            </Field>
            <Field label="Trigger">
              <Select value={edit.trigger} onChange={(e) => setEdit({ ...edit, trigger: e.target.value })}>
                {triggers.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Delay (hours)" hint={trig(edit.trigger || '')?.timed ? 'Timed trigger — runs once the delay has passed' : 'Immediate triggers ignore the delay'}>
              <Input type="number" min={0} value={edit.delayHours ?? 0} onChange={(e) => setEdit({ ...edit, delayHours: e.target.value as any })} />
            </Field>
            <Field label="Action">
              <Select value={edit.action} onChange={(e) => setEdit({ ...edit, action: e.target.value as any })}>
                <option value="send_message">Send customer message (simulated)</option>
                <option value="create_task">Create internal task</option>
              </Select>
            </Field>
            {edit.action === 'send_message' ? (
              <Field label="Channel">
                <Select value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.target.value as any })}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </Select>
              </Field>
            ) : (
              <div />
            )}
            <Field label="Use a canned message" className="sm:col-span-2">
              <Select value={edit.templateId || ''} onChange={(e) => setEdit({ ...edit, templateId: e.target.value })}>
                <option value="">Write a custom message below</option>
                {(templates || []).map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.channel})
                  </option>
                ))}
              </Select>
            </Field>
            {!edit.templateId ? (
              <Field label={edit.action === 'create_task' ? 'Task text' : 'Message'} className="sm:col-span-2">
                <TemplateEditor rows={4} value={edit.message || ''} onChange={(v) => setEdit({ ...edit, message: v })} placeholder="Hi {{first_name}}, …" />
              </Field>
            ) : (
              <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-fg sm:col-span-2">{templates?.find((t) => t._id === edit.templateId)?.body}</p>
            )}
            <Switch checked={edit.enabled !== false} onChange={(v) => setEdit({ ...edit, enabled: v })} label="Enabled" />
          </div>
        ) : null}
      </Modal>

      <SimulateModal automation={sim} onClose={() => setSim(null)} onDone={() => mutate()} />

      <Drawer open={!!log} onClose={() => setLog(null)} title="Run log" subtitle={log?.name}>
        {!log?.runs?.length ? (
          <EmptyState icon={History} title="No runs yet" description="Runs appear here when the trigger fires or you simulate a run." />
        ) : (
          <div className="space-y-3">
            {log.runs.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <Link href={`/projects/${r.projectId}`} className="font-semibold text-primary hover:underline">
                    {r.projectNumber} · {r.projectTitle}
                  </Link>
                  <span className="text-muted-fg">{timeAgo(r.at)}</span>
                </div>
                <p className="mt-1 text-xs">
                  <Badge tone="success">{r.result}</Badge> {r.manual ? <Badge>Manual simulation</Badge> : null}
                </p>
                {r.preview ? <p className="mt-2 whitespace-pre-line text-sm text-muted-fg">{r.preview}</p> : null}
              </motion.div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function SimulateModal({ automation, onClose, onDone }: { automation: Automation | null; onClose: () => void; onDone: () => void }) {
  const { data: projects } = useApi<Project[]>(automation ? '/projects?limit=200' : null);
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Run | null>(null);
  const list = useMemo(() => projects || [], [projects]);

  const run = async () => {
    if (!automation || !projectId) return toast.error('Choose a project to run against');
    setBusy(true);
    try {
      const r = await api.ops<{ run: Run }>('automations', automation._id, 'run', { projectId });
      setResult(r.run);
      onDone();
      toast.success('Simulation complete — logged on the project');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setResult(null);
    setProjectId('');
    onClose();
  };

  return (
    <Modal
      open={!!automation}
      onClose={close}
      icon={Play}
      title="Run simulation"
      description="Simulation only — nothing is sent to the customer. The rendered message is logged on the project."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <Button icon={Play} loading={busy} onClick={run} disabled={!automation?.enabled}>
            Run simulation
          </Button>
        </>
      }
    >
      {automation && !automation.enabled ? <p className="mb-3 rounded-xl bg-warning/10 p-3 text-sm text-warning">Enable this automation before running a simulation.</p> : null}
      <Field label="Project">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Choose a project…</option>
          {list.map((p) => (
            <option key={p._id} value={p._id}>
              {p.number} · {p.title} {p.contact ? `— ${p.contact.name}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      {result ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-success/30 bg-success/5 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-success">{result.result}</p>
          <p className="mt-2 whitespace-pre-line text-sm">{result.preview}</p>
          <Link href={`/projects/${result.projectId}`} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
            Open {result.projectNumber} →
          </Link>
        </motion.div>
      ) : null}
    </Modal>
  );
}
