'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BarChart3, Layers, Pencil, Plus, Radio, ShieldCheck, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { refresh, useFilms, useMeta } from '@/lib/hooks';
import { money } from '@/lib/format';
import type { Film, Segment, Shade } from '@/lib/types';
import { useChartColors } from '@/lib/chart-colors';
import { Badge, Button, Card, Checkbox, Drawer, EmptyState, ErrorState, Field, Input, Modal, PageHeader, SearchInput, Select, Skeleton, Stagger, StaggerItem, Switch, Tabs, Textarea, cn, useConfirm } from '@/components/ui';
import { glassLook } from '@/components/studio/tint';

const SEGMENTS: Segment[] = ['automotive', 'residential', 'commercial'];
const SCENE = 'linear-gradient(160deg,#9cc8f0 0%,#e3f0fb 48%,#7d8b6b 49%,#59674c 100%)';
const blank = (): Partial<Film> => ({
  name: '', brand: '', line: '', category: 'ceramic', segments: ['automotive'], description: '', irr: 80, uvr: 99, reflectivity: 0.07, signalSafe: true, tintColor: '#15181d',
  thicknessMil: 1.5, warrantyYears: 10, rollWidths: [1524], costPerM2: 20, sellPerM2: 90, glassCompat: {}, tier: 2, active: true, shades: [{ vlt: 20, tser: 50, glare: 75, absorptance: 0.45 }],
});

function ShadeStrip({ film, size = 'md' }: { film: Film; size?: 'sm' | 'md' }) {
  const shades = [...film.shades].sort((a, b) => b.vlt - a.vlt);
  return (
    <div className="flex gap-1">
      {shades.map((s) => (
        <div key={s.vlt} className="min-w-0 flex-1" title={`${s.vlt}% VLT · ${s.tser}% TSER`}>
          <div className={cn('relative overflow-hidden rounded-lg border border-line', size === 'sm' ? 'h-7' : 'h-12')} style={{ background: SCENE }}>
            <div className="absolute inset-0" style={{ background: film.tintColor, opacity: glassLook(s.vlt, film).opacity }} />
          </div>
          <p className="mt-0.5 text-center text-[10px] font-semibold text-muted-fg">{s.vlt}%</p>
        </div>
      ))}
    </div>
  );
}

function FilmEditor({ open, film, onClose }: { open: boolean; film: Partial<Film> | null; onClose: () => void }) {
  const { data: meta } = useMeta();
  const [f, setF] = useState<Partial<Film>>(blank());
  const [rolls, setRolls] = useState('1524');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      const base = film ? { ...blank(), ...film } : blank();
      setF(base);
      setRolls((base.rollWidths || []).join(', '));
    }
  }, [open, film]);
  const set = (patch: Partial<Film>) => setF((x) => ({ ...x, ...patch }));
  const setShade = (i: number, patch: Partial<Shade>) => set({ shades: (f.shades || []).map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const save = async () => {
    if (!String(f.name || '').trim()) return toast.error('Film name is required');
    if (!f.segments?.length) return toast.error('Choose at least one segment');
    const shades = (f.shades || []).filter((s) => Number(s.vlt) > 0);
    if (!shades.length) return toast.error('Add at least one shade');
    if (new Set(shades.map((s) => Number(s.vlt))).size !== shades.length) return toast.error('Each shade needs a unique VLT');
    const rollWidths = rolls.split(/[,\s]+/).map(Number).filter((n) => n > 0);
    if (!rollWidths.length) return toast.error('Enter at least one roll width (mm)');
    const body = {
      ...f,
      rollWidths,
      shades: shades.map((s) => ({ vlt: Number(s.vlt), tser: Number(s.tser) || 0, glare: Number(s.glare) || 0, absorptance: Math.min(1, Math.max(0, Number(s.absorptance) || 0)) })),
      irr: Number(f.irr) || 0, uvr: Number(f.uvr) || 0, reflectivity: Math.min(1, Math.max(0, Number(f.reflectivity) || 0)), thicknessMil: Number(f.thicknessMil) || 0,
      warrantyYears: Number(f.warrantyYears) || 0, costPerM2: Number(f.costPerM2) || 0, sellPerM2: Number(f.sellPerM2) || 0, tier: Number(f.tier) || 1,
    };
    setBusy(true);
    try {
      if (f._id) await api.patch(`/films/${f._id}`, body);
      else await api.post('/films', body);
      await refresh('/films');
      toast.success(f._id ? 'Film updated' : 'Film added to the library');
      onClose();
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
      icon={Layers}
      title={f._id ? `Edit ${f.brand || ''} ${f.name}` : 'New film'}
      description="Specs drive the Smart Advisor, the 3D visualizer, legal checks and pricing."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save film</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Brand"><Input value={f.brand || ''} onChange={(e) => set({ brand: e.target.value })} placeholder="e.g. XPEL" /></Field>
        <Field label="Film name" required><Input value={f.name || ''} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Prime XR Plus" /></Field>
        <Field label="Product line"><Input value={f.line || ''} onChange={(e) => set({ line: e.target.value })} /></Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {(meta?.filmCategories || ['ceramic']).map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Tint colour">
          <div className="flex gap-2">
            <input type="color" value={f.tintColor || '#15181d'} onChange={(e) => set({ tintColor: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-card" aria-label="Tint colour" />
            <Input value={f.tintColor || ''} onChange={(e) => set({ tintColor: e.target.value })} className="font-mono" />
          </div>
        </Field>
        <Field label="Tier (1 value – 5 flagship)"><Input type="number" min={1} max={5} value={f.tier ?? 2} onChange={(e) => set({ tier: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Segments" className="mt-4">
        <div className="flex flex-wrap gap-4">
          {SEGMENTS.map((s) => (
            <Checkbox key={s} checked={!!f.segments?.includes(s)} onChange={(v) => set({ segments: v ? [...(f.segments || []), s] : (f.segments || []).filter((x) => x !== s) })} label={<span className="capitalize">{s}</span>} />
          ))}
        </div>
      </Field>
      <Field label="Description" className="mt-4"><Textarea rows={2} value={f.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Field label="IR rejection %"><Input type="number" min={0} max={100} value={f.irr ?? 0} onChange={(e) => set({ irr: Number(e.target.value) })} /></Field>
        <Field label="UV rejection %"><Input type="number" min={0} max={100} step={0.1} value={f.uvr ?? 0} onChange={(e) => set({ uvr: Number(e.target.value) })} /></Field>
        <Field label="Reflectivity (0–1)"><Input type="number" min={0} max={1} step={0.01} value={f.reflectivity ?? 0} onChange={(e) => set({ reflectivity: Number(e.target.value) })} /></Field>
        <Field label="Thickness (mil)"><Input type="number" min={0} step={0.5} value={f.thicknessMil ?? 0} onChange={(e) => set({ thicknessMil: Number(e.target.value) })} /></Field>
        <Field label="Warranty (years)"><Input type="number" min={0} value={f.warrantyYears ?? 0} onChange={(e) => set({ warrantyYears: Number(e.target.value) })} /></Field>
        <Field label="Cost $/m²"><Input type="number" min={0} value={f.costPerM2 ?? 0} onChange={(e) => set({ costPerM2: Number(e.target.value) })} /></Field>
        <Field label="Sell $/m²"><Input type="number" min={0} value={f.sellPerM2 ?? 0} onChange={(e) => set({ sellPerM2: Number(e.target.value) })} /></Field>
        <Field label="Roll widths (mm)" hint="Comma separated"><Input value={rolls} onChange={(e) => setRolls(e.target.value)} placeholder="1016, 1524" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-6">
        <Switch checked={!!f.signalSafe} onChange={(v) => set({ signalSafe: v })} label="Signal-safe (non-metal)" />
        <Switch checked={f.active !== false} onChange={(v) => set({ active: v })} label="Active" />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="label mb-0">Shades</p>
          <Button size="xs" variant="ghost" icon={Plus} onClick={() => set({ shades: [...(f.shades || []), { vlt: 35, tser: 45, glare: 55, absorptance: 0.4 }] })}>Add shade</Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="table-base">
            <thead><tr><th>VLT %</th><th>TSER %</th><th>Glare cut %</th><th>Absorptance (0–1)</th><th /></tr></thead>
            <tbody>
              {(f.shades || []).map((s, i) => (
                <tr key={i}>
                  <td><Input type="number" min={1} max={100} value={s.vlt} onChange={(e) => setShade(i, { vlt: Number(e.target.value) })} className="h-8 w-20" /></td>
                  <td><Input type="number" min={0} max={100} value={s.tser} onChange={(e) => setShade(i, { tser: Number(e.target.value) })} className="h-8 w-20" /></td>
                  <td><Input type="number" min={0} max={100} value={s.glare} onChange={(e) => setShade(i, { glare: Number(e.target.value) })} className="h-8 w-20" /></td>
                  <td><Input type="number" min={0} max={1} step={0.01} value={s.absorptance} onChange={(e) => setShade(i, { absorptance: Number(e.target.value) })} className="h-8 w-24" /></td>
                  <td><button type="button" aria-label="Remove shade" onClick={() => set({ shades: (f.shades || []).filter((_, k) => k !== i) })} className="rounded p-1 text-muted-fg hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <p className="label">Glass compatibility</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(meta?.glassTypes || []).map((g) => (
            <div key={g.key} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span>{g.label}</span>
              <Select value={f.glassCompat?.[g.key] || 'ok'} onChange={(e) => set({ glassCompat: { ...(f.glassCompat || {}), [g.key]: e.target.value } })} className="h-8 w-28 text-xs">
                <option value="ok">OK</option>
                <option value="caution">Caution</option>
                <option value="no">Not allowed</option>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function CompareModal({ films, onClose, onRemove }: { films: Film[]; onClose: () => void; onRemove: (id: string) => void }) {
  const colors = useChartColors();
  const metrics: { key: string; label: string; get: (f: Film) => number; fmt: (n: number) => string; max?: number }[] = [
    { key: 'tser', label: 'Best total solar rejected', get: (f) => Math.max(...f.shades.map((s) => s.tser)), fmt: (n) => `${n}%`, max: 100 },
    { key: 'irr', label: 'Infrared rejected', get: (f) => f.irr, fmt: (n) => `${n}%`, max: 100 },
    { key: 'uvr', label: 'UV blocked', get: (f) => f.uvr, fmt: (n) => `${n}%`, max: 100 },
    { key: 'glare', label: 'Max glare reduction', get: (f) => Math.max(...f.shades.map((s) => s.glare)), fmt: (n) => `${n}%`, max: 100 },
    { key: 'refl', label: 'Exterior reflectance', get: (f) => Math.round(f.reflectivity * 100), fmt: (n) => `${n}%`, max: 100 },
    { key: 'warranty', label: 'Warranty', get: (f) => f.warrantyYears, fmt: (n) => `${n} yrs` },
    { key: 'sell', label: 'Sell price per m²', get: (f) => f.sellPerM2, fmt: (n) => money(n, { cents: false }) },
    { key: 'margin', label: 'Gross margin per m²', get: (f) => f.sellPerM2 - f.costPerM2, fmt: (n) => money(n, { cents: false }) },
  ];
  return (
    <Modal open={films.length > 0} onClose={onClose} size="xl" icon={BarChart3} title="Compare films" description="Side-by-side specs — each bar is labelled with its value.">
      <div className="mb-4 flex flex-wrap gap-3">
        {films.map((f, i) => (
          <span key={f._id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold">
            <span className="h-3 w-3 rounded-sm" style={{ background: colors.series[i] }} />
            {f.brand} {f.name}
            <button type="button" aria-label={`Remove ${f.name} from comparison`} onClick={() => onRemove(f._id)} className="text-muted-fg hover:text-danger"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((m) => {
          const vals = films.map(m.get);
          const max = m.max ?? Math.max(1, ...vals);
          return (
            <div key={m.key} className="rounded-2xl border border-line p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-fg">{m.label}</p>
              <div className="space-y-1.5">
                {films.map((f, i) => (
                  <div key={f._id} className="flex items-center gap-2">
                    <span className="w-24 truncate text-xs text-muted-fg">{f.name}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-r-md bg-muted/60">
                      <motion.div className="h-full rounded-r-md" style={{ background: colors.series[i] }} initial={{ width: 0 }} animate={{ width: `${Math.max(2, (vals[i] / max) * 100)}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} />
                    </div>
                    <span className="w-16 text-right text-xs font-semibold">{m.fmt(vals[i])}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="table-base">
          <thead><tr><th>Film</th><th>Category</th><th>Shades (VLT)</th><th>Signal-safe</th><th>Roll widths</th></tr></thead>
          <tbody>
            {films.map((f) => (
              <tr key={f._id}>
                <td className="font-semibold">{f.brand} {f.name}</td>
                <td className="capitalize">{f.category.replace('_', ' ')}</td>
                <td>{[...f.shades].sort((a, b) => a.vlt - b.vlt).map((s) => s.vlt).join(', ')}%</td>
                <td>{f.signalSafe ? 'Yes' : 'No'}</td>
                <td>{f.rollWidths.join(', ')} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function FilmLibrary() {
  const params = useSearchParams();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: meta } = useMeta();
  const { data: films, error, mutate, isLoading } = useFilms();
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState<'all' | Segment>('all');
  const [category, setCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Partial<Film> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detail, setDetail] = useState<Film | null>(null);

  useEffect(() => {
    const id = params.get('film');
    if (id && films) setDetail(films.find((f) => f._id === id) || null);
  }, [params, films]);
  // Keep an open detail panel in sync after edits.
  useEffect(() => {
    if (films) setDetail((d) => (d ? films.find((x) => x._id === d._id) || null : d));
  }, [films]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (films || []).filter(
      (f) =>
        (showInactive || f.active !== false) &&
        (segment === 'all' || f.segments.includes(segment)) &&
        (!category || f.category === category) &&
        (!s || `${f.brand} ${f.name} ${f.line} ${f.category} ${f.description}`.toLowerCase().includes(s)),
    );
  }, [films, q, segment, category, showInactive]);

  const toggleCompare = (id: string) => {
    setCompare((c) => {
      if (c.includes(id)) return c.filter((x) => x !== id);
      if (c.length >= 3) {
        toast.message('Compare up to 3 films at a time');
        return c;
      }
      return [...c, id];
    });
  };
  const remove = async (f: Film) => {
    if (!(await confirm({ title: `Delete ${f.brand} ${f.name}?`, description: 'Films used by inventory rolls or projects cannot be deleted — mark them inactive instead.', danger: true, confirmLabel: 'Delete film' }))) return;
    try {
      await api.del(`/films/${f._id}`);
      mutate();
      setDetail(null);
      toast.success('Film deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const closeDetail = () => {
    setDetail(null);
    if (params.get('film')) router.replace('/films');
  };

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  const compareFilms = compare.map((id) => (films || []).find((f) => f._id === id)).filter(Boolean) as Film[];

  return (
    <div>
      <PageHeader
        icon={Layers}
        eyebrow="AI Studio"
        title="Film Library"
        subtitle="Every film you sell — specs, shades, glass compatibility and pricing."
        actions={
          <>
            <Button variant="outline" icon={BarChart3} disabled={compare.length < 2} onClick={() => setCompareOpen(true)}>Compare ({compare.length})</Button>
            <Button icon={Plus} onClick={() => { setEditing(null); setEditorOpen(true); }}>New film</Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={segment}
          onChange={setSegment}
          layoutId="film-seg"
          tabs={[{ key: 'all', label: 'All' }, ...SEGMENTS.map((s) => ({ key: s, label: <span className="capitalize">{s}</span> }))] as { key: 'all' | Segment; label: React.ReactNode }[]}
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-44" aria-label="Category">
          <option value="">All categories</option>
          {(meta?.filmCategories || []).map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </Select>
        <SearchInput value={q} onChange={setQ} placeholder="Search films…" className="min-w-[200px] flex-1 sm:max-w-xs" />
        <Switch checked={showInactive} onChange={setShowInactive} label="Show inactive" size="sm" />
      </div>

      {isLoading && !films ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : !list.length ? (
        <Card><EmptyState icon={Layers} title="No films match" description="Try another filter or add a film." action={<Button icon={Plus} onClick={() => { setEditing(null); setEditorOpen(true); }}>New film</Button>} /></Card>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((f) => {
            const best = [...f.shades].sort((a, b) => b.tser - a.tser)[0];
            const selected = compare.includes(f._id);
            return (
              <StaggerItem key={f._id}>
                <motion.div whileHover={{ y: -3 }} className={cn('card group flex h-full flex-col p-4 transition', selected && 'ring-2 ring-primary/40', f.active === false && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => setDetail(f)} className="min-w-0 text-left">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{f.brand}</p>
                      <p className="truncate font-display text-lg font-extrabold">{f.name}</p>
                    </button>
                    <div className="flex shrink-0 gap-0.5 opacity-70 transition group-hover:opacity-100">
                      <button type="button" aria-label="Edit film" onClick={() => { setEditing(f); setEditorOpen(true); }} className="rounded-lg p-1.5 text-muted-fg hover:bg-muted hover:text-fg"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label="Delete film" onClick={() => remove(f)} className="rounded-lg p-1.5 text-muted-fg hover:bg-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone="primary" className="capitalize">{f.category.replace('_', ' ')}</Badge>
                    {f.segments.map((s) => <Badge key={s} className="capitalize">{s}</Badge>)}
                    {f.signalSafe ? <Badge tone="success"><Radio className="h-3 w-3" /> Signal-safe</Badge> : null}
                    {f.active === false ? <Badge tone="warning">Inactive</Badge> : null}
                  </div>
                  <div className="mt-3"><ShadeStrip film={f} /></div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      { l: 'TSER', v: `${best?.tser ?? 0}%` },
                      { l: 'IR', v: `${f.irr}%` },
                      { l: 'UV', v: `${f.uvr}%` },
                      { l: 'Warranty', v: `${f.warrantyYears}y` },
                    ].map((m) => (
                      <div key={m.l} className="rounded-xl bg-muted/60 py-1.5">
                        <p className="text-[10px] font-semibold uppercase text-muted-fg">{m.l}</p>
                        <p className="text-sm font-bold">{m.v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs">
                    <span className="text-muted-fg">Sell <b className="text-fg">{money(f.sellPerM2, { cents: false })}</b>/m² · cost {money(f.costPerM2, { cents: false })}</span>
                    <Checkbox checked={selected} onChange={() => toggleCompare(f._id)} label="Compare" className="text-xs" />
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Drawer open={!!detail} onClose={closeDetail} title={detail ? `${detail.brand} ${detail.name}` : ''} subtitle={detail?.line} width={560}
        footer={detail ? (
          <>
            <Button variant="ghost" icon={Trash2} onClick={() => remove(detail)}>Delete</Button>
            {detail.segments.includes('automotive') ? <Button variant="outline" icon={Wand2} onClick={() => router.push(`/visualizer?film=${detail._id}`)}>Preview in 3D</Button> : null}
            <Button icon={Pencil} onClick={() => { setEditing(detail); setEditorOpen(true); }}>Edit</Button>
          </>
        ) : null}
      >
        {detail ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-fg">{detail.description || 'No description supplied.'}</p>
            <ShadeStrip film={detail} />
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="table-base">
                <thead><tr><th>VLT</th><th>TSER</th><th>Glare cut</th><th>Absorptance</th></tr></thead>
                <tbody>
                  {[...detail.shades].sort((a, b) => b.vlt - a.vlt).map((s) => (
                    <tr key={s.vlt}><td className="font-semibold">{s.vlt}%</td><td>{s.tser}%</td><td>{s.glare}%</td><td>{s.absorptance}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['IR rejection', `${detail.irr}%`], ['UV rejection', `${detail.uvr}%`], ['Reflectance', `${Math.round(detail.reflectivity * 100)}%`], ['Thickness', `${detail.thicknessMil} mil`],
                ['Warranty', `${detail.warrantyYears} years`], ['Roll widths', `${detail.rollWidths.join(', ')} mm`], ['Cost', `${money(detail.costPerM2)}/m²`], ['Sell', `${money(detail.sellPerM2)}/m²`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-fg">{k}</p><p className="font-semibold">{v}</p></div>
              ))}
            </div>
            <div>
              <p className="label flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Glass compatibility</p>
              <div className="grid gap-1.5">
                {(meta?.glassTypes || []).map((g) => {
                  const v = detail.glassCompat?.[g.key] || 'ok';
                  return (
                    <div key={g.key} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-sm">
                      {g.label}
                      <Badge tone={v === 'ok' ? 'success' : v === 'caution' ? 'warning' : 'danger'}>{v === 'ok' ? 'OK' : v === 'caution' ? 'Caution' : 'Not allowed'}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button variant="outline" icon={Sparkles} className="w-full" onClick={() => router.push('/advisor')}>Ask the Smart Advisor</Button>
          </div>
        ) : null}
      </Drawer>

      <FilmEditor open={editorOpen} film={editing} onClose={() => setEditorOpen(false)} />
      {compareOpen ? <CompareModal films={compareFilms} onClose={() => setCompareOpen(false)} onRemove={(id) => setCompare((c) => c.filter((x) => x !== id))} /> : null}
    </div>
  );
}

export default function FilmsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
      <FilmLibrary />
    </Suspense>
  );
}
