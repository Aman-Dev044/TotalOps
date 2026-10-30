'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Box, Camera, CheckCircle2, Eraser, ImagePlus, Info, Loader2, MousePointerClick, PenLine, ScanLine, Sparkles, Trash2, Undo2, Wand2 } from 'lucide-react';
import { API_URL, api, errorMessage, getToken, uploadFile } from '@/lib/api';
import type { Film } from '@/lib/types';
import { Badge, Button, Progress, Select, cn } from '@/components/ui';
import { analyseColours, resizePhoto, type ColorAnalysis } from './photo-analysis';
import { TINT_ZONES, combinedVlt, glassLook, type CarConfig, type Finish, type TintZone, type WheelColor } from './tint';

export type AiVehicle = {
  isVehicle: boolean; make: string; model: string; yearRange: string; bodyType: string; paintColorHex: string; paintColorName: string; finish: Finish;
  wheelColor: WheelColor; existingTint: { present: boolean; estimatedVlt: number; factoryPrivacyRear: boolean }; view: string;
  windows: { label: string; zone: string; polygon: number[][] }[]; confidence: number; notes: string;
};
type Poly = { id: string; zone: TintZone | 'windscreen'; label: string; pts: [number, number][] };

export type PhotoResult = { fileId: string; analysis: ColorAnalysis; ai: AiVehicle | null };

const ZONE_OPTS: { key: TintZone | 'windscreen'; label: string }[] = [{ key: 'windscreen', label: 'Windscreen' }, ...TINT_ZONES.map((z) => ({ key: z.key, label: z.short }))];
const rid = () => Math.random().toString(36).slice(2, 10);

export function PhotoLab({
  cfg, films, aiStatus, onApply, onScanned, scannedActive,
}: {
  cfg: CarConfig;
  films: Film[];
  aiStatus: { vision: boolean; model3d: boolean } | undefined;
  onApply: (r: PhotoResult) => void;
  onScanned: (url: string | null) => void;
  scannedActive: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ dataUrl: string; fileId: string; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState<'' | 'upload' | 'ai'>('');
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [ai, setAi] = useState<AiVehicle | null>(null);
  const [aiError, setAiError] = useState('');
  const [polys, setPolys] = useState<Poly[]>([]);
  const [mode, setMode] = useState<'view' | 'draw' | 'edit'>('view');
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [draftZone, setDraftZone] = useState<TintZone | 'windscreen'>('frontSides');
  const [slider, setSlider] = useState(55);
  const [drag, setDrag] = useState<{ poly: string; idx: number } | null>(null);
  const [mesh, setMesh] = useState<{ taskId: string; progress: number; status: string; error?: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /* ---------- upload & analysis ---------- */
  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose a JPG, PNG or WebP photo');
    setBusy('upload');
    setAi(null);
    setAiError('');
    setPolys([]);
    setMesh(null);
    try {
      const r = await resizePhoto(file);
      const up = await uploadFile(r.blob, { category: 'photo', name: file.name.replace(/\.\w+$/, '') + '.jpg' });
      const a = await analyseColours(r.dataUrl);
      setPhoto({ dataUrl: r.dataUrl, fileId: up._id, w: r.width, h: r.height });
      setAnalysis(a);
      onApply({ fileId: up._id, analysis: a, ai: null });
      toast.success('Photo analysed — body colour applied to the 3D model');
      if (aiStatus?.vision) await runAi(up._id, a);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const runAi = async (fileId: string, a: ColorAnalysis | null) => {
    setBusy('ai');
    setAiError('');
    try {
      const res = await api.post<AiVehicle>('/ai/vehicle', { fileId });
      setAi(res);
      if (!res.isVehicle) {
        toast.warning('The AI could not find a vehicle in this photo');
      } else {
        setPolys(res.windows.map((w) => ({ id: rid(), zone: (ZONE_OPTS.some((z) => z.key === w.zone) ? w.zone : 'rearSides') as Poly['zone'], label: w.label, pts: w.polygon.map((p) => [clamp01(p[0]), clamp01(p[1])] as [number, number]) })));
        onApply({ fileId, analysis: a || { dominant: res.paintColorHex, palette: [], aspect: 1.5, orientation: 'landscape' }, ai: res });
        toast.success(`Detected ${res.make} ${res.model} — 3D model rebuilt`);
      }
    } catch (err) {
      setAiError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  /* ---------- polygon editing ---------- */
  const rel = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = boxRef.current!.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const p = rel(e);
      setPolys((ps) => ps.map((pl) => (pl.id === drag.poly ? { ...pl, pts: pl.pts.map((pt, i) => (i === drag.idx ? p : pt)) } : pl)));
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag]);

  const finishDraft = () => {
    if (draft.length < 3) return toast.error('Click at least 3 points around the window');
    setPolys((ps) => [...ps, { id: rid(), zone: draftZone, label: ZONE_OPTS.find((z) => z.key === draftZone)?.label || 'Window', pts: draft }]);
    setDraft([]);
    toast.success('Window added');
  };

  const lookFor = (zone: Poly['zone']) => {
    if (zone === 'windscreen') {
      return glassLook(combinedVlt('windscreen', null), null);
    }
    const t = cfg.zones[zone];
    return glassLook(combinedVlt(zone, t.vlt, cfg.privacyRear), films.find((f) => f._id === t.filmId));
  };

  /* ---------- real 3D mesh ---------- */
  const startMesh = async () => {
    if (!photo) return;
    try {
      const { taskId } = await api.post<{ taskId: string }>('/ai/model3d', { fileId: photo.fileId });
      setMesh({ taskId, progress: 0, status: 'PENDING' });
      toast.message('3D reconstruction started — this usually takes 1–3 minutes');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  useEffect(() => {
    if (!mesh || mesh.status === 'SUCCEEDED' || mesh.error) return;
    const t = setTimeout(async () => {
      try {
        const s = await api.get<{ status: string; progress: number; ready: boolean; failed: boolean; error: string | null }>(`/ai/model3d/${mesh.taskId}`);
        if (s.failed) setMesh({ ...mesh, status: s.status, error: s.error || 'Reconstruction failed' });
        else if (s.ready) {
          setMesh({ ...mesh, status: 'SUCCEEDED', progress: 100 });
          onScanned(`${API_URL}/api/ai/model3d/${mesh.taskId}?glb=1&token=${encodeURIComponent(getToken())}`);
          toast.success('Real 3D mesh ready — loaded into the viewer');
        } else setMesh({ ...mesh, status: s.status, progress: s.progress || 0 });
      } catch (err) {
        setMesh({ ...mesh, error: errorMessage(err) });
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [mesh, onScanned]);

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

      {!photo ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          className="group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center transition hover:border-primary/60"
        >
          <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-glow">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          </motion.span>
          <p className="mt-3 font-display font-bold">Upload a photo of the customer&apos;s car</p>
          <p className="mt-1 max-w-xs text-xs text-muted-fg">Drag & drop or click. We detect body colour instantly{aiStatus?.vision ? ', then AI identifies the make, model, body style and windows to rebuild it in 3D.' : '.'}</p>
        </motion.button>
      ) : (
        <div className="space-y-3">
          {/* Photo with tint overlay */}
          <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
            <div ref={boxRef} className={cn('relative select-none', mode === 'draw' && 'cursor-crosshair')} onClick={(e) => { if (mode === 'draw') setDraft((d) => [...d, rel(e)]); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.dataUrl} alt="Customer vehicle" className="block w-full" draggable={false} />
              <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}>
                <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="h-full w-full">
                  {polys.map((p) => {
                    const l = lookFor(p.zone);
                    return <polygon key={p.id} points={p.pts.map((x) => x.join(',')).join(' ')} fill={l.color} fillOpacity={l.opacity * 0.92} style={{ mixBlendMode: 'multiply', transition: 'fill-opacity .4s, fill .4s' }} />;
                  })}
                </svg>
              </div>
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
                {mode !== 'view' ? polys.map((p) => <polygon key={p.id} points={p.pts.map((x) => x.join(',')).join(' ')} fill="none" stroke="#a5b4fc" strokeWidth={2} vectorEffect="non-scaling-stroke" />) : null}
                {draft.length ? <polyline points={draft.map((x) => x.join(',')).join(' ')} fill="rgba(99,102,241,.2)" stroke="#818cf8" strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
              </svg>
              {mode === 'edit'
                ? polys.flatMap((p) => p.pts.map((pt, i) => (
                    <span
                      key={`${p.id}-${i}`}
                      onPointerDown={(e) => { e.stopPropagation(); setDrag({ poly: p.id, idx: i }); }}
                      className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-primary shadow"
                      style={{ left: `${pt[0] * 100}%`, top: `${pt[1] * 100}%` }}
                    />
                  )))
                : null}
              {draft.map((pt, i) => <span key={i} className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-primary" style={{ left: `${pt[0] * 100}%`, top: `${pt[1] * 100}%` }} />)}
              {polys.length && mode === 'view' ? (
                <>
                  <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow" style={{ left: `${slider}%` }} />
                  <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-white">With tint</span>
                  <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Before</span>
                </>
              ) : null}
              <AnimatePresence>
                {busy === 'ai' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-primary/15">
                    <motion.div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-fuchsia-400/60 to-transparent" animate={{ top: ['-10%', '100%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white">
                        <ScanLine className="h-4 w-4 animate-pulse" /> AI scanning vehicle…
                      </span>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
          {polys.length && mode === 'view' ? (
            <label className="flex items-center gap-3 text-xs font-semibold text-muted-fg">
              Before / after
              <input type="range" min={0} max={100} value={slider} onChange={(e) => setSlider(Number(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" />
            </label>
          ) : null}

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={Camera} onClick={() => inputRef.current?.click()} loading={busy === 'upload'}>
              New photo
            </Button>
            <Button size="sm" variant={mode === 'draw' ? 'primary' : 'outline'} icon={PenLine} onClick={() => { setMode(mode === 'draw' ? 'view' : 'draw'); setDraft([]); }}>
              Draw window
            </Button>
            <Button size="sm" variant={mode === 'edit' ? 'primary' : 'outline'} icon={MousePointerClick} onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')} disabled={!polys.length}>
              Adjust points
            </Button>
            {aiStatus?.vision ? (
              <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => runAi(photo.fileId, analysis)} loading={busy === 'ai'}>
                Re-run AI
              </Button>
            ) : null}
          </div>
          {mode === 'draw' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 p-2.5 text-xs">
              <span className="font-semibold text-primary">Click around the glass edge ({draft.length} pts)</span>
              <Select value={draftZone} onChange={(e) => setDraftZone(e.target.value as Poly['zone'])} className="h-8 w-36 text-xs">
                {ZONE_OPTS.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
              </Select>
              <Button size="xs" icon={CheckCircle2} onClick={finishDraft}>Finish</Button>
              <Button size="xs" variant="ghost" icon={Undo2} onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>Undo</Button>
            </div>
          ) : null}

          {polys.length ? (
            <div className="space-y-1.5">
              {polys.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-1.5 text-xs">
                  <span className="h-3 w-3 rounded" style={{ background: lookFor(p.zone).color, opacity: Math.max(0.3, lookFor(p.zone).opacity) }} />
                  <span className="flex-1 truncate font-semibold">{p.label}</span>
                  <Select value={p.zone} onChange={(e) => setPolys((ps) => ps.map((x) => (x.id === p.id ? { ...x, zone: e.target.value as Poly['zone'] } : x)))} className="h-7 w-32 text-xs">
                    {ZONE_OPTS.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
                  </Select>
                  <button type="button" aria-label="Remove window" onClick={() => setPolys((ps) => ps.filter((x) => x.id !== p.id))} className="rounded p-1 text-muted-fg hover:bg-muted hover:text-danger">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setPolys([])} className="flex items-center gap-1 text-xs font-semibold text-muted-fg hover:text-danger">
                <Eraser className="h-3.5 w-3.5" /> Clear all windows
              </button>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-muted p-2.5 text-xs text-muted-fg">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {aiStatus?.vision ? 'AI-detected windows appear here. You can also draw windows yourself to preview the tint on the real photo.' : 'Draw the windows on the photo to preview the selected tint on the customer’s actual car.'}
            </p>
          )}
        </div>
      )}

      {/* Detection results */}
      {analysis ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">Colour analysis</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl border border-line shadow-inner" style={{ background: ai?.paintColorHex || analysis.dominant }} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{ai?.paintColorName || 'Detected body colour'} <span className="font-mono text-xs text-muted-fg">{ai?.paintColorHex || analysis.dominant}</span></p>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full">
                {analysis.palette.map((p) => <span key={p.hex} style={{ background: p.hex, width: `${p.pct}%` }} title={`${p.hex} · ${p.pct}%`} />)}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

      {ai && ai.isVehicle ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-transparent p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary"><Wand2 className="h-3.5 w-3.5" /> AI vehicle detection</p>
            <Badge tone={ai.confidence >= 0.7 ? 'success' : ai.confidence >= 0.4 ? 'warning' : 'danger'}>{Math.round(ai.confidence * 100)}% confident</Badge>
          </div>
          <p className="mt-1.5 font-display text-lg font-extrabold">{ai.make} {ai.model}</p>
          <p className="text-xs text-muted-fg">{ai.yearRange} · {ai.bodyType} · {ai.finish} {ai.paintColorName} · {ai.wheelColor} wheels · view: {ai.view.replace(/_/g, ' ')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ai.existingTint.present ? <Badge tone="warning">Existing tint ≈ {ai.existingTint.estimatedVlt}% VLT</Badge> : <Badge>No existing tint</Badge>}
            {ai.existingTint.factoryPrivacyRear ? <Badge tone="info">Factory privacy rear glass</Badge> : null}
            <Badge tone="primary">{ai.windows.length} windows mapped</Badge>
          </div>
          {ai.notes ? <p className="mt-2 text-xs text-muted-fg">{ai.notes}</p> : null}
        </motion.div>
      ) : null}
      {aiError ? <p className="rounded-xl bg-danger/10 p-2.5 text-xs font-medium text-danger">{aiError}</p> : null}
      {aiStatus && !aiStatus.vision ? (
        <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-xs text-fg">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span><b>AI make/model detection is off.</b> Add <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-muted px-1">backend/.env.local</code> and restart the backend to auto-detect body style, paint, finish, wheels, existing tint and window outlines. Colour detection already works without it.</span>
        </p>
      ) : null}

      {/* Real 3D mesh */}
      {photo ? (
        <div className="rounded-2xl border border-line p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-fg"><Box className="h-3.5 w-3.5" /> Photo → real 3D mesh</p>
          {aiStatus?.model3d ? (
            <div className="mt-2 space-y-2">
              {mesh && !mesh.error && mesh.status !== 'SUCCEEDED' ? (
                <>
                  <Progress value={mesh.progress} />
                  <p className="text-xs text-muted-fg">Reconstructing… {mesh.progress}% ({mesh.status.toLowerCase().replace('_', ' ')})</p>
                </>
              ) : null}
              {mesh?.error ? <p className="text-xs text-danger">{mesh.error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={Box} onClick={startMesh} disabled={!!mesh && !mesh.error && mesh.status !== 'SUCCEEDED'}>
                  {mesh?.status === 'SUCCEEDED' ? 'Regenerate mesh' : 'Generate real 3D mesh'}
                </Button>
                {scannedActive ? <Button size="sm" variant="outline" onClick={() => onScanned(null)}>Back to tint model</Button> : null}
              </div>
              <p className="text-[11px] text-muted-fg">Scanned meshes show the real car shape; per-window tint editing is available on the TotalOps tint model.</p>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-fg">Add <code className="rounded bg-muted px-1">MESHY_API_KEY</code> to <code className="rounded bg-muted px-1">backend/.env.local</code> to turn the photo into a full textured 3D mesh. The parametric tint model above is rebuilt from the photo either way.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));
