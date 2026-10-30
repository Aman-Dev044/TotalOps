'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckCircle2, CircleDashed, Hammer, LogIn, NotebookPen, Send, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { refresh } from '@/lib/hooks';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { Badge, Button, Card, CardHeader, Checkbox, Input, Select, Tabs, useConfirm, cn } from '@/components/ui';
import type { TabProps } from './use-project-action';

const STEPS = [
  { key: 'pending', label: 'Pending' },
  { key: 'checked_in', label: 'Checked in' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'complete', label: 'Handover' },
];

export function InstallTab({ p, run, busy, reload }: TabProps) {
  const confirm = useConfirm();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'note' | 'task'>('note');
  const [assignee, setAssignee] = useState('');
  const [filter, setFilter] = useState<'all' | 'note' | 'task'>('all');
  const [saving, setSaving] = useState(false);
  const install = p.appointments.find((a) => a.type === 'installation' && a.status !== 'cancelled');
  const status = p.install.status === 'complete' ? 'complete' : install?.status === 'checked_in' ? 'in_progress' : install?.status === 'scheduled' || install?.status === 'dispatched' ? 'pending' : p.install.status;
  const stepIdx = Math.max(0, STEPS.findIndex((s) => s.key === status));

  const addNote = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.post('/notes', { kind, text: text.trim(), projectId: p._id, assignedTo: assignee || undefined });
      setText('');
      toast.success(kind === 'task' ? 'Task added' : 'Note saved');
      await reload();
      refresh('/notes');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (id: string, done: boolean) => {
    try {
      await api.patch(`/notes/${id}`, { done });
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (id: string) => {
    if (!(await confirm({ title: 'Delete this note?', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(`/notes/${id}`);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const notes = p.notes.filter((n) => filter === 'all' || n.kind === filter || (filter === 'note' && n.kind === 'reply'));

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader icon={Hammer} title="Installation progress" subtitle="Track installation progress and handover." />
        <div className="space-y-5 p-5">
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center gap-3">
                <motion.span initial={false} animate={{ scale: i === stepIdx ? 1.1 : 1 }} className={cn('grid h-8 w-8 place-items-center rounded-full border-2', i < stepIdx || status === 'complete' ? 'border-success bg-success text-white' : i === stepIdx ? 'border-primary text-primary' : 'border-line text-muted-fg')}>
                  {i < stepIdx || status === 'complete' ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                </motion.span>
                <span className={cn('text-sm font-semibold', i === stepIdx ? 'text-fg' : 'text-muted-fg')}>{s.label}</span>
              </li>
            ))}
          </ol>
          {p.install.status === 'complete' ? (
            <div className="rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">✓ Installation complete {p.install.completedAt ? `· ${fmtDateTime(p.install.completedAt)}` : ''}</div>
          ) : install ? (
            <div className="space-y-2">
              {install.status === 'scheduled' || install.status === 'dispatched' ? (
                <Button className="w-full" icon={LogIn} loading={busy === 'appointment.checkin'} onClick={() => run('appointment.checkin', { appointmentId: install._id }, 'Installer checked in')}>Check in to installation</Button>
              ) : null}
              {install.status === 'checked_in' ? (
                <Button className="w-full" variant="success" icon={CheckCircle2} loading={busy === 'install.complete'} onClick={() => run('install.complete', {}, 'Installation complete')}>Mark as complete</Button>
              ) : null}
              <p className="text-xs text-muted-fg">Post-tint care: remind the customer to keep windows rolled up for 48 hours while the adhesive cures.</p>
            </div>
          ) : (
            <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-fg">Book an installation appointment to start tracking progress.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={NotebookPen}
          title={`Notes & tasks (${p.notes.length})`}
          subtitle="Keep tasks, replies and internal notes linked to this project."
          actions={<Tabs layoutId="note-filter" value={filter} onChange={setFilter} tabs={[{ key: 'all', label: 'All' }, { key: 'note', label: 'Notes' }, { key: 'task', label: 'Tasks' }]} />}
        />
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            <Select value={kind} onChange={(e) => setKind(e.target.value as 'note' | 'task')} className="w-28" aria-label="Kind">
              <option value="note">Note</option>
              <option value="task">Task</option>
            </Select>
            <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add installation note (hit Enter to save)…" className="min-w-[200px] flex-1" />
            {kind === 'task' ? <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assign to" className="w-36" /> : null}
            <Button icon={Send} loading={saving} onClick={addNote}>Add</Button>
          </div>
          <div className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {notes.map((n) => (
                <motion.div key={n._id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-xl border border-line p-3">
                  {n.kind === 'task' ? <Checkbox checked={n.done} onChange={(v) => toggle(n._id, v)} /> : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <div className="min-w-0 flex-1">
                    <p className={cn('whitespace-pre-wrap text-sm', n.done && 'text-muted-fg line-through')}>{n.text}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-fg">
                      <Badge tone={n.kind === 'task' ? 'warning' : n.kind === 'reply' ? 'info' : 'neutral'}>{n.kind}</Badge>
                      {n.author ? <span>{n.author}</span> : null}
                      {n.assignedTo ? <span>→ {n.assignedTo}</span> : null}
                      <span>{timeAgo(n.createdAt)}</span>
                    </p>
                  </div>
                  <button type="button" aria-label="Delete note" onClick={() => remove(n._id)} className="rounded-md p-1.5 text-muted-fg hover:bg-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                </motion.div>
              ))}
            </AnimatePresence>
            {!notes.length ? <p className="py-6 text-center text-sm text-muted-fg">No notes yet. Type above and hit Enter.</p> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
