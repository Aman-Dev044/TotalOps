'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CalendarPlus, CheckCircle2, Clock, LogIn, MapPin, Pencil, RotateCcw, Trash2, Truck, Users } from 'lucide-react';
import { useDealers, useMeta, useStaff, useStores } from '@/lib/hooks';
import { addDays, fmtDate, fmtTime, todayStr } from '@/lib/format';
import type { Appointment } from '@/lib/types';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import { ApptStatusBadge } from '@/components/badges';
import type { RunFn, TabProps } from './use-project-action';

export function AppointmentsTab({ p, run, busy }: TabProps) {
  const confirm = useConfirm();
  const { data: staff } = useStaff();
  const { data: meta } = useMeta();
  const [editing, setEditing] = useState<Partial<Appointment> | null>(null);
  const appts = [...p.appointments].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const name = (id?: string) => staff?.find((s) => s._id === id);

  const remove = async (a: Appointment) => {
    const ok = await confirm({ title: 'Remove this booking?', description: 'Only the appointment is removed. The customer, project and invoice remain saved.', confirmLabel: 'Remove booking', danger: true });
    if (ok) await run('appointment.remove', { appointmentId: a._id }, 'Appointment removed');
  };

  return (
    <Card>
      <CardHeader
        icon={CalendarDays}
        title={`Appointment details (${appts.length})`}
        subtitle="Schedule multiple appointments — e.g. consultation with one team member, installation with another."
        actions={<Button icon={CalendarPlus} onClick={() => setEditing({})}>Add appointment</Button>}
      />
      <div className="p-5">
        {!appts.length ? (
          <EmptyState icon={CalendarDays} title="No appointments booked for this project yet." action={<Button icon={CalendarPlus} onClick={() => setEditing({})}>Schedule first appointment</Button>} />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {appts.map((a) => {
                const lead = name(a.installerId);
                const past = a.date < todayStr();
                return (
                  <motion.div key={a._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className={`rounded-2xl border p-4 transition ${a.status === 'cancelled' ? 'border-dashed border-line opacity-60' : 'border-line bg-bg/40 hover:border-primary/30'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-primary/10 py-1.5 text-center text-primary">
                          <span className="text-[10px] font-bold uppercase">{fmtDate(a.date, { month: 'short' })}</span>
                          <span className="font-display text-xl font-extrabold leading-none">{fmtDate(a.date, { day: 'numeric' })}</span>
                          <span className="text-[10px] font-semibold">{fmtDate(a.date, { weekday: 'short' })}</span>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display font-bold capitalize">{a.type.replace('_', ' ')}</p>
                            <ApptStatusBadge status={a.status} />
                            {a.location === 'in_shop' ? <Badge tone="info">In shop</Badge> : <Badge tone="accent">On site</Badge>}
                            {past && a.status === 'scheduled' ? <Badge tone="danger">Overdue</Badge> : null}
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-fg">
                            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtTime(a.start)} – {fmtTime(a.end)}</span>
                            {a.bay ? <span>{a.bay}</span> : null}
                            {a.address ? <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.address}</span> : null}
                            {a.dealer ? <Badge tone="primary">{a.dealer}</Badge> : null}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            {lead ? <span className="flex items-center gap-1.5 font-semibold"><Avatar name={lead.name} color={lead.color} size={22} />Lead: {lead.name}</span> : <span className="text-muted-fg">No installer assigned</span>}
                            {a.coInstallerIds?.length ? <span className="flex items-center gap-1 text-muted-fg"><Users className="h-3.5 w-3.5" />Co-installers: {a.coInstallerIds.map((id) => name(id)?.name).filter(Boolean).join(', ')}</span> : null}
                          </div>
                          {a.notes ? <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-fg">{a.notes}</p> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {a.location === 'in_shop' && a.status !== 'cancelled' ? (
                          <Select aria-label="Shop status" value={a.shopStatus} onChange={(e) => run('appointment.shopStatus', { appointmentId: a._id, shopStatus: e.target.value }, 'Shop status updated')} className="h-8 w-auto text-xs">
                            {(meta?.shopStatuses || []).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </Select>
                        ) : null}
                        {a.status === 'scheduled' && a.location === 'on_site' ? <Button size="sm" variant="outline" icon={Truck} loading={busy === 'appointment.dispatch'} onClick={() => run('appointment.dispatch', { appointmentId: a._id }, 'Installer dispatched')}>Dispatch</Button> : null}
                        {a.status === 'scheduled' || a.status === 'dispatched' ? <Button size="sm" icon={LogIn} loading={busy === 'appointment.checkin'} onClick={() => run('appointment.checkin', { appointmentId: a._id }, 'Appointment checked in')}>Check in</Button> : null}
                        {a.status === 'checked_in' ? <Button size="sm" variant="success" icon={CheckCircle2} loading={busy === 'appointment.complete'} onClick={() => run('appointment.complete', { appointmentId: a._id }, 'Visit completed')}>Complete</Button> : null}
                        {a.status === 'completed' && !p.invoice ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => run('appointment.reopen', { appointmentId: a._id }, 'Appointment reopened')}>Reopen</Button> : null}
                        {a.status !== 'completed' ? <Button size="icon" variant="ghost" aria-label="Edit or reschedule this appointment" onClick={() => setEditing(a)}><Pencil className="h-4 w-4" /></Button> : null}
                        {a.status !== 'completed' ? <Button size="icon" variant="ghost" aria-label="Remove appointment" onClick={() => remove(a)}><Trash2 className="h-4 w-4 text-danger" /></Button> : null}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
      <AppointmentModal p={p} run={run} value={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

export function AppointmentModal({ p, run, value, onClose }: { p: TabProps['p']; run: RunFn; value: Partial<Appointment> | null; onClose: () => void }) {
  const { data: stores } = useStores();
  const { data: staff } = useStaff();
  const { data: dealers } = useDealers();
  const { data: meta } = useMeta();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const open = !!value;

  useEffect(() => {
    if (!value) return;
    const auto = p.segment === 'automotive';
    const defaultType = p.proposal?.status === 'approved' ? 'installation' : p.stage === 'lead' ? 'consultation' : !p.totals.panes ? 'measurement' : 'installation';
    setF({
      type: value.type || defaultType,
      date: value.date || addDays(todayStr(), 1),
      start: value.start || '09:00',
      end: value.end || (auto ? '12:00' : '15:00'),
      storeId: value.storeId || p.storeId || '',
      installerId: value.installerId || '',
      coInstallerIds: value.coInstallerIds || [],
      bay: value.bay ?? (auto ? 'Bay 1' : 'Mobile Bay'),
      location: value.location || (auto ? 'in_shop' : 'on_site'),
      address: value.address ?? (auto ? p.store?.address || '' : p.location?.address || p.property?.address || p.contact?.address || ''),
      dealer: value.dealer ?? (dealers?.find((d) => d._id === p.dealerId)?.name || ''),
      notes: value.notes || '',
      reminder: value.reminder ?? true,
      shopStatus: value.shopStatus,
      _id: value._id,
    });
  }, [value, p, dealers]);

  const store = stores?.find((s) => s._id === f.storeId);
  const storeInstallers = useMemo(() => (staff || []).filter((s) => s.active && s.storeId === f.storeId && s.role === 'installer'), [staff, f.storeId]);
  const others = (staff || []).filter((s) => s.active && s._id !== f.installerId && s.role === 'installer');
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));

  const save = async () => {
    setBusy(true);
    const { _id, ...rest } = f;
    const res = await run('appointment.save', { appointment: _id ? { ...rest, _id } : rest }, _id ? 'Appointment updated' : 'Appointment booked');
    setBusy(false);
    if (res) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={CalendarPlus}
      title={f._id ? 'Edit appointment' : 'Schedule appointment'}
      description="Assign an installer, date, time, site and reminder. Conflicts are checked before saving."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save appointment</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Appointment type">
          <Select value={f.type} onChange={(e) => set({ type: e.target.value })}>
            {(meta?.appointmentTypes || ['consultation', 'measurement', 'installation']).map((t) => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={f.date || ''} onChange={(e) => set({ date: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start"><Input type="time" value={f.start || ''} onChange={(e) => set({ start: e.target.value })} /></Field>
          <Field label="End"><Input type="time" value={f.end || ''} onChange={(e) => set({ end: e.target.value })} /></Field>
        </div>
        <Field label="Store">
          <Select value={f.storeId} onChange={(e) => set({ storeId: e.target.value, installerId: '', bay: stores?.find((s) => s._id === e.target.value)?.bays?.[0] || '' })}>
            {(stores || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Lead installer" hint={!storeInstallers.length ? 'No installers at this store' : undefined}>
          <Select value={f.installerId} onChange={(e) => set({ installerId: e.target.value, coInstallerIds: (f.coInstallerIds || []).filter((x: string) => x !== e.target.value) })}>
            <option value="">Unassigned</option>
            {storeInstallers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Shop bay / station">
          <Select value={f.bay} onChange={(e) => set({ bay: e.target.value })}>
            <option value="">—</option>
            {(store?.bays || []).map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Location">
          <Select value={f.location} onChange={(e) => set({ location: e.target.value })}>
            <option value="in_shop">In shop</option>
            <option value="on_site">On site / mobile</option>
          </Select>
        </Field>
        <Field label="Installation / site address" className="sm:col-span-2"><Input value={f.address || ''} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field label="Co-installers / assisting staff" className="sm:col-span-3">
          <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-xl border border-line p-2">
            {others.map((s) => {
              const on = (f.coInstallerIds || []).includes(s._id);
              return (
                <button key={s._id} type="button" onClick={() => set({ coInstallerIds: on ? f.coInstallerIds.filter((x: string) => x !== s._id) : [...(f.coInstallerIds || []), s._id] })} className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold transition ${on ? 'border-primary bg-primary/10 text-primary' : 'border-line hover:bg-muted'}`}>
                  <Avatar name={s.name} color={s.color} size={18} />
                  {s.name}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Dealer / fleet account">
          <Select value={f.dealer} onChange={(e) => set({ dealer: e.target.value })}>
            <option value="">Retail customer</option>
            {(dealers || []).map((d) => <option key={d._id} value={d.name}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Access, travel or handover notes" className="sm:col-span-2"><Textarea value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} rows={2} /></Field>
        <div className="sm:col-span-3">
          <Switch checked={!!f.reminder} onChange={(v) => set({ reminder: v })} label="Send a day-before reminder (automation, simulated)" />
        </div>
      </div>
    </Modal>
  );
}
