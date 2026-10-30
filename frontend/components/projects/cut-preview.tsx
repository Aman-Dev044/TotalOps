'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Scissors } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { UNIT_MM } from '@/lib/format';
import type { Pane } from '@/lib/types';
import { Badge, Button, Select } from '@/components/ui';

type Plan = { rollWidth: number; trimMm: number; pieces: number; linearM: number; materialM2: number; glassM2: number; wasteM2: number; wastePct: number; placements: { label: string; x: number; y: number; w: number; h: number; rotated: boolean; split?: number }[]; oversize: string[] };

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316'];

export function CutPreview({ panes, widths }: { panes: (Pane & { group: string })[]; widths: number[] }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [all, setAll] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [trim, setTrim] = useState(10);

  const calc = async () => {
    const pieces = panes
      .filter((p) => p.selected !== false && Number(p.width) > 0 && Number(p.height) > 0)
      .map((p) => {
        const f = UNIT_MM[p.unit || 'mm'] || 1;
        return { label: `${p.group} · ${p.label}`, w: Math.round(Number(p.width) * f), h: Math.round(Number(p.height) * f), qty: Number(p.qty) || 1 };
      });
    if (!pieces.length) return toast.error('Add panes with dimensions first');
    setBusy(true);
    try {
      const res = await api.post<{ best: Plan; all: Plan[] }>('/advisor', { mode: 'cut', pieces, widths: widths.length ? widths : [1524], trimMm: trim });
      setPlan(res.best);
      setAll(res.all);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const H = plan ? Math.max(1, plan.linearM * 1000) : 1;
  const W = plan?.rollWidth || 1524;
  const scale = 260 / W;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={trim} onChange={(e) => setTrim(Number(e.target.value))} className="h-8 w-auto text-xs" aria-label="Trim per edge">
          {[5, 10, 15, 20].map((t) => <option key={t} value={t}>{t} mm trim / edge</option>)}
        </Select>
        <Button size="sm" icon={Scissors} loading={busy} onClick={calc}>Calculate cut plan</Button>
      </div>
      {plan ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Best roll</p><p className="font-display text-base font-bold">{plan.rollWidth} mm</p></div>
            <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Linear metres</p><p className="font-display text-base font-bold">{plan.linearM} m</p></div>
            <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Glass / material</p><p className="font-display text-base font-bold">{plan.glassM2} / {plan.materialM2} m²</p></div>
            <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Trim / layout waste</p><p className="font-display text-base font-bold">{plan.wastePct}%</p></div>
          </div>
          {plan.oversize.length ? <Badge tone="danger">Exceeds roll width: {plan.oversize.join(', ')}</Badge> : null}
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line bg-bg p-3">
            <svg viewBox={`0 0 ${W * scale + 20} ${H * scale + 20}`} className="mx-auto block w-full max-w-[300px]">
              <rect x={10} y={10} width={W * scale} height={H * scale} rx={3} fill="hsl(var(--muted))" stroke="hsl(var(--line))" />
              {plan.placements.map((pl, i) => (
                <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <rect x={10 + pl.x * scale + 0.5} y={10 + pl.y * scale + 0.5} width={Math.max(1, pl.w * scale - 1)} height={Math.max(1, pl.h * scale - 1)} rx={2} fill={COLORS[i % COLORS.length]} fillOpacity={0.25} stroke={COLORS[i % COLORS.length]} />
                  {pl.w * scale > 40 && pl.h * scale > 14 ? (
                    <text x={10 + (pl.x + pl.w / 2) * scale} y={10 + (pl.y + pl.h / 2) * scale} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="hsl(var(--fg))">
                      {pl.label.split(' · ').pop()?.slice(0, 18)}
                    </text>
                  ) : null}
                </motion.g>
              ))}
            </svg>
            <p className="mt-2 text-center text-[11px] text-muted-fg">Roll width runs left → right · length runs down. Identical panes sit side-by-side when they fit.</p>
          </div>
          {all.length > 1 ? (
            <div className="text-xs text-muted-fg">
              {all.map((a) => (
                <span key={a.rollWidth} className="mr-3">{a.rollWidth} mm → {a.materialM2} m² ({a.wastePct}% waste)</span>
              ))}
            </div>
          ) : null}
        </motion.div>
      ) : (
        <p className="text-xs text-muted-fg">Shelf-packs every selected pane (plus trim) across each available roll width and picks the one that uses the least film.</p>
      )}
    </div>
  );
}
