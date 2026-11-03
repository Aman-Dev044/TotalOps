'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Building2, Copy, Eye, Inbox, Landmark, MessageSquareText, Pencil, Plus, Radio, RefreshCw, Send, ShieldAlert, Store as StoreIcon, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, api, errorMessage } from '@/lib/api';
import { refresh, useFranchisees, useStaff, useStores } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import type { Franchisee, InboundSms } from '@/lib/types';
import { useStoreScope } from '@/components/providers';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Switch, Textarea, cn, useConfirm } from '@/components/ui';
import { ColorInput, MultiToggle, TabIntro } from './shared';

type Draft = Partial<Omit<Franchisee, 'sms' | 'banking'>> & { sms: Franchisee['sms']; banking: Franchisee['banking'] };

const EMPTY: Draft = {
  name: '', principalName: '', principalTitle: 'Franchise Principal', email: '', phone: '', legalName: '', abn: '', storeIds: [], color: '#6366f1', notes: '', active: true,
  sms: { number: '', senderId: '' },
  banking: { bankName: '', accountName: '', bsb: '', accountNumber: '' },
};

const initials = (s?: string) =>
  (s || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

const webhookUrl = (f: Franchisee) => `${API_URL}/api/public/sms/${f.webhookToken}`;

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-muted/30 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-fg">{label}</p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

export function FranchiseesTab() {
  const { data: franchisees, isLoading } = useFranchisees();
  const { data: stores } = useStores();
  const { data: staff } = useStaff();
  const { franchiseeId, setFranchiseeId } = useStoreScope();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Franchisee | null>(null);
  const confirm = useConfirm();

  const storeName = (id: string) => stores?.find((s) => s._id === id)?.name || 'Removed store';
  const owner = (storeId: string) => franchisees?.find((f) => f._id !== edit?._id && f.storeIds.includes(storeId));
  const unassigned = (stores || []).filter((s) => !franchisees?.some((f) => f.storeIds.includes(s._id)));
  const techs = (f: Franchisee) => (staff || []).filter((s) => s.active && s.role === 'installer' && f.storeIds.includes(String(s.storeId))).length;

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Franchisee name is required');
    setSaving(true);
    try {
      const { _id, webhookToken, inbound, ...body } = edit as Franchisee;
      const sms = { number: edit.sms?.number || '', senderId: edit.sms?.senderId || '' };
      if (_id) await api.patch(`/franchisees/${_id}`, { ...body, sms });
      else await api.post('/franchisees', { ...body, sms });
      await refresh('/franchisees');
      toast.success('Franchisee saved');
      setEdit(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const op = async (f: Franchisee, action: string, done: string) => {
    try {
      await api.ops('franchisees', f._id, action);
      await refresh('/franchisees');
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const regenerate = async (f: Franchisee) => {
    if (!(await confirm({ title: 'Regenerate webhook URL?', description: `The current inbound URL for ${f.name} stops working immediately. Update it in Twilio afterwards.`, confirmLabel: 'Regenerate', danger: true }))) return;
    await op(f, 'regenerate', 'New webhook URL created');
  };
  const remove = async (f: Franchisee) => {
    if (!(await confirm({ title: `Delete ${f.name}?`, description: 'Its stores go back to head office and the SMS webhook stops working. Projects and customers are not affected.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/franchisees/${f._id}`);
      if (franchiseeId === f._id) setFranchiseeId('');
      await refresh('/franchisees');
      toast.success('Franchisee deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Webhook URL copied');
    } catch {
      toast.error('Copy failed — select the URL manually');
    }
  };

  if (isLoading) return <PageLoader />;
  const list = franchisees || [];
  return (
    <div>
      <TabIntro
        title="Franchisees & SMS lines"
        text="Each franchisee is a separate legal entity that owns one or more stores, with its own SMS line and bank account for customer invoices. Switch perspective to see the CRM exactly as that franchisee does."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY, sms: { ...EMPTY.sms }, banking: { ...EMPTY.banking } })}>
            Add franchisee entity
          </Button>
        }
      />

      <Card className="mb-5 border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Radio className="h-3.5 w-3.5" /> Current perspective
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFranchiseeId('')}
            className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition', !franchiseeId ? 'border-primary bg-primary text-white shadow-sm' : 'border-line bg-card hover:border-primary/50')}
          >
            <Building2 className="h-4 w-4" /> Head office (all {stores?.length ?? 0} stores)
          </button>
          {list.map((f) => (
            <button
              key={f._id}
              type="button"
              onClick={() => setFranchiseeId(f._id)}
              className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition', franchiseeId === f._id ? 'border-primary bg-primary text-white shadow-sm' : 'border-line bg-card hover:border-primary/50')}
            >
              <StoreIcon className="h-4 w-4" /> {f.principalName ? `${f.principalName} (${f.name})` : f.name}
            </button>
          ))}
        </div>
        {unassigned.length && list.length ? (
          <p className="mt-3 text-xs text-muted-fg">Run by head office (no franchisee): {unassigned.map((s) => s.name).join(', ')}</p>
        ) : null}
      </Card>

      {!list.length ? (
        <Card>
          <EmptyState icon={Building2} title="No franchisees yet" description="Add a franchisee entity, assign its stores and give it a dedicated SMS line." />
        </Card>
      ) : (
        <div className="grid gap-5 2xl:grid-cols-2">
          {list.map((f, i) => (
            <motion.div key={f._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn('card p-5', !f.active && 'opacity-70')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-base font-bold text-white" style={{ background: f.color }}>
                    {initials(f.principalName || f.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{f.name}</p>
                    <p className="truncate text-sm text-muted-fg">
                      {[f.principalName, f.principalTitle].filter(Boolean).join(' · ') || 'No principal set'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {f.active ? null : <Badge>Inactive</Badge>}
                  <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEdit({ ...EMPTY, ...f, sms: { ...EMPTY.sms, ...f.sms }, banking: { ...EMPTY.banking, ...f.banking } })}>
                    Edit
                  </Button>
                  <Button size="sm" icon={Eye} variant={franchiseeId === f._id ? 'success' : 'primary'} onClick={() => setFranchiseeId(franchiseeId === f._id ? '' : f._id)}>
                    {franchiseeId === f._id ? 'Viewing' : 'Switch view'}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Panel label="Legal entity & ABN">
                  <p className="font-semibold">{f.legalName || '—'}</p>
                  <p className="text-muted-fg">ABN: {f.abn || '—'}</p>
                </Panel>
                <Panel label="Dedicated SMS line">
                  {f.sms?.number ? (
                    <>
                      <p className="font-mono font-semibold tracking-wide text-primary">{f.sms.number}</p>
                      {f.sms.verified ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-success" title={f.sms.verifiedAt ? `Verified ${fmtDateTime(f.sms.verifiedAt)}` : undefined}>
                          <BadgeCheck className="h-3.5 w-3.5" /> Line verified
                        </p>
                      ) : (
                        <button type="button" onClick={() => op(f, 'verify', 'SMS line verified')} className="mt-1 flex items-center gap-1 text-xs font-semibold text-warning hover:underline">
                          <ShieldAlert className="h-3.5 w-3.5" /> Not verified — verify now
                        </button>
                      )}
                      <p className="mt-1 text-xs text-muted-fg">Sender ID: {f.sms.senderId ? `"${f.sms.senderId}"` : '—'}</p>
                    </>
                  ) : (
                    <p className="text-muted-fg">No SMS line — messages use the head office number.</p>
                  )}
                </Panel>
                <Panel label="Assigned store locations">
                  {f.storeIds.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {f.storeIds.map((id) => {
                        const st = stores?.find((s) => s._id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-0.5 text-xs font-semibold">
                            <StoreIcon className="h-3 w-3" /> {storeName(id)}
                            {st ? <span className="font-normal text-muted-fg">({st.bays.length} bays)</span> : null}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-fg">No stores assigned</p>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-fg">
                    <Users className="h-3.5 w-3.5" /> {techs(f)} active technicians allocated
                  </p>
                </Panel>
                <Panel label="Customer invoicing & banking">
                  <p className="font-semibold">{f.banking?.bankName || '—'}</p>
                  <p className="text-muted-fg">
                    BSB: {f.banking?.bsb || '—'} · Acc: {f.banking?.accountNumber || '—'}
                  </p>
                  {f.banking?.accountName ? <p className="text-xs text-muted-fg">{f.banking.accountName}</p> : null}
                </Panel>
              </div>

              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-semibold text-muted-fg">Inbound SMS webhook (paste into Twilio → Phone number → "A message comes in", HTTP POST)</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-fg">{webhookUrl(f)}</code>
                  <Button size="icon" variant="ghost" aria-label="Copy webhook URL" onClick={() => copy(webhookUrl(f))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="xs" variant="outline" icon={Send} onClick={() => setTesting(f)} disabled={!f.sms?.number}>
                    Test route
                  </Button>
                  <Button size="xs" variant="ghost" icon={RefreshCw} onClick={() => regenerate(f)}>
                    New webhook URL
                  </Button>
                  <Button size="xs" variant="ghost" icon={Trash2} className="ml-auto text-danger" onClick={() => remove(f)}>
                    Delete
                  </Button>
                </div>
                <InboundLog items={f.inbound || []} onClear={() => op(f, 'clearInbound', 'Inbound log cleared')} />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        icon={Building2}
        size="lg"
        title={edit?._id ? 'Edit franchisee' : 'New franchisee entity'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save franchisee
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trading name" required>
              <Input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Apex Tint Group" />
            </Field>
            <Field label="Card colour">
              <ColorInput value={edit.color || '#6366f1'} onChange={(v) => setEdit({ ...edit, color: v })} />
            </Field>
            <Field label="Principal name">
              <Input value={edit.principalName || ''} onChange={(e) => setEdit({ ...edit, principalName: e.target.value })} placeholder="Dave Miller" />
            </Field>
            <Field label="Principal title">
              <Input value={edit.principalTitle || ''} onChange={(e) => setEdit({ ...edit, principalTitle: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>

            <p className="pt-2 text-xs font-bold uppercase tracking-wider text-muted-fg sm:col-span-2">Legal entity</p>
            <Field label="Legal entity name">
              <Input value={edit.legalName || ''} onChange={(e) => setEdit({ ...edit, legalName: e.target.value })} placeholder="Apex Tinting Pty Ltd" />
            </Field>
            <Field label="ABN / tax ID">
              <Input value={edit.abn || ''} onChange={(e) => setEdit({ ...edit, abn: e.target.value })} placeholder="45 128 992 411" />
            </Field>

            <Field label="Assigned stores" className="sm:col-span-2" hint="A store can belong to one franchisee only. Stores without a franchisee are run by head office.">
              <MultiToggle
                options={(stores || []).map((s) => {
                  const o = owner(s._id);
                  return { key: s._id, label: o ? `${s.name} · ${o.name}` : s.name };
                })}
                value={edit.storeIds || []}
                onChange={(v) => setEdit({ ...edit, storeIds: v })}
              />
            </Field>

            <p className="flex items-center gap-1.5 pt-2 text-xs font-bold uppercase tracking-wider text-muted-fg sm:col-span-2">
              <MessageSquareText className="h-3.5 w-3.5" /> Dedicated SMS line
            </p>
            <Field label="Twilio number" hint="International format. Changing it needs re-verification.">
              <Input value={edit.sms?.number || ''} onChange={(e) => setEdit({ ...edit, sms: { ...edit.sms, number: e.target.value } })} placeholder="+61 488 958 100" />
            </Field>
            <Field label="Sender ID / signature">
              <Input value={edit.sms?.senderId || ''} onChange={(e) => setEdit({ ...edit, sms: { ...edit.sms, senderId: e.target.value } })} placeholder="Dave @ TotalOps Mandurah" />
            </Field>

            <p className="flex items-center gap-1.5 pt-2 text-xs font-bold uppercase tracking-wider text-muted-fg sm:col-span-2">
              <Landmark className="h-3.5 w-3.5" /> Customer invoicing & banking
            </p>
            <Field label="Bank">
              <Input value={edit.banking?.bankName || ''} onChange={(e) => setEdit({ ...edit, banking: { ...edit.banking, bankName: e.target.value } })} placeholder="Commonwealth Bank" />
            </Field>
            <Field label="Account name">
              <Input value={edit.banking?.accountName || ''} onChange={(e) => setEdit({ ...edit, banking: { ...edit.banking, accountName: e.target.value } })} />
            </Field>
            <Field label="BSB">
              <Input value={edit.banking?.bsb || ''} onChange={(e) => setEdit({ ...edit, banking: { ...edit.banking, bsb: e.target.value } })} placeholder="066-123" />
            </Field>
            <Field label="Account number">
              <Input value={edit.banking?.accountNumber || ''} onChange={(e) => setEdit({ ...edit, banking: { ...edit.banking, accountNumber: e.target.value } })} placeholder="1098 4421" />
            </Field>

            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={2} value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <Switch checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} label="Active (inactive lines stop accepting inbound SMS)" />
          </div>
        ) : null}
      </Modal>

      <TestRouteModal franchisee={testing} onClose={() => setTesting(null)} />
    </div>
  );
}

function InboundLog({ items, onClear }: { items: InboundSms[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const shown = open ? items.slice(0, 20) : items.slice(0, 2);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-fg">
          <Inbox className="h-3.5 w-3.5" /> Recent inbound ({items.length})
        </p>
        <div className="flex gap-2 text-xs font-semibold">
          {items.length > 2 ? (
            <button type="button" className="text-primary hover:underline" onClick={() => setOpen(!open)}>
              {open ? 'Show less' : 'Show all'}
            </button>
          ) : null}
          <button type="button" className="text-muted-fg hover:text-danger" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      <ul className="mt-2 space-y-1.5">
        {shown.map((m, k) => (
          <li key={`${m.at}-${k}`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 text-muted-fg">
              <span className="font-semibold text-fg">{m.contactName || m.from}</span>
              {m.projectNumber ? <a href={`/projects/${m.projectId}`} className="font-semibold text-primary hover:underline">→ {m.projectNumber}</a> : <span className="text-warning">no matching project</span>}
              {m.test ? <Badge className="!py-0 text-[10px]">test</Badge> : null}
              <span className="ml-auto">{fmtDateTime(m.at)}</span>
            </div>
            <p className="mt-0.5 line-clamp-2">{m.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TestRouteModal({ franchisee, onClose }: { franchisee: Franchisee | null; onClose: () => void }) {
  const [from, setFrom] = useState('');
  const [text, setText] = useState('Hi, can I move my booking to Friday?');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InboundSms | null>(null);
  const close = () => {
    setResult(null);
    onClose();
  };
  const run = async () => {
    if (!franchisee) return;
    setBusy(true);
    try {
      const r = await api.ops<{ entry: InboundSms }>('franchisees', franchisee._id, 'test', { from, body: text });
      setResult(r.entry);
      await refresh('/franchisees');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!franchisee}
      onClose={close}
      icon={Send}
      title={`Test route · ${franchisee?.name || ''}`}
      description={`Simulates a customer texting ${franchisee?.sms?.number || 'this line'}. The message is matched to a customer by phone and added to their latest project at this franchisee's stores.`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <Button loading={busy} icon={Send} onClick={run}>
            Send test SMS
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="From (customer phone)" hint="Use a customer's phone number to see it land on their project. Leave blank for an unknown sender.">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="0412 100 201" />
        </Field>
        <Field label="Message">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {result ? (
          <div className={cn('rounded-xl border p-3 text-sm', result.projectId ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10')}>
            {result.projectId ? (
              <p>
                Routed to <b>{result.contactName}</b> on project{' '}
                <a className="font-semibold text-primary hover:underline" href={`/projects/${result.projectId}`}>
                  {result.projectNumber}
                </a>
                .
              </p>
            ) : (
              <p>
                No customer project matched <span className="font-mono">{result.from}</span>
                {result.contactName ? ` (${result.contactName} has no open project at these stores)` : ''}. It was logged in the franchisee inbox and notifications.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
