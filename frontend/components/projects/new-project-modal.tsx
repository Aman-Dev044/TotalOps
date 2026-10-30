'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Briefcase, UserPlus, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi, useMeta, useStaff, useStores } from '@/lib/hooks';
import type { Contact, Project, Segment } from '@/lib/types';
import { useStoreScope } from '@/components/providers';
import { Button, Field, Input, Modal, Select, Tabs, Textarea } from '@/components/ui';
import { SEGMENT_ICON } from '@/components/badges';

type Props = { open: boolean; onClose: () => void; contactId?: string };

const EMPTY = {
  title: '', segment: 'automotive' as Segment, storeId: '', ownerId: '', source: 'Website', priority: 'normal', tags: '', requirements: '',
  contact: { name: '', company: '', email: '', phone: '', address: '' },
  vehicle: { year: '', make: '', model: '', bodyType: 'suv', color: '', rego: '' },
  property: { address: '', glazing: 'Single clear', orientation: 'W', type: 'House' },
};

export function NewProjectModal({ open, onClose, contactId }: Props) {
  const router = useRouter();
  const { data: meta } = useMeta();
  const { data: stores } = useStores();
  const { data: staff } = useStaff();
  const { storeId } = useStoreScope();
  const { data: contacts } = useApi<Contact[]>(open ? '/contacts?limit=1000' : null);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [existingId, setExistingId] = useState('');
  const [contactQ, setContactQ] = useState('');
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({ ...EMPTY, storeId: storeId || '' });
    setMode(contactId ? 'existing' : 'new');
    setExistingId(contactId || '');
    setContactQ('');
  }, [open, contactId, storeId]);

  useEffect(() => {
    if (!f.storeId && stores?.length) setF((x) => ({ ...x, storeId: stores[0]._id }));
  }, [stores, f.storeId]);

  const filteredContacts = useMemo(() => {
    const q = contactQ.toLowerCase();
    return (contacts || []).filter((c) => !q || [c.name, c.company, c.phone, c.email].some((v) => (v || '').toLowerCase().includes(q))).slice(0, 60);
  }, [contacts, contactQ]);

  const set = (patch: Partial<typeof EMPTY>) => setF((x) => ({ ...x, ...patch }));
  const auto = f.segment === 'automotive';
  const suggestedTitle = auto
    ? [f.vehicle.make, f.vehicle.model].filter(Boolean).join(' ') + (f.vehicle.make ? ' · tint' : '')
    : f.property.address ? `${f.segment === 'commercial' ? 'Commercial' : 'Residential'} · ${f.property.address}` : '';

  const submit = async () => {
    const title = f.title.trim() || suggestedTitle.trim();
    if (!title) return toast.error('Enter a scope / project title');
    if (mode === 'new' && !f.contact.name.trim()) return toast.error('Enter the contact name');
    if (mode === 'existing' && !existingId) return toast.error('Choose an existing contact');
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title, segment: f.segment, storeId: f.storeId, ownerId: f.ownerId || undefined, source: f.source, priority: f.priority,
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), requirements: f.requirements,
        vehicle: auto ? f.vehicle : undefined, property: auto ? undefined : f.property,
      };
      if (mode === 'existing') body.contactId = existingId;
      else body.contact = f.contact;
      const p = await api.post<Project>('/projects', body);
      toast.success(`${p.number} created`);
      refresh('/projects', '/contacts', '/dashboard');
      onClose();
      router.push(`/projects/${p._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={Briefcase}
      title="New lead / project"
      description="Create a contact and operational project in one step."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>Create project</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {(['automotive', 'residential', 'commercial'] as Segment[]).map((s) => {
            const Icon = SEGMENT_ICON[s];
            const active = f.segment === s;
            return (
              <button key={s} type="button" onClick={() => set({ segment: s })} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-semibold capitalize transition ${active ? 'border-primary bg-primary/10 text-primary shadow-glow' : 'border-line hover:bg-muted'}`}>
                <Icon className="h-5 w-5" />
                {s}
              </button>
            );
          })}
        </div>

        <div>
          <Tabs
            layoutId="np-contact"
            value={mode}
            onChange={setMode}
            tabs={[
              { key: 'new', label: 'New contact', icon: UserPlus },
              { key: 'existing', label: 'Existing contact', icon: Users },
            ]}
          />
          {mode === 'new' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Contact name" required>
                <Input value={f.contact.name} onChange={(e) => set({ contact: { ...f.contact, name: e.target.value } })} placeholder="e.g. Liam Walker" autoFocus />
              </Field>
              <Field label="Company">
                <Input value={f.contact.company} onChange={(e) => set({ contact: { ...f.contact, company: e.target.value } })} placeholder="Optional" />
              </Field>
              <Field label="Phone">
                <Input value={f.contact.phone} onChange={(e) => set({ contact: { ...f.contact, phone: e.target.value } })} placeholder="04xx xxx xxx" />
              </Field>
              <Field label="Email">
                <Input type="email" value={f.contact.email} onChange={(e) => set({ contact: { ...f.contact, email: e.target.value } })} placeholder="name@email.com" />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={f.contact.address} onChange={(e) => set({ contact: { ...f.contact, address: e.target.value } })} />
              </Field>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Input value={contactQ} onChange={(e) => setContactQ(e.target.value)} placeholder="Search contacts by name, phone, email…" />
              <div className="max-h-48 overflow-y-auto rounded-xl border border-line">
                {filteredContacts.map((c) => (
                  <button key={c._id} type="button" onClick={() => setExistingId(c._id)} className={`flex w-full items-center justify-between gap-3 border-b border-line/60 px-3 py-2 text-left text-sm last:border-0 ${existingId === c._id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                    <span className="font-semibold">{c.name}{c.company ? <span className="font-normal text-muted-fg"> · {c.company}</span> : null}</span>
                    <span className="text-xs text-muted-fg">{c.phone || c.email}</span>
                  </button>
                ))}
                {!filteredContacts.length ? <p className="p-4 text-center text-sm text-muted-fg">No contacts found</p> : null}
              </div>
            </div>
          )}
        </div>

        {auto ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Year"><Input value={f.vehicle.year} onChange={(e) => set({ vehicle: { ...f.vehicle, year: e.target.value } })} placeholder="2024" /></Field>
            <Field label="Make"><Input value={f.vehicle.make} onChange={(e) => set({ vehicle: { ...f.vehicle, make: e.target.value } })} placeholder="Toyota" /></Field>
            <Field label="Model"><Input value={f.vehicle.model} onChange={(e) => set({ vehicle: { ...f.vehicle, model: e.target.value } })} placeholder="Hilux SR5" /></Field>
            <Field label="Body type" hint="Loads the glass template">
              <Select value={f.vehicle.bodyType} onChange={(e) => set({ vehicle: { ...f.vehicle, bodyType: e.target.value } })}>
                {(meta?.bodyTypes || []).map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </Select>
            </Field>
            <Field label="Colour"><Input value={f.vehicle.color} onChange={(e) => set({ vehicle: { ...f.vehicle, color: e.target.value } })} placeholder="Pearl white" /></Field>
            <Field label="Rego"><Input value={f.vehicle.rego} onChange={(e) => set({ vehicle: { ...f.vehicle, rego: e.target.value } })} placeholder="1ABC123" /></Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Site address" className="sm:col-span-3"><Input value={f.property.address} onChange={(e) => set({ property: { ...f.property, address: e.target.value } })} /></Field>
            <Field label="Property type"><Input value={f.property.type} onChange={(e) => set({ property: { ...f.property, type: e.target.value } })} /></Field>
            <Field label="Glazing">
              <Select value={f.property.glazing} onChange={(e) => set({ property: { ...f.property, glazing: e.target.value } })}>
                {['Single clear', 'Single tinted', 'Double glazed', 'Double glazed low-E', 'Laminated', 'Toughened'].map((g) => <option key={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label="Main orientation">
              <Select value={f.property.orientation} onChange={(e) => set({ property: { ...f.property, orientation: e.target.value } })}>
                {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Scope / project title" hint={!f.title && suggestedTitle ? `Will use “${suggestedTitle}”` : undefined} className="sm:col-span-2">
            <Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={suggestedTitle || 'e.g. Ceramic tint · sides & rear'} />
          </Field>
          <Field label="Store" required>
            <Select value={f.storeId} onChange={(e) => set({ storeId: e.target.value })}>
              {(stores || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={f.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
              <option value="">Unassigned</option>
              {(staff || []).filter((s) => s.active).map((s) => <option key={s._id} value={s._id}>{s.name} · {s.title || s.role}</option>)}
            </Select>
          </Field>
          <Field label="Source">
            <Select value={f.source} onChange={(e) => set({ source: e.target.value })}>
              {(meta?.sources || ['Website']).map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <Field label="Tags" hint="Comma-separated" className="sm:col-span-2"><Input value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="Dealer, Repeat customer" /></Field>
          <Field label="Initial notes / scope" className="sm:col-span-2">
            <Textarea value={f.requirements} onChange={(e) => set({ requirements: e.target.value })} placeholder="Customer requests, film preferences, timeline…" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
