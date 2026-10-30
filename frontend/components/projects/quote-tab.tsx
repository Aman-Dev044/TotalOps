'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowDown, ArrowUp, BookOpen, Calculator, CheckCircle2, Copy, ExternalLink, Eye, FilePlus2, FileSignature, FileText, Link2, Link2Off, Lock, Package as PackageIcon, Plus,
  Receipt, Save, Send, Star, Trash2,
} from 'lucide-react';
import { useSettings } from '@/lib/hooks';
import { addDays, fmtDate, fmtDateTime, money, todayStr, uid } from '@/lib/format';
import type { Line, OfferOption, Proposal, Service } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import { ProposalStatusBadge } from '@/components/badges';
import { defaultSelection, optionTotals, selectionTotals, toggleOption, validateSelection } from './proposal-math';
import { ApprovalModal, CataloguePicker, CustomerPreview, InvoicePreview, PackagePicker, PaymentsCard } from './quote-parts';
import type { TabProps } from './use-project-action';

const publicLink = (token?: string | null) => (token && typeof window !== 'undefined' ? `${window.location.origin}/review/${token}` : '');

export function QuoteTab({ p, run, busy }: TabProps) {
  const confirm = useConfirm();
  const { data: settings } = useSettings();
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [catFor, setCatFor] = useState<number | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const locked = !!p.invoice;

  useEffect(() => {
    setDraft(p.proposal ? JSON.parse(JSON.stringify({ ...p.proposal, internalSelection: p.proposal.internalSelection || [] })) : null);
    setDirty(false);
  }, [p.proposal]);

  const blank = (): Proposal => ({
    status: 'draft',
    token: null,
    options: [newOption()],
    intro: `Hi ${(p.contact?.name || '').split(' ')[0] || 'there'}, thanks for the opportunity. Here are your options.`,
    footer: 'Prices cover the work described. Installation is arranged after scope confirmation. Please contact us with any questions.',
    terms: settings?.defaults?.terms || '',
    taxRate: settings?.business?.taxRate ?? 10,
    validUntil: addDays(todayStr(), settings?.defaults?.validDays || 30),
    deposit: { mode: 'percent', value: settings?.defaults?.depositPercent ?? 50 },
    showScope: true,
    afterApprovalMessage: 'Thank you. Your choices have been recorded and our team will contact you to arrange the next step.',
    nextStepLabel: 'Book installation',
    nextStepUrl: '',
    internalSelection: [],
    selectedOptionIds: [],
  });

  const edit = (fn: (d: Proposal) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: Proposal = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const internalIds = useMemo(() => (draft ? (draft.internalSelection?.length ? draft.internalSelection : defaultSelection(draft.options)) : []), [draft]);
  const totals = draft ? selectionTotals(draft.options, draft.taxRate, internalIds, draft.deposit) : null;
  const selErr = draft && draft.internalSelection?.length ? validateSelection(draft.options, draft.internalSelection) : null;

  const save = async () => {
    if (!draft) return;
    const ok = await run('proposal.save', { proposal: draft }, 'Offer draft saved');
    if (ok) setDirty(false);
  };
  const send = async () => {
    if (dirty) return toast.info('Save the offer before sending');
    const res = await run<{ link?: string }>('proposal.send', {}, 'Proposal sent (simulated email)');
    if (res?.link) toast.success('Customer review link ready', { description: res.link });
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Review link copied');
    } catch {
      toast.error('Select the review URL and copy it manually.');
    }
  };

  if (!draft) {
    return (
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <EmptyState
            icon={FileText}
            title="Create a proposal"
            description="Create a proposal from service lines, start from a reusable package, or calculate film pricing from the saved measurement sheet."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={PackageIcon} onClick={() => setPkgOpen(true)}>Start from package</Button>
                <Button icon={Calculator} variant="outline" loading={busy === 'proposal.fromMeasurements'} onClick={() => run('proposal.fromMeasurements', {}, 'Priced from measurements')}>Price from measurements</Button>
                <Button icon={FilePlus2} variant="ghost" onClick={() => { setDraft(blank()); setDirty(true); }}>Blank offer</Button>
              </div>
            }
          />
        </Card>
        <PaymentsCard p={p} run={run} />
        <PackagePicker open={pkgOpen} onClose={() => setPkgOpen(false)} segment={p.segment} onPick={async (id) => { setPkgOpen(false); await run('proposal.fromPackage', { packageId: id }, 'Package applied'); }} />
      </div>
    );
  }

  const link = publicLink(p.proposal?.token);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {locked ? (
          <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            <Lock className="h-4 w-4" /> Pricing is locked to preserve the invoice and recorded payments. Duplicate the project for revised scope.
          </div>
        ) : null}

        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <ProposalStatusBadge status={p.proposal?.status || 'draft'} />
            {dirty ? <Badge tone="warning" dot>Unsaved</Badge> : null}
            {!locked ? (
              <>
                <Button size="sm" variant="outline" icon={PackageIcon} onClick={() => setPkgOpen(true)}>Use package</Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={Calculator}
                  onClick={async () => {
                    if (draft.options.length && !(await confirm({ title: 'Replace offer options?', description: 'Options will be rebuilt from the saved measurement sheet and film rates.', confirmLabel: 'Replace' }))) return;
                    run('proposal.fromMeasurements', {}, 'Priced from measurements');
                  }}
                >
                  Price from measurements
                </Button>
              </>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={Eye} onClick={() => setPreviewOpen(true)}>Preview</Button>
              {!locked ? <Button size="sm" icon={Save} loading={busy === 'proposal.save'} disabled={!dirty} onClick={save}>Save offer draft</Button> : null}
            </div>
          </div>
        </Card>

        {/* Options */}
        <AnimatePresence initial={false}>
          {draft.options.map((o, oi) => (
            <motion.div key={o.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
              <OptionEditor
                o={o}
                taxRate={draft.taxRate}
                locked={locked}
                selected={internalIds.includes(o.id)}
                groups={Array.from(new Set(draft.options.map((x) => (x.group || '').trim()).filter(Boolean)))}
                onChange={(fn) => edit((d) => fn(d.options[oi]))}
                onMove={(dir) => edit((d) => { const [x] = d.options.splice(oi, 1); d.options.splice(Math.max(0, Math.min(d.options.length, oi + dir)), 0, x); })}
                onDuplicate={() => edit((d) => { d.options.splice(oi + 1, 0, { ...JSON.parse(JSON.stringify(o)), id: uid(), title: `${o.title} (copy)`, lines: o.lines.map((l) => ({ ...l, id: uid() })) }); })}
                onRemove={() => edit((d) => { d.options.splice(oi, 1); d.internalSelection = (d.internalSelection || []).filter((x) => x !== o.id); })}
                onCatalogue={() => setCatFor(oi)}
                onSelect={() => edit((d) => { d.internalSelection = toggleOption(d.options, d.internalSelection?.length ? d.internalSelection : defaultSelection(d.options), o.id); })}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {!locked ? <Button variant="outline" icon={Plus} className="w-full border-dashed" onClick={() => edit((d) => d.options.push(newOption()))}>Add offer option</Button> : null}

        {/* Messages & terms */}
        <Card>
          <CardHeader icon={BookOpen} title="Customer message, terms & deposit" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Field label="Opening message" className="sm:col-span-2"><Textarea disabled={locked} value={draft.intro || ''} onChange={(e) => edit((d) => { d.intro = e.target.value; })} rows={3} /></Field>
            <Field label="Closing notes" className="sm:col-span-2"><Textarea disabled={locked} value={draft.footer || ''} onChange={(e) => edit((d) => { d.footer = e.target.value; })} rows={2} /></Field>
            <Field label="Terms & warranty" className="sm:col-span-2"><Textarea disabled={locked} value={draft.terms || ''} onChange={(e) => edit((d) => { d.terms = e.target.value; })} rows={2} /></Field>
            <Field label="Valid until"><Input disabled={locked} type="date" value={draft.validUntil} onChange={(e) => edit((d) => { d.validUntil = e.target.value; })} /></Field>
            <Field label="Tax added to prices (%)"><Input disabled={locked} type="number" min={0} max={100} value={draft.taxRate} onChange={(e) => edit((d) => { d.taxRate = Number(e.target.value); })} /></Field>
            <Field label="Deposit preference">
              <Select disabled={locked} value={draft.deposit?.mode || 'none'} onChange={(e) => edit((d) => { d.deposit = { mode: e.target.value as any, value: d.deposit?.value || 0 }; })}>
                <option value="none">No deposit shown</option>
                <option value="fixed">Fixed amount</option>
                <option value="percent">Percentage of chosen work</option>
              </Select>
            </Field>
            {draft.deposit?.mode !== 'none' ? (
              <Field label={draft.deposit.mode === 'percent' ? 'Deposit (%)' : 'Deposit amount'}><Input disabled={locked} type="number" min={0} value={draft.deposit.value} onChange={(e) => edit((d) => { d.deposit = { ...d.deposit, value: Number(e.target.value) }; })} /></Field>
            ) : <div />}
            <Field label="Message after customer confirmation" className="sm:col-span-2"><Textarea disabled={locked} value={draft.afterApprovalMessage || ''} onChange={(e) => edit((d) => { d.afterApprovalMessage = e.target.value; })} rows={2} /></Field>
            <Field label="Optional next-step button label"><Input disabled={locked} value={draft.nextStepLabel || ''} onChange={(e) => edit((d) => { d.nextStepLabel = e.target.value; })} /></Field>
            <Field label="Optional next-step web address"><Input disabled={locked} value={draft.nextStepUrl || ''} onChange={(e) => edit((d) => { d.nextStepUrl = e.target.value; })} placeholder="https://" /></Field>
            <div className="sm:col-span-2"><Switch checked={draft.showScope !== false} onChange={(v) => edit((d) => { d.showScope = v; })} label="Show measured project scope to the customer" /></div>
          </div>
        </Card>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <Card className="sticky top-20 overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-fuchsia-600 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Internal selected estimate</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{money(totals?.total || 0)}</p>
            <p className="text-xs text-white/75">Competing alternatives are not added together. Customer choices can change this before invoicing.</p>
          </div>
          <div className="space-y-1.5 p-5 text-sm">
            <div className="flex justify-between"><span className="text-muted-fg">Subtotal</span><span>{money(totals?.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-fg">Discount</span><span>−{money(totals?.discount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-fg">Tax ({draft.taxRate}%)</span><span>{money(totals?.tax)}</span></div>
            {totals?.deposit ? <div className="flex justify-between"><span className="text-muted-fg">Deposit after confirmation</span><span>{money(totals.deposit)}</span></div> : null}
            {selErr ? <p className="text-xs text-danger">{selErr}</p> : null}
            <p className="pt-1 text-xs text-muted-fg">Valid until {fmtDate(draft.validUntil)}</p>
          </div>
          <div className="space-y-2 border-t border-line p-5">
            {!locked && p.proposal?.status !== 'approved' ? <Button className="w-full" icon={Send} loading={busy === 'proposal.send'} onClick={send}>{p.proposal?.sentAt ? 'Re-send proposal' : 'Send proposal'}</Button> : null}
            {p.proposal && ['sent', 'viewed'].includes(p.proposal.status) ? <Button className="w-full" variant="success" icon={FileSignature} onClick={() => setApproveOpen(true)}>Record simulated approval</Button> : null}
            {p.proposal?.status === 'approved' ? (
              <div className="rounded-xl bg-success/10 p-3 text-sm text-success">
                <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="h-4 w-4" /> Approved by {p.proposal.approvedBy}</p>
                <p className="text-xs">{fmtDateTime(p.proposal.approvedAt)} · {money(p.totals.proposal?.total)}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Link2} title="Customer review link" subtitle="Offer-by-offer choices, without exposing the CRM." />
          <div className="space-y-2 p-5">
            {!p.proposal ? (
              <p className="text-xs text-muted-fg">Save the offer first.</p>
            ) : link ? (
              <>
                <Input readOnly value={link} onFocus={(e) => e.target.select()} className="text-xs" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" icon={Copy} onClick={() => copy(link)}>Copy link</Button>
                  <Button size="sm" variant="outline" icon={ExternalLink} onClick={() => window.open(link, '_blank', 'noopener')}>Open public page</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Link2Off}
                    onClick={async () => { if (await confirm({ title: 'Withdraw review link?', description: 'The customer will see “This link has been withdrawn.”', confirmLabel: 'Withdraw', danger: true })) run('proposal.unlink', {}, 'Customer review link withdrawn'); }}
                  >
                    Withdraw
                  </Button>
                </div>
                {p.proposal.viewedAt ? <p className="text-xs text-muted-fg">Last viewed {fmtDateTime(p.proposal.viewedAt)}</p> : <p className="text-xs text-muted-fg">No customer confirmation yet.</p>}
              </>
            ) : (
              <Button size="sm" icon={Link2} disabled={dirty} onClick={() => run('proposal.link', {}, 'Customer review link created')}>Create review link</Button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Receipt} title="Invoice" subtitle={p.invoice ? `${p.invoice.number} · due ${fmtDate(p.invoice.dueDate)}` : 'Create from the approved options'} />
          <div className="space-y-2 p-5">
            {p.invoice ? (
              <>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-fg">Total</span><span className="font-display text-lg font-bold">{money(p.invoice.total)}</span></div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" icon={Eye} onClick={() => setInvoiceOpen(true)}>View invoice</Button>
                  <Button size="sm" variant="outline" icon={Send} loading={busy === 'invoice.send'} onClick={() => run('invoice.send', {}, 'Invoice sent (simulation)')}>{p.invoice.sentAt ? 'Re-send' : 'Simulate send'}</Button>
                </div>
                {p.invoice.sentAt ? <p className="text-xs text-muted-fg">Sent {fmtDateTime(p.invoice.sentAt)}</p> : null}
              </>
            ) : (
              <Button
                size="sm"
                icon={Receipt}
                disabled={!p.proposal || dirty}
                loading={busy === 'invoice.create'}
                onClick={async () => {
                  if (p.proposal?.status !== 'approved') {
                    if (!(await confirm({ title: 'Invoice without customer approval?', description: 'The internal selection will be invoiced.', confirmLabel: 'Create invoice' }))) return;
                    return run('invoice.create', { force: true }, 'Invoice draft created');
                  }
                  run('invoice.create', {}, 'Invoice created');
                }}
              >
                Create invoice
              </Button>
            )}
          </div>
        </Card>

        <PaymentsCard p={p} run={run} />
      </div>

      <PackagePicker
        open={pkgOpen}
        onClose={() => setPkgOpen(false)}
        segment={p.segment}
        onPick={async (id) => {
          setPkgOpen(false);
          if (dirty && !(await confirm({ title: 'Discard unsaved changes?', description: 'Applying a package replaces the offer options.', confirmLabel: 'Apply package' }))) return;
          run('proposal.fromPackage', { packageId: id }, 'Package applied');
        }}
      />
      <CataloguePicker
        open={catFor !== null}
        onClose={() => setCatFor(null)}
        segment={p.segment}
        onPick={(s: Service) => {
          if (catFor === null) return;
          const qty = s.unit === 'm2' ? Math.max(1, Math.round((p.totals.measuredM2 || s.defaultQty || 1) * 100) / 100) : s.defaultQty || 1;
          edit((d) => d.options[catFor].lines.push({ id: uid(), serviceId: s._id, name: `${s.name}${s.variant ? ` · ${s.variant}` : ''}`, coverage: s.coverage, detail: s.detail, qty, unitPrice: s.unitPrice }));
          toast.success('Service added');
        }}
      />
      {p.proposal ? <ApprovalModal open={approveOpen} onClose={() => setApproveOpen(false)} p={p} run={run} /> : null}
      <CustomerPreview open={previewOpen} onClose={() => setPreviewOpen(false)} p={p} draft={draft} />
      <InvoicePreview open={invoiceOpen} onClose={() => setInvoiceOpen(false)} p={p} />
    </div>
  );
}

function newOption(): OfferOption {
  return { id: uid(), title: 'Untitled option', filmLabel: '', group: '', recommended: false, detail: '', discount: 0, comparisonPrice: 0, lines: [{ id: uid(), name: '', coverage: '', qty: 1, unitPrice: 0 }] };
}

function OptionEditor({
  o, taxRate, locked, selected, groups, onChange, onMove, onDuplicate, onRemove, onCatalogue, onSelect,
}: {
  o: OfferOption; taxRate: number; locked: boolean; selected: boolean; groups: string[];
  onChange: (fn: (o: OfferOption) => void) => void; onMove: (dir: number) => void; onDuplicate: () => void; onRemove: () => void; onCatalogue: () => void; onSelect: () => void;
}) {
  const t = optionTotals(o, taxRate);
  const listId = `groups-${o.id}`;
  return (
    <Card className={selected ? 'ring-2 ring-primary/30' : ''}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Checkbox checked={selected} onChange={onSelect} label={<span className="text-xs font-semibold text-muted-fg">In estimate</span>} />
        {o.group ? <Badge tone="info">Pick one · {o.group}</Badge> : <Badge>Independent option</Badge>}
        {o.recommended ? <Badge tone="success"><Star className="h-3 w-3" />Recommended</Badge> : null}
        <span className="ml-auto font-display text-lg font-extrabold">{money(t.total)}</span>
        {!locked ? (
          <div className="flex">
            <button type="button" aria-label="Move option up" onClick={() => onMove(-1)} className="rounded-md p-1.5 text-muted-fg hover:bg-muted"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" aria-label="Move option down" onClick={() => onMove(1)} className="rounded-md p-1.5 text-muted-fg hover:bg-muted"><ArrowDown className="h-4 w-4" /></button>
            <button type="button" aria-label="Duplicate option" onClick={onDuplicate} className="rounded-md p-1.5 text-muted-fg hover:bg-muted"><Copy className="h-4 w-4" /></button>
            <button type="button" aria-label="Remove option" onClick={onRemove} className="rounded-md p-1.5 text-muted-fg hover:bg-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Customer-facing title" className="sm:col-span-2"><Input disabled={locked} value={o.title} onChange={(e) => onChange((x) => { x.title = e.target.value; })} /></Field>
        <Field label="Film / product label"><Input disabled={locked} value={o.filmLabel || ''} onChange={(e) => onChange((x) => { x.filmLabel = e.target.value; })} placeholder="e.g. Ceramic IR" /></Field>
        <Field label="Alternative group" hint="Same group = choose one">
          <Input disabled={locked} list={listId} value={o.group || ''} onChange={(e) => onChange((x) => { x.group = e.target.value; })} placeholder="e.g. Tint level" />
          <datalist id={listId}>{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </Field>
        <Field label="Option detail" className="sm:col-span-2 lg:col-span-4"><Input disabled={locked} value={o.detail || ''} onChange={(e) => onChange((x) => { x.detail = e.target.value; })} placeholder="What is included in this choice?" /></Field>
      </div>
      <div className="px-4 pb-2">
        <p className="label">Line items</p>
        <div className="space-y-2">
          {o.lines.map((l, li) => (
            <LineRow key={l.id} l={l} locked={locked} onChange={(fn) => onChange((x) => fn(x.lines[li]))} onRemove={() => onChange((x) => { x.lines.splice(li, 1); })} />
          ))}
          {!o.lines.length ? <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted-fg">No line items. Add a catalogue service or blank custom line.</p> : null}
        </div>
        {!locked ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={BookOpen} onClick={onCatalogue}>Service catalogue</Button>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => onChange((x) => { x.lines.push({ id: uid(), name: '', coverage: '', qty: 1, unitPrice: 0 }); })}>Blank custom line</Button>
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-4">
        <Field label="Option discount"><Input disabled={locked} type="number" min={0} value={o.discount || 0} onChange={(e) => onChange((x) => { x.discount = Number(e.target.value); })} /></Field>
        <Field label="Comparison price"><Input disabled={locked} type="number" min={0} value={o.comparisonPrice || 0} onChange={(e) => onChange((x) => { x.comparisonPrice = Number(e.target.value); })} /></Field>
        <div className="flex items-end pb-2"><Switch disabled={locked} checked={!!o.recommended} onChange={(v) => onChange((x) => { x.recommended = v; })} label="Mark as recommended" size="sm" /></div>
        <div className="text-right text-xs text-muted-fg">
          <p>Subtotal {money(t.subtotal)}</p>
          {t.discount ? <p>Discount −{money(t.discount)}</p> : null}
          <p>Tax {money(t.tax)}</p>
          <p className="text-sm font-bold text-fg">Total incl. tax {money(t.total)}</p>
        </div>
      </div>
    </Card>
  );
}

function LineRow({ l, locked, onChange, onRemove }: { l: Line; locked: boolean; onChange: (fn: (l: Line) => void) => void; onRemove: () => void }) {
  const missing = l.unitPrice === null || (l.unitPrice as unknown) === '';
  return (
    <div className="grid grid-cols-12 items-start gap-2 rounded-xl bg-muted/40 p-2">
      <Input disabled={locked} className="col-span-12 h-9 text-sm sm:col-span-5" value={l.name} onChange={(e) => onChange((x) => { x.name = e.target.value; })} placeholder="Product name · coverage" />
      <Input disabled={locked} className="col-span-12 h-9 text-xs sm:col-span-3" value={l.coverage || ''} onChange={(e) => onChange((x) => { x.coverage = e.target.value; })} placeholder="Coverage / scope" />
      <Input disabled={locked} className="col-span-3 h-9 text-sm sm:col-span-1" type="number" min={0} step="0.01" value={l.qty} onChange={(e) => onChange((x) => { x.qty = Number(e.target.value); })} aria-label="Quantity" />
      <Input disabled={locked} className={`col-span-5 h-9 text-sm sm:col-span-2 ${missing ? 'border-danger' : ''}`} type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => onChange((x) => { x.unitPrice = Number(e.target.value); })} aria-label="Unit price" />
      <div className="col-span-4 flex h-9 items-center justify-end gap-1 sm:col-span-1">
        <span className="text-xs font-semibold tabular-nums">{money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0), { cents: false })}</span>
        {!locked ? <button type="button" aria-label="Remove line" onClick={onRemove} className="rounded-md p-1 text-muted-fg hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button> : null}
      </div>
    </div>
  );
}
