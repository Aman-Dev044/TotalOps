'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CarFront, Copy, ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { refresh, useDealers, useStores } from '@/lib/hooks';
import type { Dealer } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import { TabIntro } from './shared';

const EMPTY: Partial<Dealer> = { name: '', contactName: '', phone: '', email: '', notes: '', active: true };

export function DealersTab() {
  const { data: dealers, isLoading } = useDealers();
  const { data: stores } = useStores();
  const [edit, setEdit] = useState<Partial<Dealer> | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const link = (d: Dealer) => (typeof window !== 'undefined' ? `${window.location.origin}/dealer/${d.token}` : `/dealer/${d.token}`);

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Dealer name is required');
    setSaving(true);
    try {
      const body = { ...edit, storeId: edit.storeId || undefined };
      if (edit._id) await api.patch(`/dealers/${edit._id}`, body);
      else await api.post('/dealers', body);
      await refresh('/dealers');
      toast.success('Dealer saved');
      setEdit(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const copy = async (d: Dealer) => {
    try {
      await navigator.clipboard.writeText(link(d));
      toast.success('Dealer portal link copied to clipboard!');
    } catch {
      toast.error('Copy failed — select the link manually');
    }
  };
  const regenerate = async (d: Dealer) => {
    if (!(await confirm({ title: 'Regenerate portal link?', description: `The current link for ${d.name} will stop working immediately.`, confirmLabel: 'Regenerate', danger: true }))) return;
    try {
      await api.ops('dealers', d._id, 'regenerate');
      await refresh('/dealers');
      toast.success('New portal link created');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async (d: Dealer) => {
    if (!(await confirm({ title: `Delete ${d.name}?`, description: 'Their portal link stops working. Projects keep the dealer name.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/dealers/${d._id}`);
      await refresh('/dealers');
      toast.success('Dealer deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <TabIntro
        title="Dealers & fleet accounts"
        text="Each dealership gets a private, read-only live portal showing today's vehicles, bay status and pickup info."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY, storeId: stores?.[0]?._id })}>
            Add dealer
          </Button>
        }
      />
      {!dealers?.length ? (
        <Card>
          <EmptyState icon={CarFront} title="No dealer accounts yet" description="Add a dealership to share a live shop schedule." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {dealers.map((d, i) => (
            <motion.div key={d._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white">
                    <CarFront className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-fg">
                      {d.contactName} {d.phone ? `· ${d.phone}` : ''}
                    </p>
                  </div>
                </div>
                {d.active ? <Badge tone="success" dot>Live</Badge> : <Badge>Inactive</Badge>}
              </div>
              <p className="mt-3 text-xs text-muted-fg">Home store: {stores?.find((s) => s._id === d.storeId)?.name || '—'}</p>
              <div className="mt-3 truncate rounded-lg bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-fg">{link(d)}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="xs" variant="outline" icon={Copy} onClick={() => copy(d)}>
                  Copy link
                </Button>
                <Button size="xs" variant="outline" icon={ExternalLink} onClick={() => window.open(link(d), '_blank', 'noopener')}>
                  Open
                </Button>
                <Button size="xs" variant="ghost" icon={RefreshCw} onClick={() => regenerate(d)}>
                  New link
                </Button>
                <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ ...d })}>
                  Edit
                </Button>
                <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => remove(d)}>
                  Delete
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        icon={CarFront}
        title={edit?._id ? 'Edit dealer' : 'New dealer'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save dealer
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dealership name" required className="sm:col-span-2">
              <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Brett's Prestige Auto" />
            </Field>
            <Field label="Contact name">
              <Input value={edit.contactName || ''} onChange={(e) => setEdit({ ...edit, contactName: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="Home store">
              <Select value={edit.storeId || ''} onChange={(e) => setEdit({ ...edit, storeId: e.target.value })}>
                <option value="">—</option>
                {(stores || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={2} value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <Switch checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="Portal active" />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
