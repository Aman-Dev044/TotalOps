'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Copy, Eye, FileStack, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useApi, useStores } from '@/lib/hooks';
import { money, uid } from '@/lib/format';
import type { OfferOption, Package, Segment, Service } from '@/lib/types';
import { SegmentBadge } from '@/components/badges';
import { Badge, Button, Card, Checkbox, Divider, EmptyState, Field, Input, Modal, PageLoader, SearchInput, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import { MultiToggle, TabIntro, TemplateEditor } from './shared';

const blankOption = (): OfferOption => ({ id: uid(), title: '', filmLabel: '', group: '', recommended: false, detail: '', discount: 0, comparisonPrice: 0, lines: [] });
const EMPTY: Partial<Package> = { name: '', segment: 'automotive', description: '', validDays: 30, taxRate: 10, storeIds: [], intro: '', footer: '', terms: '', afterApprovalMessage: '', nextStepLabel: '', nextStepUrl: '', showScope: true, deposit: { mode: 'percent', value: 50 }, options: [], archived: false };

export function optionSubtotal(o: OfferOption) {
  return (o.lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
}

function validate(p: Partial<Package>) {
  if (!p.name?.trim()) return 'Give the package an internal name';
  if (!p.options?.length) return 'Add at least one offer option';
  for (const o of p.options) {
    if (!o.title.trim() || !o.lines.length) return 'Each option needs a title and at least one service';
    for (const l of o.lines) if (!l.name.trim() || !(Number(l.qty) > 0) || (l.unitPrice as any) === '' || Number(l.unitPrice) < 0) return 'Complete service descriptions, quantities and prices for every option';
    if ((Number(o.discount) || 0) > optionSubtotal(o)) return 'An option discount cannot exceed its subtotal';
  }
  if (!(Number(p.taxRate) >= 0 && Number(p.taxRate) <= 100)) return 'Tax must be between 0 and 100%';
  if (p.deposit?.mode === 'percent' && Number(p.deposit.value) > 100) return 'Deposit percentage must be at most 100';
  return null;
}

export function PackagesTab() {
  const { data: packages, isLoading, mutate } = useApi<Package[]>('/packages');
  const { data: services } = useApi<Service[]>('/services');
  const { data: stores } = useStores();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<Partial<Package> | null>(null);
  const [preview, setPreview] = useState<Partial<Package> | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const list = useMemo(() => (packages || []).filter((p) => !!p.archived === showArchived && (!q || `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()))), [packages, q, showArchived]);

  const save = async () => {
    if (!edit) return;
    const err = validate(edit);
    if (err) return toast.error(err);
    setSaving(true);
    try {
      const body = {
        ...edit,
        validDays: Number(edit.validDays) || 30,
        taxRate: Number(edit.taxRate),
        deposit: { mode: edit.deposit?.mode || 'none', value: Number(edit.deposit?.value) || 0 },
        options: (edit.options || []).map((o) => ({ ...o, discount: Number(o.discount) || 0, comparisonPrice: Number(o.comparisonPrice) || 0, lines: o.lines.map((l) => ({ ...l, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) })),
      };
      if (edit._id) await api.patch(`/packages/${edit._id}`, body);
      else await api.post('/packages', body);
      await mutate();
      toast.success('Proposal package saved.');
      setEdit(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (p: Package, archived: boolean) => {
    try {
      await api.patch(`/packages/${p._id}`, { archived });
      await mutate();
      toast.success(archived ? 'Package archived' : 'Package restored.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async (p: Package) => {
    if (!(await confirm({ title: `Delete “${p.name}”?`, description: 'Projects already using this package keep their copies.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/packages/${p._id}`);
      await mutate();
      toast.success('Package deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const duplicate = (p: Package) => setEdit({ ...p, _id: undefined, name: `${p.name} (copy)`, options: p.options.map((o) => ({ ...o, id: uid(), lines: o.lines.map((l) => ({ ...l, id: uid() })) })) });

  if (isLoading) return <PageLoader />;
  return (
    <div>
      <TabIntro
        title="Proposal packages"
        text="Offer options, not one-size-fits-all quotes. Build alternatives, additive extras and clear follow-up steps — reused without carrying old customer data forward."
        actions={
          <Button icon={Plus} onClick={() => setEdit({ ...EMPTY, options: [blankOption()] })}>
            Add package
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search proposal packages…" className="w-full sm:w-72" />
        <Switch size="sm" checked={showArchived} onChange={setShowArchived} label="Show archived" />
      </div>
      {!list.length ? (
        <Card>
          <EmptyState icon={FileStack} title="No proposal packages match" description="Try another search or create a package with a focused set of offer options." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((p, i) => {
            const rec = p.options.filter((o) => !o.group || o.recommended);
            const est = rec.reduce((s, o) => s + optionSubtotal(o) - (Number(o.discount) || 0), 0) * (1 + (p.taxRate || 0) / 100);
            return (
              <motion.div key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold">{p.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-fg">{p.description || 'No internal description yet.'}</p>
                  </div>
                  <SegmentBadge segment={p.segment} />
                </div>
                <div className="mt-4 space-y-1.5">
                  {p.options.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {o.recommended ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
                        <span className="truncate">{o.title}</span>
                        {o.group ? <Badge tone="info">Pick one · {o.group}</Badge> : null}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{money(optionSubtotal(o))}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted-fg">
                  <span>
                    Valid {p.validDays}d · Tax {p.taxRate}% · {p.deposit?.mode === 'percent' ? `${p.deposit.value}% deposit` : p.deposit?.mode === 'fixed' ? `${money(p.deposit.value)} deposit` : 'No deposit'}
                  </span>
                  <span className="font-semibold text-fg">≈ {money(est)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="xs" variant="outline" icon={Pencil} onClick={() => setEdit(JSON.parse(JSON.stringify(p)))}>
                    Edit
                  </Button>
                  <Button size="xs" variant="outline" icon={Eye} onClick={() => setPreview(p)}>
                    Preview
                  </Button>
                  <Button size="xs" variant="outline" icon={Copy} onClick={() => duplicate(p)}>
                    Duplicate
                  </Button>
                  {p.archived ? (
                    <Button size="xs" variant="ghost" icon={ArchiveRestore} onClick={() => archive(p, false)}>
                      Restore
                    </Button>
                  ) : (
                    <Button size="xs" variant="ghost" icon={Archive} onClick={() => archive(p, true)}>
                      Archive
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => remove(p)}>
                    Delete
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        size="xl"
        icon={FileStack}
        title={edit?._id ? 'Edit proposal package' : 'New proposal package'}
        description="The internal package name and catalogue IDs never appear on the customer proposal."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button variant="outline" icon={Eye} onClick={() => edit && setPreview(edit)}>
              Preview
            </Button>
            <Button loading={saving} onClick={save}>
              Save package
            </Button>
          </>
        }
      >
        {edit ? <PackageForm value={edit} onChange={setEdit} services={services || []} stores={(stores || []).map((s) => ({ key: s._id, label: s.name }))} /> : null}
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} size="lg" title="Customer offer preview" description="Preview only — sample customer data.">
        {preview ? <PackagePreview pkg={preview} /> : null}
      </Modal>
    </div>
  );
}

function PackageForm({ value: p, onChange, services, stores }: { value: Partial<Package>; onChange: (p: Partial<Package>) => void; services: Service[]; stores: { key: string; label: string }[] }) {
  const set = (patch: Partial<Package>) => onChange({ ...p, ...patch });
  const options = p.options || [];
  const setOpt = (i: number, patch: Partial<OfferOption>) => set({ options: options.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const move = (i: number, d: number) => {
    const next = [...options];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ options: next });
  };
  const catalogue = services.filter((s) => !s.archived && (s.segment === p.segment || !p.segment));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Internal package name" required className="md:col-span-2">
          <Input value={p.name || ''} onChange={(e) => set({ name: e.target.value })} placeholder="Automotive · ceramic package" />
        </Field>
        <Field label="Segment">
          <Select value={p.segment} onChange={(e) => set({ segment: e.target.value as Segment })}>
            <option value="automotive">Automotive</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </Select>
        </Field>
        <Field label="Internal description" className="md:col-span-3">
          <Input value={p.description || ''} onChange={(e) => set({ description: e.target.value })} placeholder="What is this package for?" />
        </Field>
        <Field label="Valid for (days)">
          <Input type="number" min={1} value={p.validDays ?? 30} onChange={(e) => set({ validDays: e.target.value as any })} />
        </Field>
        <Field label="Tax (%)">
          <Input type="number" min={0} max={100} value={p.taxRate ?? 10} onChange={(e) => set({ taxRate: e.target.value as any })} />
        </Field>
        <Field label="Deposit">
          <div className="flex gap-2">
            <Select value={p.deposit?.mode || 'none'} onChange={(e) => set({ deposit: { mode: e.target.value as any, value: p.deposit?.value || 0 } })} className="w-40">
              <option value="none">No deposit</option>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed amount</option>
            </Select>
            {p.deposit?.mode && p.deposit.mode !== 'none' ? <Input type="number" min={0} value={p.deposit.value} onChange={(e) => set({ deposit: { mode: p.deposit!.mode, value: e.target.value as any } })} /> : null}
          </div>
        </Field>
        <Field label="Available stores" hint="None selected = all stores" className="md:col-span-3">
          <MultiToggle options={stores} value={p.storeIds || []} onChange={(v) => set({ storeIds: v })} />
        </Field>
      </div>

      <Divider label="Offer options" />
      <p className="-mt-2 text-xs text-muted-fg">Options with the same group are customer alternatives — choose one. Leave the group blank for an additive option.</p>
      <div className="space-y-4">
        {options.map((o, i) => {
          const sub = optionSubtotal(o);
          return (
            <motion.div key={o.id} layout className="rounded-2xl border border-line bg-muted/25 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  Option {i + 1} {o.group ? <Badge tone="info">Pick one · {o.group}</Badge> : <Badge>Independent option</Badge>}
                </p>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" aria-label="Move option up" onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Move option down" onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Duplicate option" onClick={() => set({ options: [...options.slice(0, i + 1), { ...o, id: uid(), title: `${o.title} (copy)`, lines: o.lines.map((l) => ({ ...l, id: uid() })) }, ...options.slice(i + 1)] })}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Remove option" onClick={() => set({ options: options.filter((_, k) => k !== i) })}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Customer-facing title" className="md:col-span-2">
                  <Input value={o.title} onChange={(e) => setOpt(i, { title: e.target.value })} placeholder="Nano-Ceramic IR (Sides & Rear)" />
                </Field>
                <Field label="Film / product label">
                  <Input value={o.filmLabel || ''} onChange={(e) => setOpt(i, { filmLabel: e.target.value })} placeholder="e.g. Ceramic IR" />
                </Field>
                <Field label="Alternative group">
                  <Input value={o.group || ''} onChange={(e) => setOpt(i, { group: e.target.value })} placeholder="e.g. Tint level" />
                </Field>
                <Field label="Option detail" className="md:col-span-2">
                  <Input value={o.detail || ''} onChange={(e) => setOpt(i, { detail: e.target.value })} placeholder="What is included in this choice?" />
                </Field>
                <Field label="Option discount">
                  <Input type="number" min={0} value={o.discount ?? 0} onChange={(e) => setOpt(i, { discount: e.target.value as any })} />
                </Field>
                <Field label="Comparison price">
                  <Input type="number" min={0} value={o.comparisonPrice ?? 0} onChange={(e) => setOpt(i, { comparisonPrice: e.target.value as any })} />
                </Field>
              </div>
              <div className="mt-3">
                <Checkbox checked={!!o.recommended} onChange={(v) => setOpt(i, { recommended: v })} label="Mark as recommended" />
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Line item</th>
                      <th>Coverage</th>
                      <th className="w-20">Qty</th>
                      <th className="w-28">Unit price</th>
                      <th className="w-24 text-right">Amount</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {o.lines.map((l, li) => (
                      <tr key={l.id}>
                        <td>
                          <Input value={l.name} onChange={(e) => setOpt(i, { lines: o.lines.map((x, k) => (k === li ? { ...x, name: e.target.value } : x)) })} className="h-8" />
                        </td>
                        <td>
                          <Input value={l.coverage || ''} onChange={(e) => setOpt(i, { lines: o.lines.map((x, k) => (k === li ? { ...x, coverage: e.target.value } : x)) })} className="h-8" />
                        </td>
                        <td>
                          <Input type="number" min={0} step="0.01" value={l.qty} onChange={(e) => setOpt(i, { lines: o.lines.map((x, k) => (k === li ? { ...x, qty: e.target.value as any } : x)) })} className="h-8" />
                        </td>
                        <td>
                          <Input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setOpt(i, { lines: o.lines.map((x, k) => (k === li ? { ...x, unitPrice: e.target.value as any } : x)) })} className="h-8" />
                        </td>
                        <td className="text-right font-semibold tabular-nums">{money((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</td>
                        <td>
                          <button type="button" aria-label="Remove line" onClick={() => setOpt(i, { lines: o.lines.filter((_, k) => k !== li) })} className="rounded p-1 text-muted-fg hover:text-danger">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!o.lines.length ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-sm text-muted-fg">
                          No line items. Add a catalogue service or blank custom line.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  value=""
                  onChange={(e) => {
                    const s = catalogue.find((x) => x._id === e.target.value);
                    if (s) setOpt(i, { lines: [...o.lines, { id: uid(), serviceId: s._id, name: `${s.name}${s.variant ? ` · ${s.variant}` : ''}`, coverage: s.coverage || '', detail: s.detail || '', qty: s.defaultQty || 1, unitPrice: s.unitPrice }] });
                  }}
                  className="h-8 w-full text-xs sm:w-72"
                >
                  <option value="">+ Add from service catalogue…</option>
                  {catalogue.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                      {s.variant ? ` · ${s.variant}` : ''} — {money(s.unitPrice)}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" icon={Plus} onClick={() => setOpt(i, { lines: [...o.lines, { id: uid(), name: '', coverage: '', qty: 1, unitPrice: 0 }] })}>
                  Blank custom line
                </Button>
                <span className="ml-auto text-sm">
                  Subtotal <b className="tabular-nums">{money(sub - (Number(o.discount) || 0))}</b>
                </span>
              </div>
            </motion.div>
          );
        })}
        <Button variant="outline" icon={Plus} onClick={() => set({ options: [...options, blankOption()] })}>
          Add offer option
        </Button>
      </div>

      <Divider label="Customer message" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Intro">
          <TemplateEditor rows={4} value={p.intro || ''} onChange={(v) => set({ intro: v })} placeholder="Hi {{first_name}}, here are your options…" />
        </Field>
        <div className="space-y-4">
          <Field label="Footer">
            <Textarea rows={2} value={p.footer || ''} onChange={(e) => set({ footer: e.target.value })} />
          </Field>
          <Field label="Terms and practical next steps">
            <Textarea rows={3} value={p.terms || ''} onChange={(e) => set({ terms: e.target.value })} />
          </Field>
        </div>
        <Field label="After approval message">
          <Textarea rows={2} value={p.afterApprovalMessage || ''} onChange={(e) => set({ afterApprovalMessage: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Next step label">
            <Input value={p.nextStepLabel || ''} onChange={(e) => set({ nextStepLabel: e.target.value })} placeholder="Book installation" />
          </Field>
          <Field label="Next step URL">
            <Input value={p.nextStepUrl || ''} onChange={(e) => set({ nextStepUrl: e.target.value })} placeholder="https://" />
          </Field>
          <div className="col-span-2">
            <Switch checked={p.showScope !== false} onChange={(v) => set({ showScope: v })} label="Show measured scope beside each offer option" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PackagePreview({ pkg }: { pkg: Partial<Package> }) {
  const intro = (pkg.intro || '').replace(/\{\{\s*first_name\s*\}\}/g, 'Charlotte').replace(/\{\{\s*\w+\s*\}\}/g, '');
  const opts = pkg.options || [];
  const tax = Number(pkg.taxRate) || 0;
  const chosen = opts.filter((o) => !o.group || o.recommended);
  const total = chosen.reduce((s, o) => s + optionSubtotal(o) - (Number(o.discount) || 0), 0) * (1 + tax / 100);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-white/70">Your window tinting proposal</p>
        <p className="mt-2 text-sm text-white/90">{intro || 'Here are your options.'}</p>
      </div>
      {opts.map((o) => (
        <div key={o.id} className={`rounded-2xl border p-4 ${o.recommended ? 'border-primary/50 shadow-glow' : 'border-line'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">
                {o.title || 'Untitled option'} {o.recommended ? <Badge tone="primary"><Sparkles className="h-3 w-3" /> Recommended</Badge> : null}
              </p>
              <p className="text-sm text-muted-fg">{o.detail}</p>
              {o.group ? <p className="mt-1 text-xs text-info">Alternative · {o.group}</p> : null}
            </div>
            <div className="text-right">
              {o.comparisonPrice ? <p className="text-xs text-muted-fg line-through">{money(Number(o.comparisonPrice))}</p> : null}
              <p className="font-display text-lg font-extrabold">{money((optionSubtotal(o) - (Number(o.discount) || 0)) * (1 + tax / 100))}</p>
            </div>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {o.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 text-muted-fg">
                <span>
                  {l.name} {l.coverage ? `· ${l.coverage}` : ''}
                </span>
                <span>× {l.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-2xl bg-muted/60 p-4">
        <span className="text-sm text-muted-fg">Recommended selection incl. {tax}% tax</span>
        <span className="font-display text-xl font-extrabold">{money(total)}</span>
      </div>
      {pkg.terms ? <p className="text-xs text-muted-fg">{pkg.terms}</p> : null}
    </div>
  );
}
