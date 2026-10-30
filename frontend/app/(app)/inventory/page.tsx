'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowDownToLine, Boxes, DollarSign, Download, History, MoreHorizontal, PackageCheck, PackagePlus, Pencil, Plus, Scale, Send, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { api, downloadFrom, errorMessage } from '@/lib/api';
import { refresh, useApi, useFilms, useStores } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { fmtDateTime, money, num } from '@/lib/format';
import type { Project, Roll } from '@/lib/types';
import { Badge, Button, Card, Checkbox, Drawer, EmptyState, ErrorState, Field, Input, Menu, MenuItem, Modal, PageHeader, PageLoader, Progress, SearchInput, Select, StatCard, Stagger, StaggerItem, cn, useConfirm } from '@/components/ui';

type RollForm = { filmId: string; name: string; brand: string; shade: string; storeId: string; widthMm: string; lengthM: string; remainingM2: string; reorderAtM2: string; costPerM2: string; sellPerM2: string; batch: string; location: string };
const EMPTY: RollForm = { filmId: '', name: '', brand: '', shade: '', storeId: '', widthMm: '1524', lengthM: '30.5', remainingM2: '', reorderAtM2: '10', costPerM2: '', sellPerM2: '', batch: '', location: '' };

type Act = { kind: 'allocate' | 'receive' | 'adjust'; roll: Roll };

const MOVE_META: Record<string, { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' | 'primary' }> = {
  received: { label: 'Received', tone: 'success' },
  allocated: { label: 'Allocated', tone: 'primary' },
  reorder: { label: 'Reorder requested', tone: 'warning' },
  adjusted: { label: 'Adjusted', tone: 'info' },
};

export default function InventoryPage() {
  const { storeId } = useStoreScope();
  const { data, error, isLoading, mutate } = useApi<Roll[]>(`/inventory${storeId ? `?storeId=${storeId}` : ''}`);
  const { data: stores } = useStores();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<Roll | 'new' | null>(null);
  const [act, setAct] = useState<Act | null>(null);
  const [history, setHistory] = useState<Roll | null>(null);
  const [exporting, setExporting] = useState(false);

  const storeName = (id?: string) => stores?.find((s) => s._id === id)?.name || '—';
  const rolls = useMemo(() => (data || []).filter((r) => !r.archived), [data]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rolls.filter((r) => (!lowOnly || r.remainingM2 <= r.reorderAtM2) && (!s || [r.name, r.brand, r.batch, r.location, storeName(r.storeId)].some((x) => (x || '').toLowerCase().includes(s))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolls, q, lowOnly, stores]);

  const stats = useMemo(() => {
    const low = rolls.filter((r) => r.remainingM2 <= r.reorderAtM2).length;
    const area = rolls.reduce((s, r) => s + (r.remainingM2 || 0), 0);
    const value = rolls.reduce((s, r) => s + (r.remainingM2 || 0) * (r.costPerM2 || 0), 0);
    return { count: rolls.length, low, area, value };
  }, [rolls]);

  const reload = () => {
    mutate();
    refresh('/dashboard');
  };

  const reorder = async (r: Roll) => {
    try {
      await api.ops('inventory', r._id, 'reorder');
      toast.success(`Reorder placed for ${r.brand} ${r.name}`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (r: Roll) => {
    const ok = await confirm({ title: `Delete ${r.name}?`, description: 'The roll and its movement history are removed permanently. Projects keep their allocations.', confirmLabel: 'Delete roll', danger: true });
    if (!ok) return;
    try {
      await api.del(`/inventory/${r._id}`);
      toast.success('Film roll deleted');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFrom('/export/stock', 'stock.csv');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <div>
      <PageHeader
        icon={Boxes}
        eyebrow="Operations"
        title="Film inventory"
        subtitle="Track film rolls, allocations and reorder actions across your stores."
        actions={
          <>
            <Button variant="outline" icon={Download} loading={exporting} onClick={exportCsv}>
              Export stock
            </Button>
            <Button icon={Plus} onClick={() => setEditing('new')}>
              New roll
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Rolls tracked" value={stats.count} icon={Boxes} tone="primary" />
        <StatCard index={1} label="Low stock" value={stats.low} icon={AlertTriangle} tone={stats.low ? 'danger' : 'success'} sub={stats.low ? 'at or below reorder point' : 'all healthy'} onClick={() => setLowOnly(true)} />
        <StatCard index={2} label="Area available" value={stats.area} format={(n) => `${num(n, 1)} m²`} icon={Scale} tone="info" />
        <StatCard index={3} label="Stock value" value={stats.value} format={(n) => money(n, { cents: false })} icon={DollarSign} tone="accent" sub="at cost" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search stock…" className="w-full sm:w-80" />
        <Checkbox checked={lowOnly} onChange={setLowOnly} label="Low stock only" />
        <p className="ml-auto text-xs text-muted-fg">{filtered.length} rolls</p>
      </div>

      {isLoading && !data ? (
        <PageLoader />
      ) : !filtered.length ? (
        <Card>
          <EmptyState icon={Boxes} title="No rolls match" description="Try a different search or create a new roll." action={<Button icon={Plus} onClick={() => setEditing('new')}>New roll</Button>} />
        </Card>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((r) => {
            const low = r.remainingM2 <= r.reorderAtM2;
            const capacity = Math.max(r.remainingM2, (r.widthMm / 1000) * r.lengthM, r.reorderAtM2 * 2, 1);
            return (
              <StaggerItem key={r._id}>
                <motion.div whileHover={{ y: -3 }} className={cn('card relative overflow-hidden p-5', low && 'ring-1 ring-danger/30')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">{r.brand || 'Film'}</p>
                      <p className="truncate font-display text-base font-bold">{r.name}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.shade !== undefined && r.shade !== null ? <Badge tone="primary">{r.shade}% VLT</Badge> : null}
                        <Badge>{r.widthMm} mm</Badge>
                        <Badge>{storeName(r.storeId)}</Badge>
                        {low ? <Badge tone="danger" dot>Low stock</Badge> : null}
                        {r.reorderPending ? <Badge tone="warning" dot>Reorder pending</Badge> : null}
                      </div>
                    </div>
                    <Menu
                      trigger={() => (
                        <button type="button" aria-label="Roll actions" className="rounded-lg p-1.5 text-muted-fg hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem icon={Pencil} onClick={() => { close(); setEditing(r); }}>Edit roll</MenuItem>
                          <MenuItem icon={Scale} onClick={() => { close(); setAct({ kind: 'adjust', roll: r }); }}>Adjust stock</MenuItem>
                          <MenuItem icon={History} onClick={() => { close(); setHistory(r); }}>Movement history</MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => { close(); remove(r); }}>Delete roll</MenuItem>
                        </>
                      )}
                    </Menu>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-end justify-between">
                      <p className="font-display text-2xl font-extrabold">
                        {num(r.remainingM2, 1)}
                        <span className="ml-1 text-sm font-semibold text-muted-fg">m²</span>
                      </p>
                      <p className="text-xs text-muted-fg">Reorder at {num(r.reorderAtM2, 1)} m²</p>
                    </div>
                    <div className="relative">
                      <Progress value={r.remainingM2} max={capacity} tone={low ? 'danger' : r.remainingM2 <= r.reorderAtM2 * 1.5 ? 'warning' : 'success'} />
                      <span className="absolute -top-1 h-4 w-0.5 rounded bg-fg/60" style={{ left: `${Math.min(100, (r.reorderAtM2 / capacity) * 100)}%` }} title="Reorder point" />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-fg">Cost</p>
                        <p className="font-semibold">{money(r.costPerM2)}/m²</p>
                      </div>
                      <div>
                        <p className="text-muted-fg">Sell</p>
                        <p className="font-semibold">{money(r.sellPerM2)}/m²</p>
                      </div>
                      <div>
                        <p className="text-muted-fg">Batch</p>
                        <p className="truncate font-semibold">{r.batch || '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                    <Button size="sm" icon={Send} onClick={() => setAct({ kind: 'allocate', roll: r })}>
                      Allocate
                    </Button>
                    {r.reorderPending ? (
                      <Button size="sm" variant="success" icon={PackageCheck} onClick={() => setAct({ kind: 'receive', roll: r })}>
                        Reorder received
                      </Button>
                    ) : (
                      <Button size="sm" variant={low ? 'danger' : 'outline'} icon={Truck} onClick={() => reorder(r)}>
                        Reorder
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon={History} onClick={() => setHistory(r)}>
                      History
                    </Button>
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <RollModal roll={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ActionModal act={act} onClose={() => setAct(null)} onDone={reload} />
      <Drawer open={!!history} onClose={() => setHistory(null)} title="Stock and allocation history" subtitle={history ? `${history.brand || ''} ${history.name}` : ''}>
        {history && (history.movements || []).length ? (
          <ol className="relative space-y-4 border-l border-line pl-5">
            {(history.movements || []).map((m) => {
              const meta = MOVE_META[m.type] || { label: m.type, tone: 'neutral' as const };
              return (
                <li key={m.id} className="relative">
                  <span className={cn('absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-card', m.qty > 0 ? 'bg-success' : m.qty < 0 ? 'bg-primary' : 'bg-warning')} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {m.qty ? <span className={cn('text-sm font-bold', m.qty > 0 ? 'text-success' : 'text-primary')}>{m.qty > 0 ? '+' : ''}{num(m.qty, 2)} m²</span> : null}
                    {m.projectNumber ? <a href={`/projects/${m.projectId}`} className="text-xs font-semibold text-primary hover:underline">{m.projectNumber}</a> : null}
                  </div>
                  {m.note ? <p className="mt-1 text-sm">{m.note}</p> : null}
                  <p className="mt-0.5 text-xs text-muted-fg">
                    {fmtDateTime(m.at)}
                    {m.balance !== undefined ? ` · balance ${num(m.balance, 2)} m²` : ''}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState icon={History} title="No movements yet" description="Allocate a roll or receive a reorder to build history." />
        )}
      </Drawer>
    </div>
  );
}

function RollModal({ roll, onClose, onSaved }: { roll: Roll | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { data: films } = useFilms();
  const { data: stores } = useStores();
  const { storeId } = useStoreScope();
  const [f, setF] = useState<RollForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const isNew = roll === 'new';

  useEffect(() => {
    if (!roll) return;
    if (roll === 'new') setF({ ...EMPTY, storeId: storeId || stores?.[0]?._id || '' });
    else
      setF({
        filmId: roll.filmId || '', name: roll.name, brand: roll.brand || '', shade: roll.shade?.toString() ?? '', storeId: roll.storeId || '', widthMm: String(roll.widthMm), lengthM: String(roll.lengthM),
        remainingM2: String(roll.remainingM2), reorderAtM2: String(roll.reorderAtM2), costPerM2: String(roll.costPerM2), sellPerM2: String(roll.sellPerM2), batch: roll.batch || '', location: roll.location || '',
      });
  }, [roll, storeId, stores]);

  const set = (k: keyof RollForm, v: string) => setF((s) => ({ ...s, [k]: v }));
  const film = films?.find((x) => x._id === f.filmId);

  const pickFilm = (id: string) => {
    const fl = films?.find((x) => x._id === id);
    if (!fl) return set('filmId', '');
    const shade = fl.shades?.[0]?.vlt;
    setF((s) => ({ ...s, filmId: id, brand: fl.brand || '', shade: shade?.toString() ?? '', name: `${fl.name}${shade !== undefined ? ` ${shade}` : ''}`, costPerM2: String(fl.costPerM2), sellPerM2: String(fl.sellPerM2), widthMm: String(fl.rollWidths?.[0] || s.widthMm) }));
  };

  const fullRoll = () => set('remainingM2', String(Math.round(((Number(f.widthMm) || 0) / 1000) * (Number(f.lengthM) || 0) * 100) / 100));

  const save = async () => {
    if (!f.name.trim()) return toast.error('Film name is required');
    if (!f.storeId) return toast.error('Choose a store.');
    if (Number(f.remainingM2) < 0) return toast.error('Stock cannot become negative.');
    const body = {
      filmId: f.filmId || undefined, name: f.name.trim(), brand: f.brand.trim(), shade: f.shade === '' ? undefined : Number(f.shade), storeId: f.storeId,
      widthMm: Number(f.widthMm) || 1524, lengthM: Number(f.lengthM) || 30.5, remainingM2: Number(f.remainingM2) || 0, reorderAtM2: Number(f.reorderAtM2) || 0,
      costPerM2: Number(f.costPerM2) || 0, sellPerM2: Number(f.sellPerM2) || 0, batch: f.batch.trim(), location: f.location.trim(),
    };
    setBusy(true);
    try {
      if (isNew) await api.post('/inventory', body);
      else if (roll) {
        const { remainingM2, ...rest } = body;
        await api.patch(`/inventory/${roll._id}`, rest);
        if (Math.abs(remainingM2 - roll.remainingM2) > 0.0001) await api.ops('inventory', roll._id, 'adjust', { qty: Math.round((remainingM2 - roll.remainingM2) * 100) / 100, note: 'Stock count corrected in roll editor' });
      }
      toast.success(isNew ? 'Inventory roll created.' : 'Film roll saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!roll}
      onClose={onClose}
      size="lg"
      icon={PackagePlus}
      title={isNew ? 'New film roll' : 'Edit film roll'}
      description="Link the roll to a film from the library to auto-fill brand, shade and pricing."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save roll
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Film (library)" className="sm:col-span-2">
          <Select value={f.filmId} onChange={(e) => pickFilm(e.target.value)}>
            <option value="">— Not linked —</option>
            {(films || []).map((fl) => (
              <option key={fl._id} value={fl._id}>
                {fl.brand} {fl.name} · {fl.category}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Film name" required>
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ceramic IR 20" />
        </Field>
        <Field label="Brand">
          <Input value={f.brand} onChange={(e) => set('brand', e.target.value)} />
        </Field>
        <Field label="Shade (VLT %)">
          {film?.shades?.length ? (
            <Select value={f.shade} onChange={(e) => set('shade', e.target.value)}>
              {film.shades.map((s) => (
                <option key={s.vlt} value={s.vlt}>
                  {s.vlt}% · TSER {s.tser}%
                </option>
              ))}
            </Select>
          ) : (
            <Input type="number" min="0" max="100" value={f.shade} onChange={(e) => set('shade', e.target.value)} />
          )}
        </Field>
        <Field label="Store" required>
          <Select value={f.storeId} onChange={(e) => set('storeId', e.target.value)}>
            <option value="">Choose a store</option>
            {(stores || []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Roll width (mm)">
          {film?.rollWidths?.length ? (
            <Select value={f.widthMm} onChange={(e) => set('widthMm', e.target.value)}>
              {Array.from(new Set([...film.rollWidths, Number(f.widthMm)])).filter(Boolean).map((w) => (
                <option key={w} value={w}>
                  {w} mm
                </option>
              ))}
            </Select>
          ) : (
            <Input type="number" min="0" value={f.widthMm} onChange={(e) => set('widthMm', e.target.value)} />
          )}
        </Field>
        <Field label="Roll length (m)">
          <Input type="number" min="0" step="0.1" value={f.lengthM} onChange={(e) => set('lengthM', e.target.value)} />
        </Field>
        <Field label="Remaining (m²)" hint={<button type="button" className="font-semibold text-primary hover:underline" onClick={fullRoll}>Use full roll area</button>}>
          <Input type="number" min="0" step="0.1" value={f.remainingM2} onChange={(e) => set('remainingM2', e.target.value)} />
        </Field>
        <Field label="Reorder at (m²)">
          <Input type="number" min="0" step="0.1" value={f.reorderAtM2} onChange={(e) => set('reorderAtM2', e.target.value)} />
        </Field>
        <Field label="Cost ($/m²)">
          <Input type="number" min="0" step="0.01" value={f.costPerM2} onChange={(e) => set('costPerM2', e.target.value)} />
        </Field>
        <Field label="Sell rate ($/m²)">
          <Input type="number" min="0" step="0.01" value={f.sellPerM2} onChange={(e) => set('sellPerM2', e.target.value)} />
        </Field>
        <Field label="Batch">
          <Input value={f.batch} onChange={(e) => set('batch', e.target.value)} />
        </Field>
        <Field label="Location">
          <Input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Rack A" />
        </Field>
      </div>
    </Modal>
  );
}

function ActionModal({ act, onClose, onDone }: { act: Act | null; onClose: () => void; onDone: () => void }) {
  const roll = act?.roll;
  const { data: projects } = useApi<Project[]>(act?.kind === 'allocate' && roll?.storeId ? `/projects?storeId=${roll.storeId}` : null);
  const [qty, setQty] = useState('');
  const [projectId, setProjectId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!act) return;
    setQty('');
    setProjectId('');
    setNote('');
  }, [act]);

  const eligible = (projects || []).filter((p) => p.stage !== 'closed');
  const selected = eligible.find((p) => p._id === projectId);

  const submit = async () => {
    if (!act || !roll) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n === 0 || (act.kind !== 'adjust' && n <= 0)) return toast.error('Enter a valid allocation.');
    if (act.kind === 'allocate' && !projectId) return toast.error('Choose a project at this store.');
    if (act.kind === 'allocate' && n > roll.remainingM2) return toast.error('Not enough stock for this allocation.');
    if (act.kind === 'adjust' && !note.trim()) return toast.error('Give a reason for the adjustment.');
    if (act.kind === 'adjust' && roll.remainingM2 + n < 0) return toast.error('Stock cannot become negative.');
    setBusy(true);
    try {
      await api.ops('inventory', roll._id, act.kind, { qty: n, projectId: projectId || undefined, note: note.trim() || undefined });
      toast.success(act.kind === 'allocate' ? `Allocated ${n} m² to ${selected?.number}` : act.kind === 'receive' ? `Received ${n} m²` : 'Stock adjusted');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const title = act?.kind === 'allocate' ? 'Allocate film' : act?.kind === 'receive' ? 'Reorder received' : 'Adjust stock';
  return (
    <Modal
      open={!!act}
      onClose={onClose}
      size="sm"
      icon={act?.kind === 'allocate' ? Send : act?.kind === 'receive' ? ArrowDownToLine : Scale}
      title={title}
      description={roll ? `${roll.brand || ''} ${roll.name} · ${num(roll.remainingM2, 2)} m² available` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            {act?.kind === 'allocate' ? 'Save allocation' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {act?.kind === 'allocate' ? (
          <Field label="Project at this store" hint="Allocate film to a project at the same store." required>
            <Select value={projectId} onChange={(e) => {
              setProjectId(e.target.value);
              const p = eligible.find((x) => x._id === e.target.value);
              if (p && !qty && p.totals?.measuredM2) setQty(String(Math.round(p.totals.measuredM2 * 1.15 * 100) / 100));
            }}>
              <option value="">Choose a project</option>
              {eligible.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.number} · {p.contact?.name || p.title} {p.totals?.measuredM2 ? `(${num(p.totals.measuredM2, 2)} m² measured)` : ''}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field
          label={act?.kind === 'adjust' ? 'Adjustment (m², use − to reduce)' : 'Area (m²)'}
          hint={act?.kind === 'allocate' && selected?.totals?.measuredM2 ? 'Suggested = measured glass + 15% trim/waste allowance.' : undefined}
          required
        >
          <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label={act?.kind === 'adjust' ? 'Reason' : 'Note'} required={act?.kind === 'adjust'}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={act?.kind === 'adjust' ? 'e.g. Stocktake correction, damaged film' : 'Optional'} />
        </Field>
      </div>
    </Modal>
  );
}
