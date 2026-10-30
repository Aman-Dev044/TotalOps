'use client';

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useMeta, useStores } from '@/lib/hooks';
import type { Contact } from '@/lib/types';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';

export function ContactModal({ open, onClose, contact, onSaved }: { open: boolean; onClose: () => void; contact?: Contact | null; onSaved?: (c: Contact) => void }) {
  const { data: stores } = useStores();
  const { data: meta } = useMeta();
  const [form, setForm] = useState<Partial<Contact> & { tagsText?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(contact ? { ...contact, tagsText: (contact.tags || []).join(', ') } : { status: 'prospect', segment: 'automotive', source: 'Direct', tagsText: '' });
  }, [open, contact]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError('');
    if (!form.name?.trim()) return setError('Enter the contact name.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Enter a valid email address.');
    setBusy(true);
    const { tagsText, _id, createdAt, updatedAt, ...rest } = form;
    const payload = { ...rest, name: form.name.trim(), tags: (tagsText || '').split(',').map((t) => t.trim()).filter(Boolean), storeId: form.storeId || undefined };
    try {
      const saved = contact ? await api.patch<Contact>(`/contacts/${contact._id}`, payload) : await api.post<Contact>('/contacts', payload);
      toast.success(contact ? 'Contact saved' : 'Contact created');
      refresh('/contacts', '/projects', '/search');
      onSaved?.(saved);
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
      icon={UserRound}
      title={contact ? 'Edit contact' : 'New contact'}
      description="Contact details are stored in your TotalOps workspace."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>{contact ? 'Save contact' : 'Create contact'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" required><Input autoFocus value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Liam Walker" /></Field>
        <Field label="Company"><Input value={form.company || ''} onChange={(e) => set('company', e.target.value)} placeholder="Optional" /></Field>
        <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="04xx xxx xxx" /></Field>
        <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Relationship">
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="prospect">Prospect</option>
            <option value="active">Active customer</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Segment">
          <Select value={form.segment} onChange={(e) => set('segment', e.target.value as Contact['segment'])}>
            <option value="automotive">Automotive</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </Select>
        </Field>
        <Field label="Source">
          <Select value={form.source || ''} onChange={(e) => set('source', e.target.value)}>
            {Array.from(new Set([...(meta?.sources || []), form.source || 'Direct'])).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Home store">
          <Select value={form.storeId || ''} onChange={(e) => set('storeId', e.target.value)}>
            <option value="">Any store</option>
            {(stores || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Tags" hint="Comma separated" className="sm:col-span-2"><Input value={form.tagsText || ''} onChange={(e) => set('tagsText', e.target.value)} placeholder="VIP, Fleet, Repeat customer" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
      {error ? <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
    </Modal>
  );
}
