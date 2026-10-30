'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, Circle, Gauge, MessageSquareReply, NotebookPen, Pencil, Plus, RotateCcw, StickyNote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi, useStaff } from '@/lib/hooks';
import { fmtDate, timeAgo, todayStr } from '@/lib/format';
import type { Note, Project } from '@/lib/types';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, SearchInput, Select, Tabs, Textarea, cn, useConfirm } from '@/components/ui';

type Tab = 'all' | 'task' | 'note' | 'reply' | 'done';
const KIND_META = {
  task: { label: 'Task', icon: CheckCircle2, tone: 'primary' as const },
  note: { label: 'Note', icon: StickyNote, tone: 'accent' as const },
  reply: { label: 'Reply', icon: MessageSquareReply, tone: 'info' as const },
};

export default function NotesPage() {
  const { data, error, isLoading, mutate } = useApi<Note[]>('/notes');
  const { data: projects } = useApi<Project[]>('/projects?archived=all');
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const today = todayStr();

  const projectOf = (id?: string) => projects?.find((p) => p._id === id);

  const counts = useMemo(() => {
    const all = data || [];
    return {
      all: all.filter((n) => !n.done).length,
      task: all.filter((n) => n.kind === 'task' && !n.done).length,
      note: all.filter((n) => n.kind === 'note' && !n.done).length,
      reply: all.filter((n) => n.kind === 'reply' && !n.done).length,
      done: all.filter((n) => n.done).length,
    };
  }, [data]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || [])
      .filter((n) => (tab === 'done' ? n.done : !n.done && (tab === 'all' || n.kind === tab)))
      .filter((n) => !projectId || n.projectId === projectId)
      .filter((n) => !s || [n.text, n.assignedTo, n.author, projectOf(n.projectId)?.number].some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => {
        const od = Number(isOverdue(b, today)) - Number(isOverdue(a, today));
        if (od) return od;
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.createdAt.localeCompare(a.createdAt);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tab, q, projectId, projects, today]);

  const toggleDone = async (n: Note) => {
    mutate((cur) => cur?.map((x) => (x._id === n._id ? { ...x, done: !n.done } : x)), { revalidate: false });
    try {
      await api.patch(`/notes/${n._id}`, { done: !n.done });
      toast.success(n.done ? 'Task reopened' : 'Task completed');
      refresh('/dashboard');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      mutate();
    }
  };

  const remove = async (n: Note) => {
    if (!(await confirm({ title: 'Delete this note?', description: n.text.slice(0, 140), confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(`/notes/${n._id}`);
      toast.success('Note deleted');
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <div>
      <PageHeader
        icon={Gauge}
        eyebrow="Operations"
        title="Notes & tasks"
        subtitle="Keep tasks, replies and internal notes linked to the right project."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Add note
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          layoutId="notes-tabs"
          tabs={[
            { key: 'all', label: 'All open', count: counts.all },
            { key: 'task', label: 'Tasks', count: counts.task },
            { key: 'note', label: 'Notes', count: counts.note },
            { key: 'reply', label: 'Replies', count: counts.reply },
            { key: 'done', label: 'Done', count: counts.done },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <SearchInput value={q} onChange={setQ} placeholder="Search notes…" className="w-full sm:w-64" />
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full sm:w-56" aria-label="Filter by project">
            <option value="">All projects</option>
            {(projects || []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.number} · {p.contact?.name || p.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && !data ? (
        <PageLoader />
      ) : !list.length ? (
        <Card>
          <EmptyState icon={NotebookPen} title="No matching notes" description="Add a note or change the current tab." action={<Button icon={Plus} onClick={() => setEditing('new')}>Add note</Button>} />
        </Card>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {list.map((n) => {
              const meta = KIND_META[n.kind] || KIND_META.note;
              const overdue = isOverdue(n, today);
              const project = projectOf(n.projectId);
              return (
                <motion.div key={n._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  <Card className={cn('flex gap-3 p-4', overdue && 'border-danger/40 bg-danger/[0.03]')}>
                    <button
                      type="button"
                      onClick={() => toggleDone(n)}
                      aria-label={n.done ? 'Reopen' : 'Mark as complete'}
                      className={cn('mt-0.5 shrink-0 transition hover:scale-110', n.done ? 'text-success' : 'text-muted-fg hover:text-primary')}
                    >
                      {n.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn('whitespace-pre-wrap text-sm', n.done && 'text-muted-fg line-through')}>{n.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-fg">
                        <Badge tone={meta.tone}>
                          <meta.icon className="h-3 w-3" /> {meta.label}
                        </Badge>
                        {project ? (
                          <Link href={`/projects/${project._id}`} className="font-semibold text-primary hover:underline">
                            {project.number} · {project.contact?.name || project.title}
                          </Link>
                        ) : null}
                        {n.dueDate ? (
                          <span className={cn('flex items-center gap-1', overdue && 'font-semibold text-danger')}>
                            <CalendarClock className="h-3.5 w-3.5" />
                            {overdue ? 'Overdue · ' : n.dueDate === today ? 'Due today · ' : 'Due '}
                            {fmtDate(n.dueDate)}
                          </span>
                        ) : null}
                        {n.assignedTo ? (
                          <span className="flex items-center gap-1">
                            <Avatar name={n.assignedTo} size={18} /> {n.assignedTo}
                          </span>
                        ) : null}
                        <span>
                          {n.author ? `${n.author} · ` : ''}
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      {n.done ? (
                        <Button size="xs" variant="ghost" icon={RotateCcw} onClick={() => toggleDone(n)}>
                          Reopen
                        </Button>
                      ) : null}
                      <button type="button" aria-label="Edit note" onClick={() => setEditing(n)} className="rounded-lg p-1.5 text-muted-fg hover:bg-muted hover:text-fg">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Delete note" onClick={() => remove(n)} className="rounded-lg p-1.5 text-muted-fg hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <NoteModal note={editing} projects={projects || []} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </div>
  );
}

function isOverdue(n: Note, today: string) {
  return !n.done && !!n.dueDate && n.dueDate < today;
}

function NoteModal({ note, projects, onClose, onSaved }: { note: Note | 'new' | null; projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const { data: staff } = useStaff();
  const [kind, setKind] = useState<Note['kind']>('task');
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const isNew = note === 'new';

  useEffect(() => {
    if (!note) return;
    if (note === 'new') {
      setKind('task');
      setText('');
      setProjectId('');
      setAssignedTo('');
      setDueDate(todayStr());
      setDone(false);
    } else {
      setKind(note.kind);
      setText(note.text);
      setProjectId(note.projectId || '');
      setAssignedTo(note.assignedTo || '');
      setDueDate(note.dueDate || '');
      setDone(note.done);
    }
  }, [note]);

  const save = async () => {
    if (!text.trim()) return toast.error('Enter note text.');
    setBusy(true);
    const body = { kind, text: text.trim(), projectId: projectId || null, assignedTo, dueDate: kind === 'task' ? dueDate : '', done };
    try {
      if (isNew) await api.post('/notes', body);
      else if (note) await api.patch(`/notes/${note._id}`, body);
      toast.success('Note saved.');
      onSaved();
      refresh('/dashboard');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!note}
      onClose={onClose}
      icon={NotebookPen}
      title={isNew ? 'Add note' : 'Edit note'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save note
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind">
          <Select value={kind} onChange={(e) => setKind(e.target.value as Note['kind'])}>
            <option value="task">Task</option>
            <option value="note">Note</option>
            <option value="reply">Reply</option>
          </Select>
        </Field>
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project (general)</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.number} · {p.contact?.name || p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Text" className="sm:col-span-2" required>
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs to happen?" autoFocus />
        </Field>
        <Field label="Assigned to">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {(staff || []).filter((s) => s.active).map((s) => (
              <option key={s._id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {kind === 'task' ? (
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
