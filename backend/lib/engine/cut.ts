export type Piece = { label: string; w: number; h: number; qty?: number }; // glass size in mm

export type Placement = { label: string; x: number; y: number; w: number; h: number; rotated: boolean; split?: number };

export type CutPlan = {
  rollWidth: number;
  trimMm: number;
  pieces: number;
  linearM: number;
  materialM2: number;
  glassM2: number;
  wasteM2: number;
  wastePct: number;
  placements: Placement[];
  oversize: string[];
};

export function toMm(value: number, unit = 'mm') {
  const v = Number(value) || 0;
  switch ((unit || 'mm').toLowerCase()) {
    case 'cm': return v * 10;
    case 'm': return v * 1000;
    case 'in': case 'inch': case 'inches': return v * 25.4;
    case 'ft': return v * 304.8;
    default: return v;
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type Item = { label: string; across: number; along: number; rotated: boolean; split: number; glass: number };

function orient(p: { label: string; w: number; h: number }, W: number, trim: number, preferWideAcross: boolean): Item {
  const a = p.w + trim * 2;
  const b = p.h + trim * 2;
  const glass = (p.w * p.h) / 1e6;
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const rotatedFor = (across: number) => across !== a; // rotated = height runs across the roll
  if (preferWideAcross && big <= W) return { label: p.label, across: big, along: small, rotated: rotatedFor(big), split: 1, glass };
  if (small <= W) return { label: p.label, across: small, along: big, rotated: rotatedFor(small), split: 1, glass };
  // Wider than the roll in both directions: needs vertical seams.
  const split = Math.ceil(small / W);
  return { label: p.label, across: W, along: big * split, rotated: false, split, glass };
}

function pack(items: Item[], W: number) {
  const sorted = [...items].sort((x, y) => y.along - x.along || y.across - x.across);
  const shelves: { y: number; h: number; used: number }[] = [];
  const placements: Placement[] = [];
  let total = 0;
  for (const it of sorted) {
    let shelf = shelves.find((s) => s.used + it.across <= W && it.along <= s.h);
    if (!shelf) {
      shelf = { y: total, h: it.along, used: 0 };
      shelves.push(shelf);
      total += it.along;
    }
    placements.push({ label: it.label, x: shelf.used, y: shelf.y, w: it.across, h: it.along, rotated: it.rotated, split: it.split > 1 ? it.split : undefined });
    shelf.used += it.across;
  }
  return { placements, linearMm: total };
}

/** Shelf-packs every pane (plus trim) onto a roll of the given width. */
export function planCut(pieces: Piece[], rollWidth: number, trimMm = 10): CutPlan {
  const expanded: { label: string; w: number; h: number }[] = [];
  for (const p of pieces) {
    const n = Math.max(1, Math.round(p.qty || 1));
    for (let i = 0; i < n; i++) expanded.push({ label: n > 1 ? `${p.label} #${i + 1}` : p.label, w: p.w, h: p.h });
  }
  let best: { placements: Placement[]; linearMm: number } | null = null;
  let bestItems: Item[] = [];
  for (const wide of [true, false]) {
    const items = expanded.map((p) => orient(p, rollWidth, trimMm, wide));
    const res = pack(items, rollWidth);
    if (!best || res.linearMm < best.linearMm) {
      best = res;
      bestItems = items;
    }
  }
  const linearMm = best?.linearMm || 0;
  const glassM2 = bestItems.reduce((s, it) => s + it.glass, 0);
  const materialM2 = (rollWidth / 1000) * (linearMm / 1000);
  const wasteM2 = Math.max(0, materialM2 - glassM2);
  return {
    rollWidth,
    trimMm,
    pieces: expanded.length,
    linearM: r2(linearMm / 1000),
    materialM2: r2(materialM2),
    glassM2: r2(glassM2),
    wasteM2: r2(wasteM2),
    wastePct: materialM2 > 0 ? Math.round((wasteM2 / materialM2) * 100) : 0,
    placements: best?.placements || [],
    oversize: bestItems.filter((i) => i.split > 1).map((i) => i.label),
  };
}

/** Tries every available roll width and returns the plan that uses the least film. */
export function bestCut(pieces: Piece[], widths: number[], trimMm = 10) {
  const list = (widths && widths.length ? widths : [1524]).filter((w) => w > 0).sort((a, b) => a - b);
  const plans = list.map((w) => planCut(pieces, w, trimMm));
  const sorted = [...plans].sort((a, b) => a.oversize.length - b.oversize.length || a.materialM2 - b.materialM2 || a.rollWidth - b.rollWidth);
  return { best: sorted[0], all: plans };
}

/** Smallest roll width that fits a single pane without a seam. */
export function bestRollForPane(w: number, h: number, widths: number[], trimMm = 10) {
  const need = Math.min(w, h) + trimMm * 2;
  const sorted = [...(widths.length ? widths : [1524])].sort((a, b) => a - b);
  const fit = sorted.find((x) => x >= need);
  if (fit) {
    const along = Math.max(w, h) + trimMm * 2;
    return { rollWidth: fit, fits: true, drops: 1, materialM2: r2((fit / 1000) * (along / 1000)) };
  }
  const max = sorted[sorted.length - 1];
  const drops = Math.ceil(need / max);
  return { rollWidth: max, fits: false, drops, materialM2: r2((max / 1000) * ((Math.max(w, h) + trimMm * 2) / 1000) * drops) };
}
