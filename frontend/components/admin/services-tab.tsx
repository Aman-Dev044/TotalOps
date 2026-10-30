'use client';

import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Copy, Package2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useApi, useFilms, useStores } from '@/lib/hooks';
import { money } from '@/lib/format';
import type { Segment, Service } from '@/lib/types';
import { SegmentBadge } from '@/components/badges';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, SearchInput, Segmented, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import { MultiToggle, TabIntro } from './shared';

const EMPTY: Partial<Service> = { name: '', variant: '', segment: 'automotive', coverage: '', detail: '', unit: 'each', unitPrice: 0, defaultQty: 1, minutes: 60, storeIds: [], archived: false };

export function ServicesTab() {
  const { data: services, isLoading, mutate } = useApi<Service[]>('/services');
  const { data: films } = useFilms();
  const { data: stores } = useStores();
  const [seg, setSeg] = useState<'all' | Segment>('all');
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<Partial<Service> | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (services || []).filter((x) => (seg === 'all' || x.segment === seg) && !!x.archived === showArchived && (!s || [x.name, x.variant, x.coverage, x.detail].join(' ').toLowerCase().includes(s)));
  }, [services, seg, q, showArchived]);

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Service name is required');
    if (edit.unitPrice === undefined || (edit.unitPrice as any) === '' || Number(edit.unitPrice) < 0) return toast.error('Unit price required — a missing rate is not a free service');
    setSaving(true);
    try {
      const body = { ...edit, unitPrice: Number(edit.unitPrice), defaultQty: Number(edit.defaultQty) || 1, minutes: Number(edit.minutes) || 0, filmId: edit.filmId || undefined };
      if (edit._id) await api.patch(`/services/${edit._id}`, body);
      else await api.post('/services', body);
      await mutate();
      refresh('/services');
      toast.success('Service saved to the catalogue');
      setEdit(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setArchived = async (s: Service, archived: boolean) => {
    try {
      await api.patch(`/services/${s._id}`, { archived });
      await mutate();
      toast.success(archived ? 'Item archived. Existing quotes are unchanged.' : 'Item restored.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (s: Service) => {
    if (!(await confirm({ title: 'Delete this service?', description: 'Existing proposals keep their copied prices. Prefer archiving.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/services/${s._id}`);
      await mutate();
      toast.success('Service deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <TabIntro
        title="Service catalogue"
        text="Consistent line items for every quote. Library edits only affect newly applied copies — existing project pricing and invoices stay unchanged."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY, segment: seg === 'all' ? 'automotive' : seg })}>
            Add service
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={seg}
          onChange={setSeg}
          options={[
            { key: 'all', label: 'All services' },
            { key: 'automotive', label: 'Automotive' },
            { key: 'residential', label: 'Residential' },
            { key: 'commercial', label: 'Commercial' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search services…" className="w-full sm:w-64" />
        <div className="ml-auto">
          <Switch size="sm" checked={showArchived} onChange={setShowArchived} label="Show archived" />
        </div>
      </div>
      <Card className="overflow-x-auto">
        {!list.length ? (
          <EmptyState icon={Package2} title="No matching library items" description="Try another filter or create a reusable item." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Service</th>
                <th>Segment</th>
                <th>Coverage</th>
                <th className="text-right">Rate</th>
                <th>Time</th>
                <th>Stores</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s._id}>
                  <td>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-fg">{s.variant}</p>
                  </td>
                  <td>
                    <SegmentBadge segment={s.segment} />
                  </td>
                  <td className="max-w-[200px] truncate text-muted-fg">{s.coverage}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {money(s.unitPrice)}
                    <span className="text-xs font-normal text-muted-fg"> /{s.unit === 'm2' ? 'm²' : s.unit}</span>
                  </td>
                  <td className="text-muted-fg">{s.minutes ? `${s.minutes} min` : '—'}</td>
                  <td>{s.storeIds?.length ? <Badge>{s.storeIds.length} stores</Badge> : <Badge tone="info">All</Badge>}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ ...s })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Duplicate" onClick={() => setEdit({ ...s, _id: undefined, name: `${s.name}`, variant: `${s.variant || ''} (copy)`.trim() })}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    {s.archived ? (
                      <Button size="icon" variant="ghost" aria-label="Restore" onClick={() => setArchived(s, false)}>
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" aria-label="Archive" onClick={() => setArchived(s, true)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(s)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?._id ? 'Edit service' : 'New service'}
        description="Configure reusable defaults, not a customer-specific record."
        icon={Package2}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save service
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service name" required>
              <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="3M Ceramic IR" />
            </Field>
            <Field label="Variant" hint="Optional differentiator for same-name variants">
              <Input value={edit.variant || ''} onChange={(e) => setEdit({ ...edit, variant: e.target.value })} placeholder="Sides & rear windscreen" />
            </Field>
            <Field label="Service segment">
              <Select value={edit.segment} onChange={(e) => setEdit({ ...edit, segment: e.target.value as Segment })}>
                <option value="automotive">Automotive</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </Select>
            </Field>
            <Field label="Coverage / scope">
              <Input value={edit.coverage || ''} onChange={(e) => setEdit({ ...edit, coverage: e.target.value })} />
            </Field>
            <Field label="Unit">
              <Select value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>
                <option value="each">Each</option>
                <option value="m2">Per m²</option>
                <option value="hour">Per hour</option>
              </Select>
            </Field>
            <Field label="Unit price" required>
              <Input type="number" min={0} step="0.01" value={edit.unitPrice ?? ''} onChange={(e) => setEdit({ ...edit, unitPrice: e.target.value as any })} />
            </Field>
            <Field label="Default quantity">
              <Input type="number" min={1} step="0.01" value={edit.defaultQty ?? 1} onChange={(e) => setEdit({ ...edit, defaultQty: e.target.value as any })} />
            </Field>
            <Field label="Install time (minutes)">
              <Input type="number" min={0} value={edit.minutes ?? 0} onChange={(e) => setEdit({ ...edit, minutes: e.target.value as any })} />
            </Field>
            <Field label="Linked film" className="sm:col-span-2">
              <Select value={(edit.filmId as string) || ''} onChange={(e) => setEdit({ ...edit, filmId: e.target.value || undefined })}>
                <option value="">No specific film</option>
                {(films || []).map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.brand} {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Catalogue detail / notes" className="sm:col-span-2">
              <Textarea rows={3} value={edit.detail || ''} onChange={(e) => setEdit({ ...edit, detail: e.target.value })} />
            </Field>
            <Field label="Available in stores" hint="None selected = available everywhere" className="sm:col-span-2">
              <MultiToggle options={(stores || []).map((s) => ({ key: s._id, label: s.name }))} value={edit.storeIds || []} onChange={(v) => setEdit({ ...edit, storeIds: v })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
