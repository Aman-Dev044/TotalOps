'use client';

import { motion } from 'framer-motion';

export type CutPlanData = {
  rollWidth: number; trimMm: number; pieces: number; linearM: number; materialM2: number; glassM2: number; wasteM2: number; wastePct: number;
  placements: { label: string; x: number; y: number; w: number; h: number; rotated: boolean; split?: number }[]; oversize: string[];
};

const FILLS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316'];

/** Roll unrolled left→right: x = along the roll (length), y = across the roll width. */
export function CutPlanDiagram({ plan, height = 170 }: { plan: CutPlanData; height?: number }) {
  const lenMm = Math.max(1, plan.linearM * 1000);
  const W = plan.rollWidth;
  const pxWidth = Math.max(320, (lenMm / W) * height);
  const font = Math.max(36, W / 16);
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line bg-muted/40 p-2">
        <svg width={pxWidth} height={height} viewBox={`0 0 ${lenMm} ${W}`} preserveAspectRatio="none" role="img" aria-label={`Cut plan on a ${W} mm roll, ${plan.linearM} linear metres`}>
          <defs>
            <pattern id="waste" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="60" height="60" fill="hsl(var(--muted))" />
              <line x1="0" y1="0" x2="0" y2="60" stroke="hsl(var(--muted-fg))" strokeOpacity=".25" strokeWidth="14" />
            </pattern>
          </defs>
          <rect x={0} y={0} width={lenMm} height={W} fill="url(#waste)" />
          {plan.placements.map((p, i) => (
            <motion.g key={`${p.label}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
              <rect x={p.y + 6} y={p.x + 6} width={Math.max(1, p.h - 12)} height={Math.max(1, p.w - 12)} rx={14} fill={FILLS[i % FILLS.length]} fillOpacity={0.82} stroke="hsl(var(--card))" strokeWidth={12} />
              {p.h > font * 4 && p.w > font * 1.6 ? (
                <text x={p.y + p.h / 2} y={p.x + p.w / 2} textAnchor="middle" dominantBaseline="middle" fontSize={font} fontWeight={700} fill="#fff" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {p.label.length > 22 ? p.label.slice(0, 21) + '…' : p.label}
                </text>
              ) : null}
            </motion.g>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-fg">
        <span><b className="text-fg">{plan.rollWidth} mm</b> roll</span>
        <span><b className="text-fg">{plan.linearM} m</b> linear</span>
        <span><b className="text-fg">{plan.materialM2} m²</b> film used</span>
        <span><b className="text-fg">{plan.glassM2} m²</b> glass</span>
        <span><b className="text-fg">{plan.wastePct}%</b> trim & layout waste</span>
        <span>{plan.pieces} pieces · {plan.trimMm} mm trim/edge</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, hsl(var(--muted-fg)/.35) 0 2px, transparent 2px 5px)' }} /> offcut</span>
      </div>
      {plan.oversize.length ? <p className="mt-1 text-xs font-semibold text-warning">Needs a seam (wider than the roll): {plan.oversize.join(', ')}</p> : null}
    </div>
  );
}
