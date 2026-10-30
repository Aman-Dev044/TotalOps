'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi, useSettings } from '@/lib/hooks';
import type { Template } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Select, useConfirm } from '@/components/ui';
import { TabIntro, TemplateEditor, renderSample } from './shared';

const PURPOSES = ['general', 'reminder', 'follow_up', 'proposal', 'review', 'dispatch', 'ready', 'payment'];
const EMPTY: Partial<Template> = { name: '', channel: 'sms', purpose: 'general', subject: '', body: '' };

export function TemplatesTab() {
  const { data: templates, isLoading, mutate } = useApi<Template[]>('/templates');
  const { data: settings } = useSettings();
  const [edit, setEdit] = useState<Partial<Template> | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const biz = settings?.business?.name;

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Template name is required');
    if (!edit.body?.trim()) return toast.error('Message body is required');
    setSaving(true);
    try {
      if (edit._id) await api.patch(`/templates/${edit._id}`, edit);
      else await api.post('/templates', edit);
      await mutate();
      toast.success('Template saved');
      setEdit(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (t: Template) => {
    if (!(await confirm({ title: `Delete “${t.name}”?`, description: 'Automations using it fall back to their own message.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/templates/${t._id}`);
      await mutate();
      toast.success('Template deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <TabIntro
        title="Message templates"
        text="A consistent voice for reminders, follow-ups and review requests. Sending is simulated — no SMS or email leaves the system."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY })}>
            Add template
          </Button>
        }
      />
      {!templates?.length ? (
        <Card>
          <EmptyState icon={MessageSquare} title="No templates yet" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {templates.map((t, i) => {
            const Icon = t.channel === 'email' ? Mail : MessageSquare;
            return (
              <motion.div key={t._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-fg">
                        {t.channel.toUpperCase()} · {t.purpose.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex">
                    <Button size="icon" variant="ghost" aria-label="Edit template" onClick={() => setEdit({ ...t })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete template" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-4 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm text-muted-fg">{renderSample(t.body, biz)}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        size="lg"
        icon={MessageSquare}
        title={edit?._id ? 'Edit template' : 'New template'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save template
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 md:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              <Field label="Template name" required>
                <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Channel">
                  <Select value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.target.value as any })}>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </Select>
                </Field>
                <Field label="Purpose">
                  <Select value={edit.purpose} onChange={(e) => setEdit({ ...edit, purpose: e.target.value })}>
                    {PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p.replace('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {edit.channel === 'email' ? (
                <Field label="Subject">
                  <Input value={edit.subject || ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
                </Field>
              ) : null}
              <Field label="Message body" hint="Click a variable to insert it at the cursor.">
                <TemplateEditor rows={7} value={edit.body || ''} onChange={(v) => setEdit({ ...edit, body: v })} />
              </Field>
            </div>
            <div>
              <p className="label">Live preview</p>
              <div className="rounded-[28px] border-[6px] border-slate-800 bg-slate-900 p-3 shadow-lift">
                <div className="rounded-2xl bg-white p-3 dark:bg-slate-800">
                  {edit.channel === 'email' ? <p className="mb-2 border-b border-line pb-2 text-xs font-bold">{renderSample(edit.subject || '(no subject)', biz)}</p> : null}
                  <div className="ml-auto max-w-[95%] whitespace-pre-line rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] text-white">{renderSample(edit.body || 'Your message preview appears here.', biz)}</div>
                  <p className="mt-2 text-right text-[10px] text-muted-fg">
                    {(edit.body || '').length} chars · <Badge>{Math.max(1, Math.ceil(renderSample(edit.body || '', biz).length / 160))} SMS</Badge>
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-fg">Preview uses sample customer data.</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
