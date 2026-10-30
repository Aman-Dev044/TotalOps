'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard, FileSignature, Package as PackageIcon, Printer, Search, Trash2 } from 'lucide-react';
import { useApi, useMeta, useSettings } from '@/lib/hooks';
import { fmtDate, money, todayStr } from '@/lib/format';
import type { OfferOption, Package, ProjectDetail, Proposal, Service } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Modal, Progress, Select, useConfirm } from '@/components/ui';
import { PaymentStatusBadge } from '@/components/badges';
import { optionTotals, selectionTotals, toggleOption, validateSelection } from './proposal-math';
import type { RunFn } from './use-project-action';

/* ---------- Package picker ---------- */
export function PackagePicker({ open, onClose, segment, onPick }: { open: boolean; onClose: () => void; segment: string; onPick: (id: string) => void }) {
  const { data } = useApi<Package[]>(open ? '/packages' : null);
  const list = (data || []).filter((p) => !p.archived).sort((a, b) => Number(b.segment === segment) - Number(a.segment === segment));
  return (
    <Modal open={open} onClose={onClose} icon={PackageIcon} title="Start from a proposal package" description="Reuse scope, options and terms — not old customer data." size="lg">
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((pkg) => (
          <button key={pkg._id} type="button" onClick={() => onPick(pkg._id)} className="rounded-2xl border border-line p-4 text-left transition hover:border-primary/50 hover:bg-primary/5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{pkg.name}</p>
              <Badge tone={pkg.segment === segment ? 'primary' : 'neutral'}>{pkg.segment}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-fg">{pkg.description || 'No internal description yet.'}</p>
            <p className="mt-2 text-xs text-muted-fg">{pkg.options.length} options · valid {pkg.validDays} days · tax {pkg.taxRate}%</p>
          </button>
        ))}
        {!list.length ? <EmptyState className="sm:col-span-2" title="No proposal packages" description="Create packages in Settings → Proposal packages." /> : null}
      </div>
    </Modal>
  );
}

/* ---------- Service catalogue picker ---------- */
export function CataloguePicker({ open, onClose, segment, onPick }: { open: boolean; onClose: () => void; segment: string; onPick: (s: Service) => void }) {
  const { data } = useApi<Service[]>(open ? '/services' : null);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const list = (data || []).filter((s) => !s.archived && (all || s.segment === segment) && (!q || `${s.name} ${s.variant} ${s.coverage} ${s.detail}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Modal open={open} onClose={onClose} title="Select from service catalogue" size="lg">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search service name, coverage or keywords…" className="pl-9" autoFocus />
        </div>
        <Checkbox checked={all} onChange={setAll} label="All segments" />
      </div>
      <div className="space-y-2">
        {list.map((s) => (
          <div key={s._id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.name}{s.variant ? <span className="text-muted-fg"> · {s.variant}</span> : null}</p>
              <p className="truncate text-xs text-muted-fg">{s.coverage}{s.detail ? ` — ${s.detail}` : ''}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-bold">{money(s.unitPrice)}{s.unit === 'm2' ? '/m²' : ''}</span>
              <Button size="sm" onClick={() => onPick(s)}>Add</Button>
            </div>
          </div>
        ))}
        {!list.length ? <p className="py-6 text-center text-sm text-muted-fg">No matching services.</p> : null}
      </div>
    </Modal>
  );
}

/* ---------- Simulated approval ---------- */
export function ApprovalModal({ open, onClose, p, run }: { open: boolean; onClose: () => void; p: ProjectDetail; run: RunFn }) {
  const prop = p.proposal!;
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (!open || !prop) return;
    setName(p.contact?.name || '');
    setIds(p.totals.proposal?.selected || []);
  }, [open, prop, p.contact?.name, p.totals.proposal?.selected]);
  if (!prop) return null;
  const err = validateSelection(prop.options, ids);
  const t = selectionTotals(prop.options, prop.taxRate, ids, prop.deposit);
  const submit = async () => {
    const ok = await run('proposal.approve', { name, optionIds: ids }, 'Simulated approval recorded');
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} icon={FileSignature} title="Simulate customer approval" description="Confirm the customer’s typed name and chosen options before moving this proposal to Approved." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!!err || !name.trim()} onClick={submit}>Record simulated approval</Button></>}>
      <div className="space-y-4">
        <Field label="Customer signature name" hint="The contact name is supplied as a convenience and may be edited."><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="space-y-2">
          {prop.options.map((o) => (
            <OptionChoice key={o.id} o={o} taxRate={prop.taxRate} on={ids.includes(o.id)} onToggle={() => setIds((x) => toggleOption(prop.options, x, o.id))} />
          ))}
        </div>
        {err ? <p className="text-xs text-danger">{err}</p> : <p className="text-right text-sm">Total <b>{money(t.total)}</b></p>}
      </div>
    </Modal>
  );
}

export function OptionChoice({ o, taxRate, on, onToggle }: { o: OfferOption; taxRate: number; on: boolean; onToggle: () => void }) {
  const t = optionTotals(o, taxRate);
  return (
    <button type="button" onClick={onToggle} className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition ${on ? 'border-primary bg-primary/5' : 'border-line hover:bg-muted'}`}>
      <span className="flex items-start gap-2">
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center ${o.group ? 'rounded-full' : 'rounded-md'} border ${on ? 'border-primary bg-primary text-white' : 'border-line'}`}>{on ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}</span>
        <span>
          <span className="block text-sm font-semibold">{o.title} {o.recommended ? <Badge tone="success">Recommended</Badge> : null}</span>
          <span className="block text-xs text-muted-fg">{o.group ? `Pick one · ${o.group}` : 'Independent option'}</span>
        </span>
      </span>
      <span className="text-sm font-bold">{money(t.total)}</span>
    </button>
  );
}

/* ---------- Customer preview ---------- */
export function CustomerPreview({ open, onClose, p, draft }: { open: boolean; onClose: () => void; p: ProjectDetail; draft: Proposal }) {
  const { data: settings } = useSettings();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (open) setIds(draft.internalSelection?.length ? draft.internalSelection : draft.options.filter((o) => !o.group || o.recommended).map((o) => o.id));
  }, [open, draft]);
  const t = selectionTotals(draft.options, draft.taxRate, ids, draft.deposit);
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Customer offer preview" description="Preview only — no project or shared response changed.">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-fuchsia-600 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{settings?.business?.name}</p>
          <p className="mt-1 font-display text-2xl font-extrabold">Your window tinting proposal</p>
          <p className="mt-1 text-sm text-white/80">{p.title} · valid until {fmtDate(draft.validUntil)}</p>
        </div>
        {draft.intro ? <p className="whitespace-pre-wrap text-sm">{draft.intro}</p> : null}
        <div className="space-y-2">
          {draft.options.map((o) => <OptionChoice key={o.id} o={o} taxRate={draft.taxRate} on={ids.includes(o.id)} onToggle={() => setIds((x) => toggleOption(draft.options, x, o.id))} />)}
        </div>
        <div className="rounded-xl bg-muted/60 p-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(t.subtotal)}</span></div>
          {t.discount ? <div className="flex justify-between text-success"><span>Discount</span><span>−{money(t.discount)}</span></div> : null}
          <div className="flex justify-between"><span>Tax ({draft.taxRate}%)</span><span>{money(t.tax)}</span></div>
          <div className="mt-1 flex justify-between font-display text-lg font-bold"><span>Total</span><span>{money(t.total)}</span></div>
          {t.deposit ? <div className="flex justify-between text-muted-fg"><span>Deposit after confirmation</span><span>{money(t.deposit)}</span></div> : null}
        </div>
        {draft.terms ? <p className="text-xs text-muted-fg">{draft.terms}</p> : null}
      </div>
    </Modal>
  );
}

/* ---------- Invoice ---------- */
export function InvoicePreview({ open, onClose, p }: { open: boolean; onClose: () => void; p: ProjectDetail }) {
  const { data: settings } = useSettings();
  const inv = p.invoice;
  if (!inv) return null;
  const b = settings?.business;
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Invoice preview" description="Customer-facing document" footer={<Button icon={Printer} onClick={() => window.print()}>Print / save PDF</Button>}>
      <style>{'@media print { body * { visibility: hidden !important; } #invoice-print, #invoice-print * { visibility: visible !important; } #invoice-print { position: fixed; inset: 0; padding: 32px; background: white; color: black; } }'}</style>
      <div id="invoice-print" className="space-y-5 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl font-extrabold">{b?.name}</p>
            <p className="text-muted-fg">{b?.address}</p>
            <p className="text-muted-fg">{b?.phone} · {b?.email}</p>
            {b?.abn ? <p className="text-muted-fg">ABN {b.abn}</p> : null}
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold text-primary">TAX INVOICE</p>
            <p className="font-semibold">{inv.number}</p>
            <p className="text-muted-fg">Issued {fmtDate(inv.issuedAt)} · Due {fmtDate(inv.dueDate)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-xs font-semibold uppercase text-muted-fg">Prepared for</p>
          <p className="font-semibold">{p.contact?.name}{p.contact?.company ? ` · ${p.contact.company}` : ''}</p>
          <p className="text-muted-fg">{p.contact?.address || p.contact?.email}</p>
          <p className="mt-1 text-muted-fg">{p.number} · {p.title}</p>
        </div>
        <table className="table-base">
          <thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i}>
                <td><p className="font-medium">{l.name}</p><p className="text-xs text-muted-fg">{[l.option, l.coverage].filter(Boolean).join(' · ')}</p></td>
                <td className="text-right">{l.qty}</td>
                <td className="text-right">{money(l.unitPrice)}</td>
                <td className="text-right font-semibold">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto max-w-xs space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(inv.subtotal)}</span></div>
          {inv.discount ? <div className="flex justify-between"><span>Discount</span><span>−{money(inv.discount)}</span></div> : null}
          <div className="flex justify-between"><span>{b?.taxLabel || 'Tax'} ({inv.taxRate}%)</span><span>{money(inv.tax)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 font-display text-lg font-bold"><span>Total</span><span>{money(inv.total)}</span></div>
          <div className="flex justify-between text-success"><span>Payments received</span><span>−{money(p.totals.paid)}</span></div>
          <div className="flex justify-between font-bold"><span>Balance due</span><span>{money(p.totals.balance)}</span></div>
        </div>
        {inv.terms ? <div><p className="label">Terms & warranty</p><p className="text-muted-fg">{inv.terms}</p></div> : null}
        {inv.acceptedBy ? <p className="text-xs text-muted-fg">Accepted by {inv.acceptedBy}</p> : null}
      </div>
    </Modal>
  );
}

/* ---------- Payments ---------- */
export function PaymentsCard({ p, run }: { p: ProjectDetail; run: RunFn }) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const quoted = p.totals.proposal?.total || 0;
  const target = p.invoice ? p.invoice.total : quoted;
  return (
    <Card>
      <CardHeader
        icon={CreditCard}
        title="Invoice & payments"
        subtitle="Deposits, multiple payments and remaining balance"
        actions={<Button size="sm" icon={CreditCard} disabled={!p.proposal && !p.invoice} onClick={() => setOpen(true)}>{p.invoice ? 'Record payment' : 'Add deposit'}</Button>}
      />
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">{p.invoice ? 'Invoice total' : 'Quoted'}</p><p className="font-display text-base font-bold">{money(target)}</p></div>
          <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Payments received</p><p className="font-display text-base font-bold text-success">{money(p.totals.paid)}</p></div>
          <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Balance due</p><p className="font-display text-base font-bold">{money(Math.max(0, target - p.totals.paid))}</p></div>
        </div>
        {target ? <Progress value={p.totals.paid} max={target} tone={p.totals.status === 'paid' ? 'success' : 'primary'} /> : null}
        <div className="flex items-center justify-between"><span className="text-xs text-muted-fg">Status</span><PaymentStatusBadge status={p.totals.status} /></div>
        {p.payments.length ? (
          <div className="space-y-2">
            {[...p.payments].reverse().map((pay) => (
              <motion.div key={pay._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">{money(pay.amount)} <Badge tone={pay.kind === 'deposit' ? 'info' : 'success'}>{pay.kind === 'deposit' ? 'Booking deposit' : 'Payment'}</Badge></p>
                  <p className="text-xs text-muted-fg">{fmtDate(pay.date)} · {pay.method}{pay.reference ? ` · ${pay.reference}` : ' · No reference'}</p>
                </div>
                {p.stage !== 'closed' ? (
                  <button type="button" aria-label="Remove payment" className="rounded-md p-1.5 text-muted-fg hover:bg-muted hover:text-danger" onClick={async () => { if (await confirm({ title: 'Remove this payment?', description: 'The balance will be recalculated.', confirmLabel: 'Remove', danger: true })) run('payment.remove', { paymentId: pay._id }, 'Payment removed'); }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-fg">{p.invoice ? 'No payments recorded yet.' : 'Create an invoice to record payments. A booking deposit can be recorded against the proposal.'}</p>
        )}
      </div>
      <PaymentModal open={open} onClose={() => setOpen(false)} p={p} run={run} />
    </Card>
  );
}

function PaymentModal({ open, onClose, p, run }: { open: boolean; onClose: () => void; p: ProjectDetail; run: RunFn }) {
  const { data: meta } = useMeta();
  const target = p.invoice ? p.invoice.total : p.totals.proposal?.total || 0;
  const outstanding = Math.max(0, Math.round((target - p.totals.paid) * 100) / 100);
  const [f, setF] = useState({ kind: 'payment', amount: '', method: 'Bank transfer', date: todayStr(), reference: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const deposit = p.totals.proposal?.deposit || 0;
    setF({ kind: p.invoice ? 'payment' : 'deposit', amount: String(p.invoice ? outstanding : Math.min(outstanding, deposit || outstanding)), method: 'Bank transfer', date: todayStr(), reference: '' });
  }, [open, p.invoice, outstanding, p.totals.proposal?.deposit]);
  const save = async () => {
    setBusy(true);
    const ok = await run('payment.add', { ...f, amount: Number(f.amount) }, 'Payment recorded. No money was charged.');
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} icon={CreditCard} title="Record payment" description={`Outstanding balance: ${money(outstanding)} · Records an entry only — no card details are processed.`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Record payment</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kind">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="deposit">Booking deposit</option>
            <option value="payment" disabled={!p.invoice}>Payment {p.invoice ? '' : '(needs invoice)'}</option>
          </Select>
        </Field>
        <Field label="Amount"><Input type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Payment method">
          <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {(meta?.paymentMethods || ['Bank transfer', 'Cash']).map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Payment date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Reference / receipt number" className="sm:col-span-2"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
