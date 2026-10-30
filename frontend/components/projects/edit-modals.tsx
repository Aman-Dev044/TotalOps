'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, UserRound } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { refresh, useDealers, useMeta, useStaff, useStores } from '@/lib/hooks';
import type { ProjectDetail } from '@/lib/types';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import type { RunFn } from './use-project-action';

export function EditProjectModal({ p, open, onClose, reload }: { p: ProjectDetail; open: boolean; onClose: () => void; reload: () => Promise<unknown> }) {
  const { data: meta } = useMeta();
  const { data: stores } = useStores();
  const { data: staff } = useStaff();
  const { data: dealers } = useDealers();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({
      title: p.title, segment: p.segment, storeId: p.storeId || '', ownerId: p.ownerId || '', dealerId: p.dealerId || '', source: p.source, priority: p.priority,
      tags: (p.tags || []).join(', '), reference: p.reference || '', requirements: p.requirements || '',
      vehicle: { ...p.vehicle }, property: { ...p.property }, location: { type: p.location?.type || 'in_shop', address: p.location?.address || '' },
    });
  }, [open, p]);

  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/projects/${p._id}`, { ...f, tags: String(f.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean) });
      toast.success('Project details saved');
      await reload();
      refresh('/projects');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const auto = f.segment === 'automotive';
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={Pencil} title="Edit project & asset details" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save project details</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Project title / scope" className="sm:col-span-2"><Input value={f.title || ''} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Segment">
          <Select value={f.segment} onChange={(e) => set({ segment: e.target.value })}>
            <option value="automotive">Automotive</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </Select>
        </Field>
        <Field label="Owning store">
          <Select value={f.storeId} onChange={(e) => set({ storeId: e.target.value })}>
            {(stores || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Project owner">
          <Select value={f.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
            <option value="">Unassigned</option>
            {(staff || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Dealer / fleet account">
          <Select value={f.dealerId} onChange={(e) => set({ dealerId: e.target.value })}>
            <option value="">Retail customer</option>
            {(dealers || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={f.source} onChange={(e) => set({ source: e.target.value })}>
            {Array.from(new Set([f.source, ...(meta?.sources || [])])).filter(Boolean).map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>
        {auto ? (
          <>
            <Field label="Year"><Input value={f.vehicle?.year || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, year: e.target.value } })} /></Field>
            <Field label="Make"><Input value={f.vehicle?.make || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, make: e.target.value } })} /></Field>
            <Field label="Model"><Input value={f.vehicle?.model || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, model: e.target.value } })} /></Field>
            <Field label="Body type">
              <Select value={f.vehicle?.bodyType || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, bodyType: e.target.value } })}>
                <option value="">—</option>
                {(meta?.bodyTypes || []).map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </Select>
            </Field>
            <Field label="Colour"><Input value={f.vehicle?.color || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, color: e.target.value } })} /></Field>
            <Field label="Rego"><Input value={f.vehicle?.rego || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, rego: e.target.value } })} /></Field>
            <Field label="VIN"><Input value={f.vehicle?.vin || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, vin: e.target.value } })} /></Field>
            <Field label="Stock / PO number"><Input value={f.vehicle?.stockPo || ''} onChange={(e) => set({ vehicle: { ...f.vehicle, stockPo: e.target.value } })} /></Field>
          </>
        ) : (
          <>
            <Field label="Property type"><Input value={f.property?.type || ''} onChange={(e) => set({ property: { ...f.property, type: e.target.value } })} /></Field>
            <Field label="Glazing">
              <Select value={f.property?.glazing || ''} onChange={(e) => set({ property: { ...f.property, glazing: e.target.value } })}>
                {['', 'Single clear', 'Single tinted', 'Double glazed', 'Double glazed low-E', 'Laminated', 'Toughened'].map((g) => <option key={g} value={g}>{g || '—'}</option>)}
              </Select>
            </Field>
            <Field label="Orientation">
              <Select value={f.property?.orientation || ''} onChange={(e) => set({ property: { ...f.property, orientation: e.target.value } })}>
                {['', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((o) => <option key={o} value={o}>{o || '—'}</option>)}
              </Select>
            </Field>
            <Field label="Levels"><Input type="number" min={1} value={f.property?.levels || ''} onChange={(e) => set({ property: { ...f.property, levels: Number(e.target.value) || undefined } })} /></Field>
            <Field label="Property address" className="sm:col-span-2"><Input value={f.property?.address || ''} onChange={(e) => set({ property: { ...f.property, address: e.target.value } })} /></Field>
          </>
        )}
        <Field label="Location type">
          <Select value={f.location?.type} onChange={(e) => set({ location: { ...f.location, type: e.target.value } })}>
            <option value="in_shop">In shop</option>
            <option value="on_site">At customer location</option>
          </Select>
        </Field>
        <Field label="Purchase order / reference"><Input value={f.reference || ''} onChange={(e) => set({ reference: e.target.value })} /></Field>
        <Field label="Site / drop-off address" className="sm:col-span-2"><Input value={f.location?.address || ''} onChange={(e) => set({ location: { ...f.location, address: e.target.value } })} /></Field>
        <Field label="Project tags" hint="Comma-separated" className="sm:col-span-2"><Input value={f.tags || ''} onChange={(e) => set({ tags: e.target.value })} /></Field>
        <Field label="Access, customer preferences & site notes" className="sm:col-span-2"><Textarea value={f.requirements || ''} onChange={(e) => set({ requirements: e.target.value })} rows={4} /></Field>
      </div>
    </Modal>
  );
}

export function EditContactModal({ p, open, onClose, run }: { p: ProjectDetail; open: boolean; onClose: () => void; run: RunFn }) {
  const [c, setC] = useState({ name: '', company: '', email: '', phone: '', address: '' });
  useEffect(() => {
    if (open) setC({ name: p.contact?.name || '', company: p.contact?.company || '', email: p.contact?.email || '', phone: p.contact?.phone || '', address: p.contact?.address || '' });
  }, [open, p.contact]);
  const save = async () => {
    const ok = await run('contact.update', { contact: c }, 'Contact saved');
    if (ok) {
      refresh('/contacts');
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={onClose} icon={UserRound} title="Edit customer contact" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Save contact</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
        <Field label="Company"><Input value={c.company} onChange={(e) => setC({ ...c, company: e.target.value })} /></Field>
        <Field label="Phone"><Input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
