'use client';

import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useStores } from '@/lib/hooks';
import type { Staff } from '@/lib/types';
import { Button, Field, Input, Modal, Select, Switch } from '@/components/ui';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#d946ef'];

export function StaffModal({ open, onClose, member }: { open: boolean; onClose: () => void; member?: Staff | null }) {
  const { data: stores } = useStores();
  const [form, setForm] = useState<Partial<Staff> & { skillsText?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(member ? { ...member, skillsText: (member.skills || []).join(', ') } : { role: 'installer', color: COLORS[Math.floor(Math.random() * COLORS.length)], hoursPerWeek: 38, rating: 4.8, active: true, skillsText: '', storeId: stores?.[0]?._id });
  }, [open, member, stores]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError('');
    if (!form.name?.trim()) return setError('Enter a name.');
    if (!form.storeId) return setError('Choose a home store.');
    setBusy(true);
    const { skillsText, _id, ...rest } = form;
    const payload = { ...rest, name: form.name.trim(), skills: (skillsText || '').split(',').map((s) => s.trim()).filter(Boolean), hoursPerWeek: Number(form.hoursPerWeek) || 38, rating: Math.min(5, Math.max(0, Number(form.rating) || 0)) };
    try {
      if (member) await api.patch(`/staff/${member._id}`, payload);
      else await api.post('/staff', payload);
      toast.success(member ? 'Team member updated' : 'Team member added');
      refresh('/staff', '/dashboard');
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
      icon={UserPlus}
      title={member ? 'Edit team member' : 'Add team member'}
      description="Team members don't sign in — they're scheduled, dispatched and tracked by the administrator."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required><Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Jake Reynolds" autoFocus /></Field>
        <Field label="Title / specialty"><Input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Senior Automotive Lead" /></Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="installer">Installer</option>
            <option value="manager">Store manager</option>
            <option value="sales">Sales consultant</option>
            <option value="office">Office / admin</option>
          </Select>
        </Field>
        <Field label="Home store" required>
          <Select value={form.storeId || ''} onChange={(e) => set('storeId', e.target.value)}>
            <option value="">Choose…</option>
            {(stores || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Skills" hint="Comma separated" className="sm:col-span-2"><Input value={form.skillsText || ''} onChange={(e) => set('skillsText', e.target.value)} placeholder="Ceramic IR, Rear glass shrink, Boom lift certified" /></Field>
        <Field label="Contracted hours / week"><Input type="number" min={0} max={80} value={form.hoursPerWeek ?? 38} onChange={(e) => set('hoursPerWeek', Number(e.target.value))} /></Field>
        <Field label="Quality rating (0–5)"><Input type="number" step={0.1} min={0} max={5} value={form.rating ?? 4.8} onChange={(e) => set('rating', Number(e.target.value))} /></Field>
        <Field label="Calendar colour" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => set('color', c)} className="h-8 w-8 rounded-full ring-offset-2 ring-offset-card transition hover:scale-110" style={{ background: c, boxShadow: form.color === c ? `0 0 0 2px hsl(var(--card)), 0 0 0 4px ${c}` : undefined }} />
            ))}
          </div>
        </Field>
        <div className="sm:col-span-2"><Switch checked={form.active !== false} onChange={(v) => set('active', v)} label="Active — available for scheduling" /></div>
      </div>
      {error ? <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
    </Modal>
  );
}
