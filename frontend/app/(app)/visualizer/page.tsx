'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import type * as THREE from 'three';
import {
  Camera, CarFront, Check, CircleSlash, Download, Eye, FolderOpen, Gauge, ImageUp, Link2, Moon, Paintbrush, RotateCw, Save, ShieldAlert, ShieldCheck, Sparkles, Sun, Sunset, Trash2, Wand2, Warehouse,
} from 'lucide-react';
import { api, errorMessage, mediaUrl, uploadFile } from '@/lib/api';
import { useApi, useFilms, useMeta, useSettings } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import type { Film, Project } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, cn, useConfirm } from '@/components/ui';
import { PhotoLab, type PhotoResult } from '@/components/studio/photo-lab';
import {
  DEFAULT_CONFIG, PAINTS, TINT_ZONES, WHEEL_COLORS, closestShade, combinedVlt, compliance, darkestLegal, glassLook, heatRejection, zoneMin,
  type CameraKey, type CarConfig, type EnvKey, type Finish, type TintZone, type WheelColor,
} from '@/components/studio/tint';

const StudioCanvas = dynamic(() => import('@/components/studio/studio-canvas'), {
  ssr: false,
  loading: () => (
    <div className="relative h-full w-full overflow-hidden">
      <Skeleton className="h-full w-full rounded-none" />
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-muted-fg">Preparing 3D studio…</div>
    </div>
  ),
});

type Design = { _id: string; name: string; projectId?: string; config: CarConfig & { env?: EnvKey }; snapshotFileId?: string; photoFileId?: string; ai?: any; updatedAt: string };

const CAMERAS: { key: CameraKey; label: string }[] = [
  { key: 'front', label: 'Front ¾' },
  { key: 'side', label: 'Side' },
  { key: 'rear', label: 'Rear' },
  { key: 'top', label: 'Top' },
  { key: 'inside', label: 'Inside' },
];
const ENVS: { key: EnvKey; label: string; icon: any }[] = [
  { key: 'day', label: 'Day', icon: Sun },
  { key: 'sunset', label: 'Sunset', icon: Sunset },
  { key: 'night', label: 'Night', icon: Moon },
  { key: 'studio', label: 'Studio', icon: Warehouse },
];
const FINISHES: Finish[] = ['gloss', 'metallic', 'pearl', 'matte'];
const PRESETS = [
  { k: 'clear', l: 'Factory clear' },
  { k: 'legal', l: 'Legal max' },
  { k: 'privacy', l: 'Privacy' },
  { k: 'heat', l: 'Heat shield 70' },
  { k: 'limo', l: 'Limo 5%' },
] as const;
type PresetKey = (typeof PRESETS)[number]['k'];

function dataUrlToBlob(dataUrl: string) {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Film over every non-sunroof zone at the darkest legal shade (or the preferred shade if lighter). */
function applyFilmToZones(c: CarConfig, f: Film, rule: Parameters<typeof darkestLegal>[2], preferred?: number | null): CarConfig {
  const zones = { ...c.zones };
  for (const z of TINT_ZONES) {
    if (z.key === 'sunroof') continue;
    const legal = darkestLegal(f, z.key, rule, c.privacyRear);
    const want = preferred ? closestShade(f, preferred) : legal;
    zones[z.key] = { filmId: f._id, vlt: legal !== null && want !== null ? Math.max(legal, want) : (want ?? legal) };
  }
  return { ...c, zones };
}

function Visualizer() {
  const params = useSearchParams();
  const confirm = useConfirm();
  const { data: meta } = useMeta();
  const { data: settings } = useSettings();
  const { data: allFilms } = useFilms();
  const { data: aiStatus } = useApi<{ vision: boolean; model3d: boolean }>('/ai/vehicle');
  const { data: designs, mutate: mutateDesigns } = useApi<Design[]>('/designs');
  const { data: projects } = useApi<Project[]>('/projects?segment=automotive&limit=300');

  const films = useMemo(() => (allFilms || []).filter((f) => f.active !== false && f.segments.includes('automotive')), [allFilms]);
  const [cfg, setCfg] = useState<CarConfig>(DEFAULT_CONFIG);
  const [env, setEnv] = useState<EnvKey>('day');
  const [camera, setCamera] = useState<CameraKey>('front');
  const [nonce, setNonce] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<'vehicle' | 'tint' | 'photo' | 'designs'>('tint');
  const [designId, setDesignId] = useState<string | null>(null);
  const [designName, setDesignName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [saving, setSaving] = useState(false);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const initDone = useRef(false);

  const rule = useMemo(() => meta?.legalRules.find((r) => r.code === cfg.region) || meta?.legalRules[0], [meta, cfg.region]);
  const checks = useMemo(() => compliance(cfg, rule), [cfg, rule]);
  const allLegal = checks.every((c) => c.ok);
  const filmById = useCallback((id: string | null) => films.find((f) => f._id === id), [films]);
  const update = (patch: Partial<CarConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const setZone = (zone: TintZone, filmId: string | null, vlt: number | null) => {
    setActivePreset(null);
    setCfg((c) => ({ ...c, zones: { ...c.zones, [zone]: { filmId, vlt } } }));
  };
  const go = (k: CameraKey) => {
    setCamera(k);
    setNonce((n) => n + 1);
  };

  const applyDesign = useCallback((d: Design) => {
    const { env: e, ...rest } = (d.config || {}) as CarConfig & { env?: EnvKey };
    setCfg({ ...DEFAULT_CONFIG, ...rest, zones: { ...DEFAULT_CONFIG.zones, ...(rest?.zones || {}) }, visor: { ...DEFAULT_CONFIG.visor, ...(rest?.visor || {}) } });
    if (e) setEnv(e);
    setDesignId(d._id);
    setDesignName(d.name);
    setProjectId(d.projectId ? String(d.projectId) : '');
    setScannedUrl(null);
  }, []);

  /* ---------- initial state from query / settings ---------- */
  useEffect(() => {
    if (initDone.current || !meta || !settings || !allFilms) return;
    initDone.current = true;
    const region = settings.region || 'AU-WA';
    const regionRule = meta.legalRules.find((x) => x.code === region);
    setCfg((c) => ({ ...c, region }));
    const body = params.get('body');
    const film = params.get('film');
    const shade = Number(params.get('shade')) || null;
    if (body && meta.bodyTypes.some((b) => b.key === body)) setCfg((c) => ({ ...c, bodyType: body }));
    if (film) {
      const f = allFilms.find((x) => x._id === film);
      if (f) setCfg((c) => applyFilmToZones(c, f, regionRule, shade));
    }
    const dId = params.get('design');
    const pId = params.get('project');
    (async () => {
      try {
        if (dId) {
          applyDesign(await api.get<Design>(`/designs/${dId}`));
          return;
        }
        if (pId) {
          const p = await api.get<Project>(`/projects/${pId}`);
          setProjectId(p._id);
          setDesignName(`${p.number} · ${[p.vehicle?.make, p.vehicle?.model].filter(Boolean).join(' ') || p.title}`);
          if (p.designId) {
            applyDesign(await api.get<Design>(`/designs/${p.designId}`));
            return;
          }
          const paint = PAINTS.find((x) => x.name.toLowerCase() === String(p.vehicle?.color || '').toLowerCase())?.hex;
          setCfg((c) => ({ ...c, ...(p.vehicle?.bodyType ? { bodyType: p.vehicle.bodyType } : {}), ...(paint ? { paint } : {}) }));
          const f = p.filmId ? allFilms.find((x) => x._id === p.filmId) : undefined;
          if (f) setCfg((c) => applyFilmToZones(c, f, regionRule, p.filmShade ?? null));
        }
      } catch (err) {
        toast.error(errorMessage(err));
      }
    })();
  }, [meta, settings, allFilms, params, applyDesign]);

  /* ---------- presets ---------- */
  const pickFilm = (pred: (f: Film) => boolean) => [...films].filter(pred).sort((a, b) => (b.tier || 0) - (a.tier || 0))[0] || films[0];
  const preset = (key: PresetKey) => {
    if (!films.length) {
      toast.error('Add automotive films in the Film Library first');
      return;
    }
    setActivePreset(key);
    setCfg((c) => {
      const zones = { ...c.zones };
      for (const z of TINT_ZONES) {
        if (key === 'clear') {
          zones[z.key] = { filmId: null, vlt: null };
          continue;
        }
        if (key === 'heat') {
          const f = pickFilm((x) => x.shades.some((s) => s.vlt >= 70) && x.irr >= 90);
          zones[z.key] = { filmId: f._id, vlt: closestShade(f, 70) };
          continue;
        }
        if (key === 'limo') {
          const f = pickFilm((x) => x.category === 'ceramic' || x.category === 'carbon');
          zones[z.key] = { filmId: f._id, vlt: [...f.shades].sort((a, b) => a.vlt - b.vlt)[0]?.vlt ?? null };
          continue;
        }
        const f = pickFilm((x) => x.category === 'ceramic');
        const legal = darkestLegal(f, z.key, rule, c.privacyRear);
        const darkest = [...f.shades].sort((a, b) => a.vlt - b.vlt)[0]?.vlt ?? null;
        zones[z.key] = { filmId: f._id, vlt: key === 'privacy' && z.key !== 'frontSides' ? darkest : (legal ?? null) };
      }
      return { ...c, zones, visor: key === 'clear' ? { ...c.visor, enabled: false } : c.visor };
    });
    toast.success({ clear: 'Factory clear glass', legal: 'Darkest legal ceramic package', privacy: 'Privacy package', heat: 'Clear heat-shield ceramic', limo: 'Limo 5% everywhere' }[key]);
  };

  /* ---------- photo → 3D ---------- */
  const onPhoto = useCallback(
    (r: PhotoResult) => {
      setPhoto(r);
      setScannedUrl(null);
      setCfg((c) => {
        const next: CarConfig = { ...c, paint: r.ai?.paintColorHex || r.analysis.dominant };
        const ai = r.ai;
        if (ai?.isVehicle) {
          if (meta?.bodyTypes.some((b) => b.key === ai.bodyType)) next.bodyType = ai.bodyType;
          if (FINISHES.includes(ai.finish)) next.finish = ai.finish;
          if (WHEEL_COLORS[ai.wheelColor]) next.wheelColor = ai.wheelColor;
          next.privacyRear = !!ai.existingTint?.factoryPrivacyRear;
        }
        return next;
      });
      if (r.ai?.isVehicle) {
        const ai = r.ai;
        setDesignName((n) => n || `${ai.make} ${ai.model}`);
        setAutoRotate(true);
        setCamera('front');
        setNonce((n) => n + 1);
      }
    },
    [meta],
  );

  /* ---------- snapshot / save ---------- */
  const snapshot = () => {
    const gl = glRef.current;
    if (!gl) return null;
    try {
      return gl.domElement.toDataURL('image/png');
    } catch {
      return null;
    }
  };
  const downloadSnap = () => {
    const url = snapshot();
    if (!url) {
      toast.error('The 3D view is not ready yet');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(designName || 'totalops-design').replace(/[^\w-]+/g, '-')}.png`;
    a.click();
  };
  const save = async () => {
    const name = designName.trim();
    if (!name) {
      toast.error('Give the design a name first');
      setTab('designs');
      return;
    }
    setSaving(true);
    try {
      const url = snapshot();
      let snapshotFileId: string | undefined;
      if (url) snapshotFileId = (await uploadFile(dataUrlToBlob(url), { category: 'photo', name: `${name}.png`, projectId: projectId || undefined }))._id;
      const body = { name, projectId: projectId || null, config: { ...cfg, env }, snapshotFileId, photoFileId: photo?.fileId, ai: photo?.ai || null };
      const saved = designId ? await api.patch<Design>(`/designs/${designId}`, body) : await api.post<Design>('/designs', body);
      setDesignId(saved._id);
      if (projectId) await api.patch(`/projects/${projectId}`, { designId: saved._id });
      mutateDesigns();
      toast.success(projectId ? 'Design saved and attached to the project' : 'Design saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const removeDesign = async (d: Design) => {
    if (!(await confirm({ title: `Delete “${d.name}”?`, description: 'The design is removed. Snapshots already saved stay in Files.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/designs/${d._id}`);
      if (designId === d._id) setDesignId(null);
      mutateDesigns();
      toast.success('Design deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const tser = heatRejection(cfg, films);
  const inside = camera === 'inside' && !scannedUrl;

  return (
    <div>
      <PageHeader
        icon={Wand2}
        eyebrow="AI Studio"
        title="3D Tint Visualizer"
        subtitle="Show customers exactly how their car will look — every window, every shade, legal in their state."
        actions={
          <>
            <Button variant="outline" icon={Download} onClick={downloadSnap}>
              Snapshot
            </Button>
            <Button icon={Save} onClick={save} loading={saving}>
              {designId ? 'Update design' : 'Save design'}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Viewer */}
        <div className="min-w-0 space-y-4">
          <Card className="relative overflow-hidden p-0">
            <div className="relative h-[52vh] min-h-[380px] w-full lg:h-[62vh]">
              <StudioCanvas cfg={cfg} films={films} rule={rule} env={env} camera={camera} cameraNonce={nonce} autoRotate={autoRotate} scannedUrl={scannedUrl} onGl={(gl) => { glRef.current = gl; }} />

              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="pointer-events-auto flex flex-wrap gap-1 rounded-xl bg-black/45 p-1 backdrop-blur">
                  {CAMERAS.map((c) => (
                    <button key={c.key} type="button" onClick={() => go(c.key)} className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold transition', camera === c.key ? 'bg-white text-slate-900' : 'text-white/85 hover:bg-white/15')}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <motion.div layout className={cn('pointer-events-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur', allLegal ? 'bg-emerald-600/90' : 'bg-red-600/90')}>
                  {allLegal ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                  {allLegal ? `Legal in ${rule?.code || ''}` : `Not legal in ${rule?.code || ''}`}
                </motion.div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
                <div className="pointer-events-auto flex gap-1 rounded-xl bg-black/45 p-1 backdrop-blur">
                  {ENVS.map((e) => (
                    <button key={e.key} type="button" title={e.label} onClick={() => setEnv(e.key)} className={cn('flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition', env === e.key ? 'bg-white text-slate-900' : 'text-white/85 hover:bg-white/15')}>
                      <e.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{e.label}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setAutoRotate((a) => !a)} className={cn('flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition', autoRotate ? 'bg-white text-slate-900' : 'text-white/85 hover:bg-white/15')}>
                    <RotateCw className={cn('h-3.5 w-3.5', autoRotate && 'animate-spin [animation-duration:3s]')} /> <span className="hidden sm:inline">Rotate</span>
                  </button>
                </div>
                {scannedUrl ? <span className="pointer-events-auto rounded-lg bg-fuchsia-600/90 px-2.5 py-1 text-xs font-bold text-white">Scanned 3D mesh</span> : null}
              </div>

              <AnimatePresence>
                {inside ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute bottom-14 left-1/2 w-[min(560px,92%)] -translate-x-1/2 rounded-2xl bg-black/55 p-3 text-white backdrop-blur">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70">
                      <Eye className="h-3.5 w-3.5" /> View out from the driver&apos;s seat
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['frontSides', 'rearSides', 'rearWindscreen'] as TintZone[]).map((z) => {
                        const comb = combinedVlt(z, cfg.zones[z].vlt, cfg.privacyRear);
                        const look = glassLook(comb, filmById(cfg.zones[z].filmId));
                        return (
                          <div key={z} className="overflow-hidden rounded-lg">
                            <div className="relative h-16" style={{ background: 'linear-gradient(#7fb6ec 0%, #cfe6fa 55%, #6b7a60 56%, #4d5a45 100%)' }}>
                              <div className="absolute inset-0 transition-all duration-500" style={{ background: look.color, opacity: look.opacity }} />
                              <span className="absolute bottom-1 right-1.5 text-[10px] font-bold">{comb}%</span>
                            </div>
                            <p className="bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold">{TINT_ZONES.find((x) => x.key === z)?.short}</p>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Avg. solar heat rejected</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{tser}%</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500" animate={{ width: `${tser}%` }} />
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Parked cabin (est.)</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{tser ? `−${Math.round(tser * 0.17)}°C` : '—'}</p>
              <p className="mt-1 text-xs text-muted-fg">cooler in direct sun vs untinted</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Region rule</p>
              <p className="mt-1 truncate font-display text-base font-extrabold">{rule?.name || '—'}</p>
              <p className="mt-1 text-xs text-muted-fg">
                Front ≥ {rule?.frontSideMin}% · Rear ≥ {rule?.rearSideMin}% · {rule?.windscreen}
              </p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display font-bold">Legal compliance</p>
              <Select value={cfg.region} onChange={(e) => update({ region: e.target.value })} className="h-8 w-60 text-xs" aria-label="Legal region">
                {(meta?.legalRules || []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {checks.map((c) => (
                <motion.div layout key={c.zone} className={cn('rounded-xl border p-3', c.ok ? 'border-success/30 bg-success/5' : 'border-danger/40 bg-danger/5')}>
                  <p className="flex items-center justify-between text-xs font-semibold">
                    {c.label}
                    {c.ok ? <Check className="h-4 w-4 text-success" /> : <CircleSlash className="h-4 w-4 text-danger" />}
                  </p>
                  <p className="mt-1 font-display text-xl font-extrabold">{c.combined}%</p>
                  <p className={cn('text-[11px]', c.ok ? 'text-muted-fg' : 'font-semibold text-danger')}>{c.note}</p>
                </motion.div>
              ))}
            </div>
            {rule ? (
              <p className="mt-3 text-xs text-muted-fg">
                {rule.notes} Combined VLT = film × factory glass ({cfg.privacyRear ? 'privacy rear 25%' : 'clear 85%'}). Measurement tolerance {rule.tolerance}%. Always confirm with your local authority.
              </p>
            ) : null}
          </Card>
        </div>

        {/* Control panel */}
        <Card className="h-fit p-4 xl:sticky xl:top-20">
          <Tabs
            value={tab}
            onChange={setTab}
            layoutId="viz-tabs"
            className="mb-4"
            tabs={[
              { key: 'tint', label: 'Tint', icon: Sparkles },
              { key: 'vehicle', label: 'Vehicle', icon: Paintbrush },
              { key: 'photo', label: 'Photo AI', icon: ImageUp },
              { key: 'designs', label: 'Designs', icon: FolderOpen, count: designs?.length },
            ]}
          />

          {tab === 'vehicle' ? (
            <div className="space-y-5">
              <div>
                <p className="label">Body style</p>
                <div className="grid grid-cols-2 gap-2">
                  {(meta?.bodyTypes || []).map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => {
                        update({ bodyType: b.key });
                        setScannedUrl(null);
                      }}
                      className={cn('rounded-xl border p-2.5 text-left transition', cfg.bodyType === b.key ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-line hover:border-primary/40')}
                    >
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <CarFront className="h-4 w-4 text-primary" /> {b.label}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-fg">{b.examples}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="label">Paint</p>
                <div className="flex flex-wrap gap-2">
                  {PAINTS.map((p) => (
                    <button key={p.hex} type="button" title={p.name} aria-label={p.name} onClick={() => update({ paint: p.hex })} className={cn('h-8 w-8 rounded-full border-2 shadow-sm transition hover:scale-110', cfg.paint.toLowerCase() === p.hex ? 'border-primary ring-2 ring-primary/30' : 'border-white dark:border-line')} style={{ background: p.hex }} />
                  ))}
                  <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-line" title="Custom colour">
                    <input type="color" value={cfg.paint} onChange={(e) => update({ paint: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Custom paint colour" />
                    <span className="block h-full w-full" style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} />
                  </label>
                </div>
              </div>
              <Field label="Finish">
                <div className="grid grid-cols-4 gap-1.5">
                  {FINISHES.map((f) => (
                    <button key={f} type="button" onClick={() => update({ finish: f })} className={cn('rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize', cfg.finish === f ? 'border-primary bg-primary/10 text-primary' : 'border-line hover:bg-muted')}>
                      {f}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Roof & pillars">
                  <Select value={cfg.roof} onChange={(e) => update({ roof: e.target.value as CarConfig['roof'] })}>
                    <option value="body">Body colour</option>
                    <option value="black">Gloss black</option>
                  </Select>
                </Field>
                <Field label="Wheel size">
                  <Select value={cfg.wheelSize} onChange={(e) => update({ wheelSize: Number(e.target.value) as CarConfig['wheelSize'] })}>
                    <option value={17}>17&quot;</option>
                    <option value={19}>19&quot;</option>
                    <option value={21}>21&quot;</option>
                  </Select>
                </Field>
              </div>
              <div>
                <p className="label">Wheel finish</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(WHEEL_COLORS) as WheelColor[]).map((w) => (
                    <button key={w} type="button" onClick={() => update({ wheelColor: w })} className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold', cfg.wheelColor === w ? 'border-primary bg-primary/10' : 'border-line hover:bg-muted')}>
                      <span className="h-3 w-3 rounded-full border border-line" style={{ background: WHEEL_COLORS[w].hex }} /> {WHEEL_COLORS[w].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5 rounded-xl bg-muted/50 p-3">
                <Switch checked={cfg.chromeDelete} onChange={(v) => update({ chromeDelete: v })} label="Chrome delete (black trim)" />
                <Switch checked={cfg.sunroof} onChange={(v) => update({ sunroof: v })} label="Sunroof" />
                <Switch checked={cfg.privacyRear} onChange={(v) => update({ privacyRear: v })} label="Factory privacy rear glass" />
              </div>
            </div>
          ) : null}

          {tab === 'tint' ? (
            <div className="space-y-4">
              <div>
                <p className="label">Quick packages</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {PRESETS.map((p) => (
                    <Button key={p.k} size="sm" variant={p.k === activePreset ? 'primary' : 'outline'} onClick={() => preset(p.k)}>
                      {p.l}
                    </Button>
                  ))}
                </div>
              </div>
              {TINT_ZONES.filter((z) => z.key !== 'sunroof' || cfg.sunroof).map((z) => {
                const t = cfg.zones[z.key];
                const f = filmById(t.filmId);
                const check = checks.find((c) => c.zone === z.key);
                const min = zoneMin(rule, z.key);
                return (
                  <motion.div layout key={z.key} className="rounded-2xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{z.label}</p>
                      {check ? (
                        <Badge tone={check.ok ? 'success' : 'danger'} dot>
                          {check.combined}%{check.min ? ` / min ${check.min}%` : ''}
                        </Badge>
                      ) : null}
                    </div>
                    <Select
                      className="mt-2 h-9 text-xs"
                      aria-label={`${z.label} film`}
                      value={t.filmId || ''}
                      onChange={(e) => {
                        const nf = filmById(e.target.value || null);
                        setZone(z.key, nf?._id || null, nf ? (darkestLegal(nf, z.key, rule, cfg.privacyRear) ?? closestShade(nf, 35)) : null);
                      }}
                    >
                      <option value="">No film (factory glass)</option>
                      {films.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.brand} {x.name} · {x.category}
                        </option>
                      ))}
                    </Select>
                    {f ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[...f.shades]
                          .sort((a, b) => b.vlt - a.vlt)
                          .map((s) => {
                            const comb = combinedVlt(z.key, s.vlt, cfg.privacyRear);
                            const ok = comb + (rule?.tolerance || 0) >= min;
                            return (
                              <button
                                key={s.vlt}
                                type="button"
                                title={`${s.vlt}% film · ${s.tser}% TSER · ${comb}% combined${ok ? '' : ' · too dark'}`}
                                onClick={() => setZone(z.key, f._id, s.vlt)}
                                className={cn('relative flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition', t.vlt === s.vlt ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-line hover:bg-muted')}
                              >
                                <span className="h-3 w-3 rounded-sm border border-line" style={{ background: f.tintColor, opacity: Math.max(0.15, glassLook(s.vlt, f).opacity) }} />
                                {s.vlt}%
                                {!ok ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" /> : null}
                              </button>
                            );
                          })}
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
              <div className="rounded-2xl border border-line p-3">
                <Switch checked={cfg.visor.enabled} onChange={(v) => update({ visor: { ...cfg.visor, enabled: v, vlt: cfg.visor.vlt ?? 15 } })} label="Windscreen visor strip" />
                {cfg.visor.enabled ? <p className="mt-2 text-xs text-muted-fg">{rule?.windscreenStripPct ? `Top ${rule.windscreenStripPct}% of the windscreen — ${rule.windscreen}.` : `Not permitted in ${rule?.name}.`}</p> : null}
              </div>
              <Link href={`/advisor?body=${cfg.bodyType}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary/10 to-fuchsia-500/10 px-3 py-2.5 text-xs font-semibold text-primary hover:from-primary/20">
                <Gauge className="h-4 w-4" /> Let the Smart Advisor pick the best film
              </Link>
            </div>
          ) : null}

          {tab === 'photo' ? <PhotoLab cfg={cfg} films={films} aiStatus={aiStatus} onApply={onPhoto} onScanned={setScannedUrl} scannedActive={!!scannedUrl} /> : null}

          {tab === 'designs' ? (
            <div className="space-y-4">
              <div className="space-y-3 rounded-2xl border border-line p-3">
                <Field label="Design name">
                  <Input value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="e.g. Ryan's Model Y — legal ceramic" />
                </Field>
                <Field label="Attach to project">
                  <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">Not attached</option>
                    {(projects || []).map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.number} · {p.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex gap-2">
                  <Button icon={Save} onClick={save} loading={saving} className="flex-1">
                    {designId ? 'Update' : 'Save'}
                  </Button>
                  {designId ? (
                    <Button variant="outline" onClick={() => { setDesignId(null); setDesignName(''); }}>
                      Save as new
                    </Button>
                  ) : null}
                </div>
                {projectId ? (
                  <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <Link2 className="h-3.5 w-3.5" /> Open project
                  </Link>
                ) : null}
              </div>
              {!designs?.length ? (
                <EmptyState icon={FolderOpen} title="No saved designs" description="Save a configuration to reuse it or attach it to a customer project." />
              ) : (
                <div className="space-y-2">
                  {designs.map((d) => (
                    <motion.div layout key={d._id} className={cn('flex gap-3 rounded-2xl border p-2.5 transition', designId === d._id ? 'border-primary bg-primary/5' : 'border-line')}>
                      <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                        {d.snapshotFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(d.snapshotFileId)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-5 w-5 text-muted-fg" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{d.name}</p>
                        <p className="text-[11px] text-muted-fg">
                          {d.config?.bodyType} · {fmtDateTime(d.updatedAt)}
                        </p>
                        <div className="mt-1 flex gap-1">
                          <Button size="xs" variant="secondary" onClick={() => { applyDesign(d); toast.success('Design loaded'); }}>
                            Load
                          </Button>
                          <Button size="xs" variant="ghost" icon={Trash2} onClick={() => removeDesign(d)} aria-label="Delete design" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

export default function VisualizerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh] w-full" />}>
      <Visualizer />
    </Suspense>
  );
}
