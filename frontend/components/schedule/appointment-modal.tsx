'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi, useDealers, useMeta, useStaff, useStores } from '@/lib/hooks';
import { addDays, todayStr, vehicleLabel } from '@/lib/format';
import type { Appointment, Project } from '@/lib/types';
import { Button, Checkbox, Field, Input, Modal, Select, Switch, Textarea, useConfirm } from '@/components/ui';

export type AppointmentDraft = Partial<Appointment> & { projectId?: string };

const TYPE_LABEL: Record<string, string> = { consultation: 'Consultation', measurement: 'Measurement', installation: 'Installation', site_visit: 'Site visit', collection: 'Collection' };
export const apptTypeLabel = (t: string) => TYPE_LABEL[t] || t;

function plusHours(t: string, h: number) {
  const [hh, mm] = t.split(':').map(Number);
  const total = Math.min(23 * 60 + 30, hh * 60 + mm + h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Book or edit an appointment on any project. Saves through the project action endpoint (conflicts are checked server-side). */
export function AppointmentModal({ open, onClose, initial, onSaved, lockProject }: { open: boolean; onClose: () => void; initial?: AppointmentDraft | null; onSaved?: () => void; lockProject?: boolean }) {
  const { data: meta } = useMeta();
  const { data: stores } = useStores();
  const { data: staff } = useStaff();
  const { data: dealers } = useDealers();
  const { data: projects } = useApi<Project[]>(open ? '/projects?limit=500' : null);
  const confirm = useConfirm();
  const editing = !!initial?._id;

  const [projectId, setProjectId] = useState('');
  const [projectQ, setProjectQ] = useState('');
  const [form, setForm] = useState<AppointmentDraft>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = initial?.start || '09:00';
    setProjectId(initial?.projectId || '');
    setProjectQ('');
    setError('');
    setForm({
      type: 'installation',
      date: todayStr(),
      start,
      end: initial?.end || plusHours(start, 2),
      location: 'in_shop',
      status: 'scheduled',
      shopStatus: 'booked',
      reminder: true,
      coInstallerIds: [],
      ...initial,
    });
  }, [open, initial]);

  const project = useMemo(() => (projects || []).find((p) => p._id === projectId), [projects, projectId]);

  // Default store/location/address from the chosen project.
  useEffect(() => {
    if (!project || editing) return;
    setForm((f) => ({
      ...f,
      storeId: f.storeId || project.storeId,
      location: project.segment === 'automotive' ? 'in_shop' : 'on_site',
      address: f.address || (project.segment === 'automotive' ? project.store?.address : project.location?.address || project.contact?.address) || '',
      dealer: f.dealer || (project.dealerId ? (dealers || []).find((d) => d._id === project.dealerId)?.name : '') || '',
    }));
  }, [project, editing, dealers]);

  const store = (stores || []).find((s) => s._id === form.storeId);
  const installers = (staff || []).filter((s) => s.active && String(s.storeId) === String(form.storeId) && s.role === 'installer');
  const coCandidates = (staff || []).filter((s) => s.active && s.role === 'installer' && s._id !== form.installerId);
  const filteredProjects = (projects || []).filter((p) => {
    const q = projectQ.trim().toLowerCase();
    if (!q) return true;
    return [p.number, p.title, p.contact?.name, p.vehicle?.rego].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const set = <K extends keyof AppointmentDraft>(k: K, v: AppointmentDraft[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError('');
    if (!projectId) return setError('Choose a project for this booking.');
    if (!form.date) return setError('Choose a valid date.');
    if (!form.start || !form.end || form.end <= form.start) return setError('End time must be after the start time.');
    if (!form.storeId) return setError('Choose a store.');
    setBusy(true);
    try {
      const { projectId: _p, ...appointment } = form;
      await api.action(projectId, 'appointment.save', { appointment });
      toast.success(editing ? 'Appointment updated' : 'Appointment booked');
      refresh('/schedule', '/projects', '/dashboard');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial?._id || !projectId) return;
    const ok = await confirm({ title: 'Remove this booking?', description: 'Only the appointment is removed. The customer, project and invoice remain saved.', confirmLabel: 'Remove booking', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await api.action(projectId, 'appointment.remove', { appointmentId: initial._id });
      toast.success('Booking removed. The project remains in your CRM.');
      refresh('/schedule', '/projects', '/dashboard');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={CalendarPlus}
      title={editing ? 'Edit appointment' : 'Book appointment'}
      description="Assign an installer, date, time, site and reminder. Conflicts are checked before saving."
      footer={
        <>
          {editing ? (
            <Button variant="ghost" icon={Trash2} className="mr-auto text-danger" onClick={remove} disabled={busy}>
              Remove
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save appointment
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project" className="sm:col-span-2" required>
          {lockProject || editing ? (
            <div className="input flex items-center truncate bg-muted/40">{project ? `${project.number} · ${project.title}` : 'Loading project…'}</div>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Search job, customer or rego…" value={projectQ} onChange={(e) => setProjectQ(e.target.value)} />
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Choose a project…</option>
                {filteredProjects.slice(0, 200).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.number} · {p.title} {p.contact?.name ? `— ${p.contact.name}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {project ? (
            <span className="mt-1 block text-xs text-muted-fg">
              {project.contact?.name} {project.contact?.phone ? `· ${project.contact.phone}` : ''} {vehicleLabel(project.vehicle) ? `· ${vehicleLabel(project.vehicle)}` : ''} · {project.stageLabel}
            </span>
          ) : null}
        </Field>
        <Field label="Appointment type">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {(meta?.appointmentTypes || Object.keys(TYPE_LABEL)).map((t) => (
              <option key={t} value={t}>
                {apptTypeLabel(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" required>
          <Input type="date" value={form.date || ''} min={editing ? undefined : addDays(todayStr(), -30)} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Start time" required>
          <Input
            type="time"
            step={900}
            value={form.start || ''}
            onChange={(e) => {
              const start = e.target.value;
              setForm((f) => ({ ...f, start, end: f.end && f.end > start ? f.end : plusHours(start, 2) }));
            }}
          />
        </Field>
        <Field label="End time" required>
          <Input type="time" step={900} value={form.end || ''} onChange={(e) => set('end', e.target.value)} />
        </Field>
        <Field label="Store" required>
          <Select value={form.storeId || ''} onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value, installerId: undefined, bay: '' }))}>
            <option value="">Choose a store…</option>
            {(stores || []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lead installer" hint={form.storeId && !installers.length ? 'No installers are based at this store.' : undefined}>
          <Select value={form.installerId || ''} onChange={(e) => set('installerId', e.target.value || undefined)}>
            <option value="">Unassigned</option>
            {installers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shop bay / station">
          <Select value={form.bay || ''} onChange={(e) => set('bay', e.target.value)}>
            <option value="">No bay</option>
            {(store?.bays || []).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Location">
          <Select value={form.location} onChange={(e) => set('location', e.target.value as 'in_shop' | 'on_site')}>
            <option value="in_shop">In shop</option>
            <option value="on_site">At customer location</option>
          </Select>
        </Field>
        <Field label="Site / drop-off address" className="sm:col-span-2">
          <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder={store?.address || 'Address'} />
        </Field>
        <Field label="Co-installers / assisting staff" className="sm:col-span-2">
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-line p-3">
            {coCandidates.length === 0 ? <span className="text-xs text-muted-fg">No other installers.</span> : null}
            {coCandidates.map((s) => (
              <Checkbox
                key={s._id}
                checked={(form.coInstallerIds || []).includes(s._id)}
                onChange={(v) => set('coInstallerIds', v ? [...(form.coInstallerIds || []), s._id] : (form.coInstallerIds || []).filter((x) => x !== s._id))}
                label={<span className="text-xs">{s.name}</span>}
              />
            ))}
          </div>
        </Field>
        <Field label="Dealer / fleet account">
          <Select value={form.dealer || ''} onChange={(e) => set('dealer', e.target.value)}>
            <option value="">Retail customer</option>
            {(dealers || []).map((d) => (
              <option key={d._id} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Appointment status" hint="Check-in and completion are normally recorded from My Day.">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as Appointment['status'])}>
            {(meta?.appointmentStatuses || ['scheduled', 'dispatched', 'checked_in', 'completed', 'cancelled']).map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Access, travel or handover notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Loading bay access, customer preferences, keys…" />
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={form.reminder !== false} onChange={(v) => set('reminder', v)} label={<span className="text-sm">Send a day-before reminder (simulated SMS automation)</span>} />
        </div>
      </div>
      {error ? <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
    </Modal>
  );
}
