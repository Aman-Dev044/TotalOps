'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertTriangle, Building2, CarFront, CheckCircle2, Eye, EyeOff, Flame, Glasses, Home, Leaf, Package, Plus, Ruler, ShieldCheck, Sparkles, SunMedium, Thermometer, Trash2, Wallet, Wand2, Zap,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useApi, useDebounced, useMeta, useSettings } from '@/lib/hooks';
import { money, uid } from '@/lib/format';
import type { Project, Segment } from '@/lib/types';
import { useStoreScope } from '@/components/providers';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Progress, Select, Skeleton, Switch, Tabs, cn } from '@/components/ui';
import { CutPlanDiagram, type CutPlanData } from '@/components/studio/cut-plan';

type Goals = { heat: number; privacy: number; uv: number; glare: number; security: number; clarity: number; budget: number };
type PaneRow = { id: string; label: string; width: number | ''; height: number | ''; unit: string; qty: number | '' };
type Ranked = {
  film: { _id: string; name: string; brand?: string; category: string; tintColor?: string; warrantyYears: number; signalSafe: boolean; sellPerM2: number; costPerM2: number };
  shade: { vlt: number; tser: number; glare: number; absorptance: number };
  zoneShades: Record<string, number | null>;
  score: number; reasons: string[]; warnings: string[];
  perf: { vlt: number; tser: number; irr: number; uvr: number; glare: number };
  thermal: { level: 'low' | 'medium' | 'high'; score: number; reasons: string[] };
  compliance: { zone: string; label: string; filmVlt: number | null; combined: number; min: number; ok: boolean; message: string }[];
  pricing: { glassM2: number; materialM2: number; linearM: number; rollWidth: number; wastePct: number; labourHours: number; costMaterial: number; costLabour: number; sell: number; margin: number; marginPct: number };
  stock: { availableM2: number; enough: boolean; rolls: number };
  cut: CutPlanData | null;
};
type AdvisorResult = {
  legal: { code: string; name: string } | null;
  panes: { label: string; zoneLabel: string; widthMm: number; heightMm: number; qty: number; areaM2: number; legalMinVlt: number | null; recommendedVlt: number | null; rollWidth: number; fits: boolean; drops: number; cutSize: string; note: string }[];
  totals: { panes: number; glassM2: number };
  best: Ranked | null;
  ranked: Ranked[];
  savings: null | { heatBlockedW: number; kwhYear: number; dollarsYear: number; paybackYears: number | null; cabinTempDropC: number | null; co2KgYear: number };
  summary: string;
};

const GOALS: { key: keyof Goals; label: string; icon: any; hint: string }[] = [
  { key: 'heat', label: 'Heat rejection', icon: Flame, hint: 'Keep the cabin / room cool' },
  { key: 'privacy', label: 'Privacy', icon: EyeOff, hint: 'Darker from outside' },
  { key: 'uv', label: 'UV protection', icon: SunMedium, hint: 'Skin & interior fade' },
  { key: 'glare', label: 'Glare control', icon: Glasses, hint: 'Screens, driving glare' },
  { key: 'security', label: 'Safety & security', icon: ShieldCheck, hint: 'Shatter resistance' },
  { key: 'clarity', label: 'Clear view', icon: Eye, hint: 'Natural light, night visibility' },
  { key: 'budget', label: 'Budget focus', icon: Wallet, hint: 'Lower price matters' },
];
const ORIENTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const ZONE_LABEL: Record<string, string> = { frontSides: 'Front sides', rearSides: 'Rear sides', rearWindscreen: 'Rear screen', windscreen: 'Visor', sunroof: 'Sunroof' };

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? '#10b981' : score >= 55 ? '#6366f1' : '#f59e0b';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={8} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1, ease: [0.2, 0.7, 0.2, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-2xl font-extrabold leading-none">{score}</p>
          <p className="text-[10px] font-semibold uppercase text-muted-fg">score</p>
        </div>
      </div>
    </div>
  );
}

function Advisor() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: meta } = useMeta();
  const { data: settings } = useSettings();
  const { storeId } = useStoreScope();
  const { data: projects } = useApi<Project[]>('/projects?limit=400');

  const [segment, setSegment] = useState<Segment>('automotive');
  const [bodyType, setBodyType] = useState('suv');
  const [privacyRear, setPrivacyRear] = useState(false);
  const [includeVisor, setIncludeVisor] = useState(false);
  const [includeSunroof, setIncludeSunroof] = useState(false);
  const [region, setRegion] = useState('');
  const [projectId, setProjectId] = useState('');
  const [panes, setPanes] = useState<PaneRow[]>([
    { id: uid(), label: 'Living room slider', width: 2400, height: 2100, unit: 'mm', qty: 2 },
    { id: uid(), label: 'Kitchen window', width: 1800, height: 1200, unit: 'mm', qty: 1 },
  ]);
  const [goals, setGoals] = useState<Goals>({ heat: 4, privacy: 3, uv: 3, glare: 2, security: 0, clarity: 2, budget: 2 });
  const [glassType, setGlassType] = useState('single_clear');
  const [orientation, setOrientation] = useState('W');
  const [climate, setClimate] = useState<'hot' | 'warm' | 'temperate' | 'cold'>('hot');
  const [shading, setShading] = useState(false);
  const [removal, setRemoval] = useState(false);
  const [signalSafe, setSignalSafe] = useState(true);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(0);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const b = params.get('body');
    if (b) {
      setSegment('automotive');
      setBodyType(b);
    }
    const p = params.get('project');
    if (p) setProjectId(p);
  }, [params]);
  useEffect(() => {
    if (settings?.region && !region) setRegion(settings.region);
  }, [settings, region]);

  const project = useMemo(() => (projects || []).find((p) => p._id === projectId), [projects, projectId]);
  useEffect(() => {
    if (!project) return;
    setSegment(project.segment);
    if (project.vehicle?.bodyType) setBodyType(project.vehicle.bodyType);
  }, [project]);

  const payload = useMemo(() => {
    const base: Record<string, unknown> = { segment, goals, removal, storeId: storeId || undefined, region: region || undefined };
    if (projectId) base.projectId = projectId;
    if (segment === 'automotive') Object.assign(base, { bodyType, privacyRear, includeVisor, includeSunroof, preferSignalSafe: signalSafe });
    else {
      Object.assign(base, { glassType, orientation, climate, shading });
      if (!projectId) base.panes = panes.filter((p) => Number(p.width) > 0 && Number(p.height) > 0).map((p) => ({ label: p.label || 'Pane', width: Number(p.width), height: Number(p.height), unit: p.unit, qty: Number(p.qty) || 1 }));
    }
    return base;
  }, [segment, goals, removal, storeId, region, projectId, bodyType, privacyRear, includeVisor, includeSunroof, signalSafe, glassType, orientation, climate, shading, panes]);
  const debounced = useDebounced(JSON.stringify(payload), 450);

  useEffect(() => {
    if (!region) return;
    const body = JSON.parse(debounced);
    if (body.segment !== 'automotive' && !body.projectId && !(body.panes || []).length) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .post<AdvisorResult>('/advisor', body)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setSel(0);
        }
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, region]);

  const pick = result?.ranked[sel] || result?.best || null;

  const applyToProject = async () => {
    if (!projectId || !pick) return;
    setApplying(true);
    try {
      await api.action(projectId, 'film.set', { filmId: pick.film._id, shade: pick.shade.vlt });
      toast.success(`${pick.film.brand} ${pick.film.name} ${pick.shade.vlt}% set on ${project?.number}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  const vizHref = pick ? `/visualizer?body=${bodyType}&film=${pick.film._id}&shade=${pick.shade.vlt}${projectId ? `&project=${projectId}` : ''}` : '/visualizer';

  return (
    <div>
      <PageHeader icon={Sparkles} eyebrow="AI Studio" title="Smart Film Advisor" subtitle="Tell it the glass and the goals — it picks the most compatible film, legal shade, roll size, cut plan and price." />

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Inputs */}
        <div className="space-y-4">
          <Card className="p-4">
            <Tabs
              value={segment}
              onChange={(v) => { setSegment(v); setProjectId(''); }}
              layoutId="adv-seg"
              tabs={[
                { key: 'automotive', label: 'Automotive', icon: CarFront },
                { key: 'residential', label: 'Residential', icon: Home },
                { key: 'commercial', label: 'Commercial', icon: Building2 },
              ]}
            />
            <Field label="Use a project's measurements" className="mt-4" hint={project ? `${project.totals?.panes || 0} panes · ${project.totals?.measuredM2 || 0} m² measured` : 'Optional — uses the saved measurement sheet'}>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project — enter details below</option>
                {(projects || []).filter((p) => p.segment === segment).map((p) => (
                  <option key={p._id} value={p._id}>{p.number} · {p.title}</option>
                ))}
              </Select>
            </Field>
          </Card>

          {segment === 'automotive' ? (
            <Card className="space-y-4 p-4">
              <div>
                <p className="label">Body style</p>
                <div className="grid grid-cols-2 gap-2">
                  {(meta?.bodyTypes || []).map((b) => (
                    <button key={b.key} type="button" onClick={() => setBodyType(b.key)} className={cn('rounded-xl border p-2.5 text-left transition', bodyType === b.key ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-line hover:border-primary/40')}>
                      <p className="text-sm font-semibold">{b.label}</p>
                      <p className="line-clamp-1 text-[10px] text-muted-fg">{b.panes.length} panes · {b.examples}</p>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Legal region">
                <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {(meta?.legalRules || []).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                </Select>
              </Field>
              <div className="space-y-2.5 rounded-xl bg-muted/50 p-3">
                <Switch checked={privacyRear} onChange={setPrivacyRear} label="Factory privacy rear glass" />
                <Switch checked={includeVisor} onChange={setIncludeVisor} label="Add windscreen visor strip" />
                <Switch checked={includeSunroof} onChange={setIncludeSunroof} label="Add sunroof" />
                <Switch checked={signalSafe} onChange={setSignalSafe} label="Must be signal-safe (no metal)" />
                <Switch checked={removal} onChange={setRemoval} label="Old film removal needed" />
              </div>
            </Card>
          ) : (
            <Card className="space-y-4 p-4">
              {!projectId ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="label mb-0">Glass panes</p>
                    <Button size="xs" variant="ghost" icon={Plus} onClick={() => setPanes((p) => [...p, { id: uid(), label: `Window ${p.length + 1}`, width: '', height: '', unit: 'mm', qty: 1 }])}>Add pane</Button>
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {panes.map((p) => (
                        <motion.div key={p.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-[1fr_auto] gap-1.5 rounded-xl border border-line p-2">
                          <Input value={p.label} onChange={(e) => setPanes((ps) => ps.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))} placeholder="Label" className="h-8 text-xs" />
                          <button type="button" aria-label="Remove pane" onClick={() => setPanes((ps) => ps.filter((x) => x.id !== p.id))} className="rounded-lg px-2 text-muted-fg hover:bg-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                          <div className="col-span-2 grid grid-cols-4 gap-1.5">
                            <Input type="number" min={0} value={p.width} onChange={(e) => setPanes((ps) => ps.map((x) => (x.id === p.id ? { ...x, width: e.target.value === '' ? '' : Number(e.target.value) } : x)))} placeholder="Width" className="h-8 text-xs" aria-label="Width" />
                            <Input type="number" min={0} value={p.height} onChange={(e) => setPanes((ps) => ps.map((x) => (x.id === p.id ? { ...x, height: e.target.value === '' ? '' : Number(e.target.value) } : x)))} placeholder="Height" className="h-8 text-xs" aria-label="Height" />
                            <Select value={p.unit} onChange={(e) => setPanes((ps) => ps.map((x) => (x.id === p.id ? { ...x, unit: e.target.value } : x)))} className="h-8 text-xs" aria-label="Unit">
                              {(meta?.units || ['mm', 'cm', 'm', 'in']).map((u) => <option key={u}>{u}</option>)}
                            </Select>
                            <Input type="number" min={1} value={p.qty} onChange={(e) => setPanes((ps) => ps.map((x) => (x.id === p.id ? { ...x, qty: e.target.value === '' ? '' : Number(e.target.value) } : x)))} placeholder="Qty" className="h-8 text-xs" aria-label="Quantity" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : null}
              <Field label="Glass type">
                <Select value={glassType} onChange={(e) => setGlassType(e.target.value)}>
                  {(meta?.glassTypes || []).map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                <div>
                  <p className="label">Facing</p>
                  <div className="relative h-28 w-28 rounded-full border border-line bg-muted/40">
                    {ORIENTS.map((o, i) => {
                      const a = (i * Math.PI) / 4 - Math.PI / 2;
                      return (
                        <button key={o} type="button" onClick={() => setOrientation(o)} className={cn('absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold transition', orientation === o ? 'bg-primary text-white shadow-glow' : 'bg-card text-muted-fg hover:text-fg')} style={{ left: `${50 + Math.cos(a) * 38}%`, top: `${50 + Math.sin(a) * 38}%` }}>
                          {o}
                        </button>
                      );
                    })}
                    <SunMedium className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-accent" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Field label="Climate">
                    <Select value={climate} onChange={(e) => setClimate(e.target.value as typeof climate)}>
                      <option value="hot">Hot (Perth, Darwin)</option>
                      <option value="warm">Warm</option>
                      <option value="temperate">Temperate</option>
                      <option value="cold">Cold</option>
                    </Select>
                  </Field>
                  <Switch checked={shading} onChange={setShading} label="Partial shading" size="sm" />
                  <Switch checked={removal} onChange={setRemoval} label="Old film removal" size="sm" />
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <p className="label">What matters most?</p>
            <div className="space-y-3">
              {GOALS.map((g) => (
                <div key={g.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold"><g.icon className="h-4 w-4 text-primary" /> {g.label}</span>
                    <span className="text-xs text-muted-fg">{['Off', 'Low', 'Some', 'Medium', 'High', 'Top'][goals[g.key]]}</span>
                  </div>
                  <input type="range" min={0} max={5} step={1} value={goals[g.key]} onChange={(e) => setGoals((x) => ({ ...x, [g.key]: Number(e.target.value) }))} className="w-full accent-[hsl(var(--primary))]" aria-label={g.label} title={g.hint} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Results */}
        <div className="min-w-0 space-y-4">
          {error ? <Card className="border-danger/30 bg-danger/5 p-4 text-sm font-medium text-danger">{error}</Card> : null}
          {!result && loading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : null}
          {!result && !loading && !error ? <Card><EmptyState icon={Ruler} title="Add some glass to analyse" description="Enter pane sizes or choose a project with a saved measurement sheet." /></Card> : null}

          {result && pick ? (
            <motion.div key={`${pick.film._id}-${sel}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
              {/* Hero */}
              <Card className="relative overflow-hidden p-5">
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary/25 to-fuchsia-500/10 blur-3xl" />
                <div className="relative flex flex-wrap items-start gap-5">
                  <ScoreRing score={pick.score} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary">{sel === 0 ? 'Best match' : `Option #${sel + 1}`}</Badge>
                      <Badge>{pick.film.category.replace('_', ' ')}</Badge>
                      {pick.film.signalSafe ? <Badge tone="success">Signal-safe</Badge> : <Badge tone="warning">Metallised</Badge>}
                      <Badge tone={pick.stock.enough ? 'success' : 'danger'}><Package className="h-3 w-3" /> {pick.stock.enough ? `${pick.stock.availableM2} m² in stock` : `Low stock (${pick.stock.availableM2} m²)`}</Badge>
                    </div>
                    <h2 className="mt-2 flex items-center gap-2 font-display text-2xl font-extrabold">
                      <span className="h-5 w-5 rounded-md border border-line" style={{ background: pick.film.tintColor }} />
                      {pick.film.brand} {pick.film.name} <span className="text-primary">{pick.shade.vlt}%</span>
                    </h2>
                    <div className="mt-3 grid gap-1.5">
                      {pick.reasons.map((r, i) => (
                        <motion.p key={r} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {r}</motion.p>
                      ))}
                      {pick.warnings.map((w) => (
                        <p key={w} className="flex items-start gap-2 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}</p>
                      ))}
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
                    <Button icon={Wand2} onClick={() => router.push(vizHref)}>Open in 3D</Button>
                    {projectId ? <Button variant="outline" icon={CheckCircle2} onClick={applyToProject} loading={applying}>Apply to {project?.number}</Button> : null}
                  </div>
                </div>
                {segment === 'automotive' && Object.keys(pick.zoneShades).length ? (
                  <div className="relative mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    {Object.entries(pick.zoneShades).map(([z, v]) => (
                      <span key={z} className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-semibold">
                        <span className="h-3 w-3 rounded" style={{ background: pick.film.tintColor, opacity: v == null ? 0.15 : Math.max(0.25, 1 - v / 100) }} />
                        {ZONE_LABEL[z] || z}: <span className="text-primary">{v == null ? 'leave clear' : `${v}%`}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="relative mt-4 rounded-xl bg-gradient-to-r from-primary/10 to-fuchsia-500/5 p-3 text-sm leading-relaxed">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary"><Sparkles className="h-3.5 w-3.5" /> Advisor summary</p>
                  {result.summary}
                </div>
              </Card>

              {/* Performance + pricing */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-4">
                  <p className="mb-3 font-display font-bold">Performance</p>
                  {[
                    { l: 'Visible light (VLT)', v: pick.perf.vlt, tone: 'info' as const },
                    { l: 'Total solar energy rejected', v: pick.perf.tser, tone: 'warning' as const },
                    { l: 'Infrared rejected', v: pick.perf.irr, tone: 'danger' as const },
                    { l: 'UV blocked', v: pick.perf.uvr, tone: 'primary' as const },
                    { l: 'Glare reduction', v: pick.perf.glare, tone: 'success' as const },
                  ].map((m) => (
                    <div key={m.l} className="mb-2.5">
                      <div className="mb-1 flex justify-between text-xs"><span className="text-muted-fg">{m.l}</span><b>{m.v}%</b></div>
                      <Progress value={m.v} tone={m.tone} height={6} />
                    </div>
                  ))}
                  {segment !== 'automotive' ? (
                    <div className={cn('mt-3 rounded-xl p-3 text-xs', pick.thermal.level === 'high' ? 'bg-danger/10' : pick.thermal.level === 'medium' ? 'bg-warning/10' : 'bg-success/10')}>
                      <p className="flex items-center gap-1.5 font-bold"><Thermometer className="h-4 w-4" /> Thermal stress risk: <span className="uppercase">{pick.thermal.level}</span></p>
                      <div className="my-2 flex gap-1">
                        {[0, 1, 2].map((i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= ['low', 'medium', 'high'].indexOf(pick.thermal.level) ? (pick.thermal.level === 'high' ? 'bg-danger' : pick.thermal.level === 'medium' ? 'bg-warning' : 'bg-success') : 'bg-muted')} />)}
                      </div>
                      <ul className="list-disc space-y-0.5 pl-4 text-muted-fg">{pick.thermal.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                    </div>
                  ) : null}
                </Card>
                <Card className="p-4">
                  <p className="mb-3 font-display font-bold">Price & margin</p>
                  <p className="font-display text-3xl font-extrabold">{money(pick.pricing.sell)}</p>
                  <p className="text-xs text-muted-fg">suggested sell price (ex. tax) · {pick.pricing.glassM2} m² glass</p>
                  <div className="mt-4 flex h-3 overflow-hidden rounded-full">
                    {[
                      { v: pick.pricing.costMaterial, c: 'bg-amber-500', l: 'Material' },
                      { v: pick.pricing.costLabour, c: 'bg-sky-500', l: 'Labour' },
                      { v: Math.max(0, pick.pricing.margin), c: 'bg-emerald-500', l: 'Margin' },
                    ].map((s) => <motion.span key={s.l} className={s.c} initial={{ width: 0 }} animate={{ width: `${(s.v / Math.max(1, pick.pricing.sell)) * 100}%` }} transition={{ duration: 0.8 }} title={s.l} />)}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><span className="flex items-center gap-1 text-muted-fg"><span className="h-2 w-2 rounded-full bg-amber-500" />Film</span><b className="text-sm">{money(pick.pricing.costMaterial)}</b><p className="text-muted-fg">{pick.pricing.materialM2} m²</p></div>
                    <div><span className="flex items-center gap-1 text-muted-fg"><span className="h-2 w-2 rounded-full bg-sky-500" />Labour</span><b className="text-sm">{money(pick.pricing.costLabour)}</b><p className="text-muted-fg">{pick.pricing.labourHours} h</p></div>
                    <div><span className="flex items-center gap-1 text-muted-fg"><span className="h-2 w-2 rounded-full bg-emerald-500" />Margin</span><b className="text-sm">{money(pick.pricing.margin)}</b><p className="text-muted-fg">{pick.pricing.marginPct}%</p></div>
                  </div>
                  {result.savings && sel === 0 ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {segment === 'automotive' ? (
                        <>
                          <div className="rounded-xl bg-muted p-3"><p className="flex items-center gap-1 text-[11px] text-muted-fg"><Thermometer className="h-3.5 w-3.5" />Cabin cooler</p><p className="font-display text-xl font-extrabold">~{result.savings.cabinTempDropC}°C</p></div>
                          <div className="rounded-xl bg-muted p-3"><p className="flex items-center gap-1 text-[11px] text-muted-fg"><Zap className="h-3.5 w-3.5" />Heat blocked</p><p className="font-display text-xl font-extrabold">{(result.savings.heatBlockedW / 1000).toFixed(1)} kW</p></div>
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl bg-muted p-3"><p className="flex items-center gap-1 text-[11px] text-muted-fg"><Zap className="h-3.5 w-3.5" />Cooling saved / yr</p><p className="font-display text-xl font-extrabold">{result.savings.kwhYear} kWh</p><p className="text-xs text-muted-fg">{money(result.savings.dollarsYear, { cents: false })} per year</p></div>
                          <div className="rounded-xl bg-muted p-3"><p className="flex items-center gap-1 text-[11px] text-muted-fg"><Leaf className="h-3.5 w-3.5" />CO₂ avoided / yr</p><p className="font-display text-xl font-extrabold">{result.savings.co2KgYear} kg</p><p className="text-xs text-muted-fg">Payback {result.savings.paybackYears ?? '—'} yrs</p></div>
                        </>
                      )}
                    </div>
                  ) : null}
                </Card>
              </div>

              {pick.compliance.length ? (
                <Card>
                  <CardHeader title="Legal compliance" subtitle={result.legal?.name} icon={ShieldCheck} />
                  <div className="overflow-x-auto">
                    <table className="table-base">
                      <thead><tr><th>Zone</th><th>Film</th><th>Combined VLT</th><th>Minimum</th><th>Status</th></tr></thead>
                      <tbody>
                        {pick.compliance.map((c) => (
                          <tr key={c.zone}>
                            <td className="font-semibold">{c.label}</td>
                            <td>{c.filmVlt == null ? '—' : `${c.filmVlt}%`}</td>
                            <td>{c.combined}%</td>
                            <td>{c.min}%</td>
                            <td><Badge tone={c.ok ? 'success' : 'danger'} dot>{c.message}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}

              {pick.cut ? (
                <Card className="p-4">
                  <p className="mb-1 font-display font-bold">Cut plan</p>
                  <p className="mb-3 text-xs text-muted-fg">Every pane (+ trim) packed onto the roll width that wastes the least film.</p>
                  <CutPlanDiagram plan={pick.cut} />
                </Card>
              ) : null}

              {sel === 0 && result.panes.length ? (
                <Card>
                  <CardHeader title="Per-pane sizing" subtitle={`${result.totals.panes} panes · ${result.totals.glassM2} m² of glass`} icon={Ruler} />
                  <div className="overflow-x-auto">
                    <table className="table-base">
                      <thead><tr><th>Pane</th><th>Size (mm)</th><th>Qty</th><th>Area</th>{segment === 'automotive' ? <><th>Legal min</th><th>Shade</th></> : null}<th>Cut size</th><th>Roll</th></tr></thead>
                      <tbody>
                        {result.panes.map((p, i) => (
                          <tr key={`${p.label}-${i}`}>
                            <td><p className="font-semibold">{p.label}</p>{segment === 'automotive' ? <p className="text-xs text-muted-fg">{p.zoneLabel}</p> : null}</td>
                            <td>{p.widthMm} × {p.heightMm}</td>
                            <td>{p.qty}</td>
                            <td>{p.areaM2} m²</td>
                            {segment === 'automotive' ? <><td>{p.legalMinVlt ?? '—'}%</td><td className="font-semibold text-primary">{p.recommendedVlt == null ? 'clear' : `${p.recommendedVlt}%`}</td></> : null}
                            <td className="font-mono text-xs">{p.cutSize}</td>
                            <td>{p.fits ? <Badge tone="success">{p.rollWidth} mm</Badge> : <Badge tone="warning">{p.drops}× {p.rollWidth} mm</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}

              <Card>
                <CardHeader title="All compatible films" subtitle="Ranked for your goals — click to compare" icon={Sparkles} />
                <div className="divide-y divide-line">
                  {result.ranked.map((r, i) => (
                    <button key={r.film._id} type="button" onClick={() => setSel(i)} className={cn('flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-muted/50', sel === i && 'bg-primary/5')}>
                      <span className="w-6 text-center font-display text-sm font-bold text-muted-fg">{i + 1}</span>
                      <span className="h-8 w-8 shrink-0 rounded-lg border border-line" style={{ background: r.film.tintColor }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{r.film.brand} {r.film.name} · {r.shade.vlt}%</p>
                        <div className="mt-1 flex items-center gap-2"><Progress value={r.score} height={6} tone={i === 0 ? 'success' : 'primary'} className="max-w-[200px]" /><span className="text-xs font-semibold">{r.score}</span></div>
                      </div>
                      <div className="hidden text-right text-xs sm:block">
                        <p className="font-semibold">{money(r.pricing.sell, { cents: false })}</p>
                        <p className="text-muted-fg">{r.perf.tser}% TSER · {r.warnings.length ? `${r.warnings.length} warning${r.warnings.length > 1 ? 's' : ''}` : 'no warnings'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : null}
          {result && !pick && !loading ? <Card><EmptyState icon={AlertTriangle} title="No compatible film" description={result.summary} /></Card> : null}
        </div>
      </div>
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
      <Advisor />
    </Suspense>
  );
}
