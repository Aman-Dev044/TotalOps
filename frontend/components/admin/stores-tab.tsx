'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Pencil, Phone, Plus, Store as StoreIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useStaff, useStores } from '@/lib/hooks';
import type { Store } from '@/lib/types';
import { Badge, Button, EmptyState, Field, Input, Modal, PageLoader, Switch, useConfirm } from '@/components/ui';
import { ChipsInput, ColorInput, TabIntro } from './shared';

const EMPTY: Partial<Store> = { name: '', code: '', address: '', phone: '', email: '', color: '#6366f1', bays: ['Bay 1', 'Bay 2', 'Mobile Bay'], openTime: '08:00', closeTime: '16:00', active: true };

export function StoresTab() {
  const { data: stores, isLoading } = useStores();
  const { data: staff } = useStaff();
  const [edit, setEdit] = useState<Partial<Store> | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Store name is required');
    if (edit.openTime && edit.closeTime && edit.closeTime <= edit.openTime) return toast.error('Closing time must be after opening time');
    setSaving(true);
    try {
      const body = { ...edit, lat: edit.lat === undefined || (edit.lat as any) === '' ? undefined : Number(edit.lat), lng: edit.lng === undefined || (edit.lng as any) === '' ? undefined : Number(edit.lng) };
      if (edit._id) await api.patch(`/stores/${edit._id}`, body);
      else await api.post('/stores', body);
      await refresh('/stores');
      toast.success(edit._id ? 'Store saved' : 'Store created');
      setEdit(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Store) => {
    if (!(await confirm({ title: `Delete ${s.name}?`, description: 'Stores with projects or team members cannot be deleted.', danger: true, confirmLabel: 'Delete store' }))) return;
    try {
      await api.del(`/stores/${s._id}`);
      await refresh('/stores');
      toast.success('Store deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <TabIntro
        title="Stores & bays"
        text="Store profiles, opening hours and bays. Capacity planning and conflict checks use these bays."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY })}>
            Add store
          </Button>
        }
      />
      {!stores?.length ? (
        <EmptyState icon={StoreIcon} title="No stores yet" description="Add your first store to start booking jobs." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {stores.map((s, i) => {
            const team = (staff || []).filter((t) => t.storeId === s._id);
            return (
              <motion.div key={s._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card relative overflow-hidden p-5">
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl font-display text-sm font-extrabold text-white" style={{ background: s.color }}>
                      {s.code || s.name.slice(0, 3).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-display text-base font-bold">{s.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-fg">
                        <MapPin className="h-3 w-3" /> {s.address || 'No address'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Edit store" onClick={() => setEdit({ ...s })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete store" onClick={() => remove(s)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-fg">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {s.openTime}–{s.closeTime}
                  </span>
                  {s.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {s.phone}
                    </span>
                  ) : null}
                  <span>{team.length} team members</span>
                  {!s.active ? <Badge tone="neutral">Inactive</Badge> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.bays.map((b) => (
                    <Badge key={b} tone="primary">
                      {b}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?._id ? 'Edit store' : 'New store'}
        icon={StoreIcon}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save store
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name" required>
              <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Short code">
              <Input value={edit.code || ''} maxLength={5} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={edit.address || ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="Opens">
              <Input type="time" value={edit.openTime || '08:00'} onChange={(e) => setEdit({ ...edit, openTime: e.target.value })} />
            </Field>
            <Field label="Closes">
              <Input type="time" value={edit.closeTime || '16:00'} onChange={(e) => setEdit({ ...edit, closeTime: e.target.value })} />
            </Field>
            <Field label="Latitude" hint="Used on the dispatch map">
              <Input type="number" step="0.0001" value={edit.lat ?? ''} onChange={(e) => setEdit({ ...edit, lat: e.target.value as any })} />
            </Field>
            <Field label="Longitude">
              <Input type="number" step="0.0001" value={edit.lng ?? ''} onChange={(e) => setEdit({ ...edit, lng: e.target.value as any })} />
            </Field>
            <Field label="Colour">
              <ColorInput value={edit.color || '#6366f1'} onChange={(v) => setEdit({ ...edit, color: v })} />
            </Field>
            <div className="flex items-end pb-2">
              <Switch checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="Active store" />
            </div>
            <Field label="Bays / stations" hint="Press Enter after each bay. Bays named “Mobile…” never conflict." className="sm:col-span-2">
              <ChipsInput value={edit.bays || []} onChange={(v) => setEdit({ ...edit, bays: v })} placeholder="Bay 1, Bay 2, Mobile Bay" />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
