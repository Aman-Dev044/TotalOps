import { getRule, zoneMin, factoryGlass, checkZone, type Zone, type LegalRule } from './legal';
import { getBody } from './vehicles';
import { bestCut, bestRollForPane, toMm, type CutPlan } from './cut';

export type Shade = { vlt: number; tser: number; glare: number; absorptance: number };
export type FilmLite = {
  _id: string;
  name: string;
  brand?: string;
  category: string;
  segments: string[];
  shades: Shade[];
  irr: number;
  uvr: number;
  reflectivity: number;
  signalSafe: boolean;
  tintColor?: string;
  thicknessMil: number;
  warrantyYears: number;
  rollWidths: number[];
  costPerM2: number;
  sellPerM2: number;
  glassCompat?: Record<string, string>;
  tier?: number;
};

export type Goals = { heat: number; privacy: number; uv: number; glare: number; security: number; clarity: number; budget: number };

export type AdvisorPane = { label: string; zone?: Zone; width: number; height: number; unit?: string; qty?: number; orientation?: string; glass?: string };

export type AdvisorInput = {
  segment: 'automotive' | 'residential' | 'commercial';
  region?: string;
  bodyType?: string;
  privacyRear?: boolean;
  includeVisor?: boolean;
  includeSunroof?: boolean;
  panes?: AdvisorPane[];
  goals?: Partial<Goals>;
  glassType?: string;
  orientation?: string;
  climate?: 'hot' | 'warm' | 'temperate' | 'cold';
  shading?: boolean;
  removal?: boolean;
  preferSignalSafe?: boolean;
  trimMm?: number;
  electricityRate?: number;
  labourRate?: number;
  chargeOutRate?: number;
  stock?: { filmId: string; widthMm: number; remainingM2: number; shade?: number }[];
};

const DEFAULT_GOALS: Goals = { heat: 4, privacy: 3, uv: 3, glare: 2, security: 0, clarity: 2, budget: 2 };

/** Privacy goal (0–5) → desired film VLT. */
const PRIVACY_TARGET = [70, 50, 35, 20, 15, 5];

const ORIENT_IRRADIANCE: Record<string, Record<string, number>> = {
  south: { N: 620, NE: 600, E: 560, SE: 300, S: 150, SW: 320, W: 680, NW: 660 },
  north: { S: 620, SE: 600, E: 560, NE: 300, N: 150, NW: 320, W: 680, SW: 660 },
};
const COOLING_HOURS = { hot: 1300, warm: 950, temperate: 550, cold: 200 };

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

function nearestShade(shades: Shade[], target: number, minVlt: number) {
  const legal = shades.filter((s) => s.vlt >= minVlt);
  const pool = legal.length ? legal : [];
  if (!pool.length) return null;
  return [...pool].sort((a, b) => Math.abs(a.vlt - target) - Math.abs(b.vlt - target) || b.vlt - a.vlt)[0];
}

export function thermalStress(opts: { segment: string; glassType?: string; absorptance: number; maxAreaM2: number; maxEdgeMm: number; orientation?: string; hemisphere: 'south' | 'north'; shading?: boolean }) {
  const reasons: string[] = [];
  if (opts.segment === 'automotive') return { level: 'low' as const, score: 0, reasons: ['Automotive glass is toughened/laminated — thermal stress is not a concern.'] };
  let score = 0;
  const g = opts.glassType || 'single_clear';
  if (g === 'double_glazed' || g === 'low_e') { score += 2; reasons.push('Insulated / Low-E units trap absorbed heat between panes.'); }
  if (g === 'single_tinted') { score += 2; reasons.push('Body-tinted glass already absorbs solar energy.'); }
  if (g === 'laminated') { score += 1; reasons.push('Laminated glass has an absorbing interlayer.'); }
  if (g === 'toughened') { score -= 2; reasons.push('Toughened glass tolerates high thermal stress.'); }
  if (opts.absorptance > 0.5) { score += 2; reasons.push(`Film absorbs ${Math.round(opts.absorptance * 100)}% of solar energy (high).`); }
  else if (opts.absorptance > 0.4) { score += 1; reasons.push(`Film absorbs ${Math.round(opts.absorptance * 100)}% of solar energy.`); }
  if (opts.maxAreaM2 > 2.5 || opts.maxEdgeMm > 2500) { score += 1; reasons.push('Large annealed panes heat unevenly from the edges.'); }
  const hot = opts.hemisphere === 'south' ? ['N', 'NW', 'W'] : ['S', 'SW', 'W'];
  if (opts.orientation && hot.includes(opts.orientation.toUpperCase())) { score += 1; reasons.push(`${opts.orientation.toUpperCase()}-facing glass receives the strongest afternoon sun.`); }
  if (opts.shading) { score += 1; reasons.push('Partial shading creates hot/cold zones across the glass.'); }
  const level = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';
  if (level === 'low' && !reasons.length) reasons.push('Low absorptance film on standard glass — safe combination.');
  return { level, score, reasons } as { level: 'low' | 'medium' | 'high'; score: number; reasons: string[] };
}

type PaneMm = { label: string; zone: Zone; w: number; h: number; qty: number; minutes: number; areaM2: number };

function resolvePanes(input: AdvisorInput): PaneMm[] {
  if (input.panes && input.panes.length) {
    return input.panes
      .map((p) => {
        const w = toMm(p.width, p.unit);
        const h = toMm(p.height, p.unit);
        const qty = Math.max(1, Math.round(Number(p.qty) || 1));
        const zone = (p.zone || (input.segment === 'automotive' ? 'rearSides' : 'rearSides')) as Zone;
        return { label: p.label || 'Pane', zone, w, h, qty, minutes: 0, areaM2: (w * h * qty) / 1e6 };
      })
      .filter((p) => p.w > 0 && p.h > 0);
  }
  if (input.segment !== 'automotive') return [];
  const body = getBody(input.bodyType);
  const list = body.panes.map((p) => ({ label: p.label, zone: p.zone, w: p.width, h: p.height, qty: p.qty, minutes: p.minutes, areaM2: (p.width * p.height * p.qty) / 1e6 }));
  if (input.includeVisor) list.push({ label: 'Windscreen visor strip', zone: 'windscreen', w: 1450, h: 120, qty: 1, minutes: 20, areaM2: 0.174 });
  if (input.includeSunroof) list.push({ label: 'Sunroof', zone: 'sunroof', w: 800, h: 450, qty: 1, minutes: 30, areaM2: 0.36 });
  return list;
}

function zoneShades(film: FilmLite, rule: LegalRule, goals: Goals, input: AdvisorInput, zones: Zone[]) {
  const target = PRIVACY_TARGET[Math.round(clamp(goals.privacy, 0, 5))];
  const out: Partial<Record<Zone, { shade: Shade | null; legalFilmMin: number; note?: string }>> = {};
  for (const z of zones) {
    if (input.segment !== 'automotive') {
      const desired = Math.max(target, goals.clarity >= 4 ? 50 : 0);
      out[z] = { shade: nearestShade(film.shades, desired, 0), legalFilmMin: 0 };
      continue;
    }
    if (z === 'windscreen') {
      // Visor strip: darkest shade is fine because it sits above the AS-1 line.
      const darkest = [...film.shades].sort((a, b) => a.vlt - b.vlt)[0] || null;
      out[z] = { shade: rule.windscreenStripPct > 0 ? darkest : null, legalFilmMin: 0, note: rule.windscreen };
      continue;
    }
    const min = zoneMin(rule, z);
    const glass = factoryGlass(z, !!input.privacyRear);
    const legalFilmMin = min > 0 ? Math.ceil(((min - rule.tolerance) / glass)) : 0;
    const shade = nearestShade(film.shades, Math.max(target, legalFilmMin), legalFilmMin);
    out[z] = {
      shade,
      legalFilmMin,
      note: shade ? undefined : legalFilmMin > 100 ? 'Factory glass is already at the legal limit — leave untinted.' : `No shade of this film is light enough (needs ≥ ${legalFilmMin}% film).`,
    };
  }
  return out;
}

export function runAdvisor(films: FilmLite[], input: AdvisorInput) {
  const goals: Goals = { ...DEFAULT_GOALS, ...(input.goals || {}) } as Goals;
  for (const k of Object.keys(goals) as (keyof Goals)[]) goals[k] = clamp(Number(goals[k]) || 0, 0, 5);
  const rule = getRule(input.segment === 'automotive' ? input.region : 'NONE');
  const panes = resolvePanes(input);
  const trim = input.trimMm ?? 10;
  const zones = Array.from(new Set(panes.map((p) => p.zone)));
  const totalArea = panes.reduce((s, p) => s + p.areaM2, 0);
  const maxArea = panes.reduce((m, p) => Math.max(m, (p.w * p.h) / 1e6), 0);
  const maxEdge = panes.reduce((m, p) => Math.max(m, p.w, p.h), 0);
  const glassType = input.glassType || (input.segment === 'automotive' ? 'toughened' : 'single_clear');
  const labourRate = input.labourRate ?? 55;
  const climate = input.climate || 'hot';

  const candidates = films.filter((f) => f.segments.includes(input.segment) && f.shades && f.shades.length);
  const sells = candidates.map((f) => f.sellPerM2);
  const minSell = Math.min(...sells, Infinity);
  const maxSell = Math.max(...sells, -Infinity);

  const results = candidates.map((film) => {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let penalty = 0;
    const compat = film.glassCompat?.[glassType] || 'ok';
    if (compat === 'no') return null;
    if (compat === 'caution') { penalty += 0.1; warnings.push(`Check the film maker's glass chart before applying to ${glassType.replace('_', ' ')} glass.`); }

    const shades = zoneShades(film, rule, goals, input, zones.length ? zones : (['rearSides'] as Zone[]));
    const primaryZone: Zone = zones.includes('rearSides') ? 'rearSides' : zones[0] || 'rearSides';
    const primary = shades[primaryZone]?.shade || [...film.shades].sort((a, b) => b.vlt - a.vlt)[0];
    for (const z of zones) if (shades[z]?.note && !shades[z]?.shade) warnings.push(`${zoneLabel(z)}: ${shades[z]!.note}`);

    const target = PRIVACY_TARGET[Math.round(goals.privacy)];
    const s = {
      heat: primary.tser / 100,
      uv: film.uvr / 100,
      glare: primary.glare / 100,
      privacy: film.category === 'frost' ? 1 : 1 - Math.min(1, Math.abs(primary.vlt - target) / 65),
      clarity: (primary.vlt / 100) * (1 - film.reflectivity),
      security: film.category === 'safety' ? 1 : film.thicknessMil >= 4 ? 0.6 : 0.05,
      budget: maxSell > minSell ? 1 - (film.sellPerM2 - minSell) / (maxSell - minSell) : 1,
    };
    const weights = goals;
    const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    let score = (Object.keys(s) as (keyof Goals)[]).reduce((acc, k) => acc + s[k] * weights[k], 0) / totalW;

    if (input.segment === 'automotive' && (input.preferSignalSafe ?? true) && !film.signalSafe) {
      penalty += 0.12;
      warnings.push('Metallised film can interfere with GPS, toll tags, keyless entry and phone signal.');
    }
    if (input.segment === 'automotive' && film.reflectivity > 0.1) {
      penalty += 0.1;
      warnings.push(`Exterior reflectance ${Math.round(film.reflectivity * 100)}% exceeds the 10% automotive limit.`);
    }
    const stress = thermalStress({ segment: input.segment, glassType, absorptance: primary.absorptance, maxAreaM2: maxArea, maxEdgeMm: maxEdge, orientation: input.orientation, hemisphere: rule.hemisphere, shading: input.shading });
    if (stress.level === 'high') { penalty += 0.25; warnings.push('High thermal-stress risk — glass breakage possible with this film.'); }
    else if (stress.level === 'medium') { penalty += 0.08; warnings.push('Medium thermal-stress risk — confirm with the film manufacturer.'); }

    score = clamp(score - penalty);

    // Positive reasons — strongest contributors first.
    const contrib = (Object.keys(s) as (keyof Goals)[]).map((k) => ({ k, v: s[k] * weights[k] })).sort((a, b) => b.v - a.v);
    for (const { k } of contrib.slice(0, 3)) {
      if (k === 'heat') reasons.push(`Rejects ${primary.tser}% of total solar energy${film.irr ? ` and ${film.irr}% of infrared heat` : ''}.`);
      if (k === 'uv') reasons.push(`Blocks ${film.uvr}% of UV — protects skin and interiors from fading.`);
      if (k === 'glare') reasons.push(`Cuts glare by ${primary.glare}%.`);
      if (k === 'privacy') reasons.push(`${primary.vlt}% VLT matches your privacy goal.`);
      if (k === 'clarity') reasons.push(`Keeps a clear view out (${primary.vlt}% VLT, low reflectance).`);
      if (k === 'security') reasons.push(film.category === 'safety' ? 'Holds shattered glass together — security & safety rated.' : `${film.thicknessMil} mil construction adds shatter resistance.`);
      if (k === 'budget') reasons.push(`Good value at $${film.sellPerM2}/m² installed.`);
    }
    if (film.signalSafe && input.segment === 'automotive') reasons.push('Non-metal construction — no signal interference.');

    // Material & cut plan.
    const pieces = panes.map((p) => ({ label: p.label, w: p.w, h: p.h, qty: p.qty }));
    const cut = pieces.length ? bestCut(pieces, film.rollWidths, trim).best : null;
    const materialM2 = cut ? cut.materialM2 : 0;
    const labourHours = input.segment === 'automotive'
      ? panes.reduce((t, p) => t + (p.minutes || 20) * p.qty, 0) / 60 + (input.removal ? 1.5 : 0) + 0.25
      : totalArea / (input.segment === 'commercial' ? 5 : 4) + 0.5 + (input.removal ? totalArea / 6 : 0);
    const removalCharge = input.removal ? Math.max(120, totalArea * 25) : 0;
    // Automotive work is labour-heavy: film per m² + charged-out labour. Flat glass is quoted per installed m².
    const sell = input.segment === 'automotive'
      ? Math.max(180, totalArea * film.sellPerM2 + labourHours * (input.chargeOutRate ?? 70)) + removalCharge
      : Math.max(250, totalArea * film.sellPerM2) + removalCharge;
    const costMaterial = materialM2 * film.costPerM2;
    const costLabour = labourHours * labourRate;
    const margin = sell - costMaterial - costLabour;

    // Stock check against inventory for this film.
    const rolls = (input.stock || []).filter((r) => String(r.filmId) === String(film._id));
    const stockM2 = rolls.reduce((t, r) => t + (r.remainingM2 || 0), 0);

    const compliance = input.segment === 'automotive'
      ? zones.map((z) => {
          const sh = shades[z]?.shade || null;
          const c = checkZone(rule, z, sh ? sh.vlt : null, !!input.privacyRear);
          return { zone: z, label: zoneLabel(z), filmVlt: sh ? sh.vlt : null, ...c, ok: z === 'windscreen' ? true : c.ok, message: z === 'windscreen' ? rule.windscreen : c.message };
        })
      : [];

    return {
      film: { _id: film._id, name: film.name, brand: film.brand, category: film.category, tintColor: film.tintColor, warrantyYears: film.warrantyYears, signalSafe: film.signalSafe, sellPerM2: film.sellPerM2, costPerM2: film.costPerM2 },
      shade: primary,
      zoneShades: Object.fromEntries(zones.map((z) => [z, shades[z]?.shade?.vlt ?? null])),
      score: Math.round(score * 100),
      reasons: reasons.slice(0, 4),
      warnings,
      perf: { vlt: primary.vlt, tser: primary.tser, irr: film.irr, uvr: film.uvr, glare: primary.glare },
      thermal: stress,
      compliance,
      pricing: {
        glassM2: r2(totalArea),
        materialM2: r2(materialM2),
        linearM: cut ? cut.linearM : 0,
        rollWidth: cut ? cut.rollWidth : film.rollWidths[0],
        wastePct: cut ? cut.wastePct : 0,
        labourHours: r2(labourHours),
        costMaterial: r2(costMaterial),
        costLabour: r2(costLabour),
        sell: r2(sell),
        margin: r2(margin),
        marginPct: sell > 0 ? Math.round((margin / sell) * 100) : 0,
      },
      stock: { availableM2: r2(stockM2), enough: stockM2 >= materialM2, rolls: rolls.length },
      cut,
    };
  });

  const ranked = results.filter(Boolean).sort((a, b) => b!.score - a!.score) as NonNullable<(typeof results)[number]>[];
  const best = ranked[0] || null;

  const widthsForPanes = best ? candidates.find((f) => f._id === best.film._id)?.rollWidths || [1524] : [1524];
  const paneRows = panes.map((p) => {
    const fit = bestRollForPane(p.w, p.h, widthsForPanes, trim);
    const zoneShade = best ? best.zoneShades[p.zone] : null;
    return {
      label: p.label,
      zone: p.zone,
      zoneLabel: zoneLabel(p.zone),
      widthMm: Math.round(p.w),
      heightMm: Math.round(p.h),
      qty: p.qty,
      areaM2: r2(p.areaM2),
      legalMinVlt: input.segment === 'automotive' ? zoneMin(rule, p.zone) : null,
      recommendedVlt: zoneShade,
      rollWidth: fit.rollWidth,
      fits: fit.fits,
      drops: fit.drops,
      cutSize: `${Math.round(p.w + trim * 2)} × ${Math.round(p.h + trim * 2)} mm`,
      note: fit.fits ? `Cut from ${fit.rollWidth} mm roll` : `Exceeds widest roll — ${fit.drops} drops with seam`,
    };
  });

  // Energy & comfort estimate for the best option.
  let savings = null as null | { heatBlockedW: number; kwhYear: number; dollarsYear: number; paybackYears: number | null; cabinTempDropC: number | null; co2KgYear: number };
  if (best) {
    const irr = input.segment === 'automotive' ? 520 : ORIENT_IRRADIANCE[rule.hemisphere][(input.orientation || 'W').toUpperCase()] || 450;
    const heatBlockedW = totalArea * irr * (best.perf.tser / 100) * 0.82;
    const kwh = input.segment === 'automotive' ? 0 : (heatBlockedW / 1000) * COOLING_HOURS[climate] / 3;
    const rate = input.electricityRate ?? 0.32;
    const dollars = kwh * rate;
    savings = {
      heatBlockedW: Math.round(heatBlockedW),
      kwhYear: Math.round(kwh),
      dollarsYear: Math.round(dollars),
      paybackYears: dollars > 0 ? r2(best.pricing.sell / dollars) : null,
      cabinTempDropC: input.segment === 'automotive' ? Math.round(best.perf.tser * 0.17) : null,
      co2KgYear: Math.round(kwh * 0.68),
    };
  }

  const summary = best ? buildSummary(input, rule, best, paneRows.length, savings) : 'No compatible film found for this glass and segment. Add films for this segment in the Film Library.';

  return {
    input: { ...input, goals },
    legal: input.segment === 'automotive' ? rule : null,
    panes: paneRows,
    totals: { panes: paneRows.reduce((t, p) => t + p.qty, 0), glassM2: r2(totalArea) },
    best,
    ranked: ranked.slice(0, 8),
    savings,
    summary,
  };
}

export function zoneLabel(z: Zone) {
  return ({ windscreen: 'Windscreen', frontSides: 'Front side windows', rearSides: 'Rear side windows', rearWindscreen: 'Rear windscreen', sunroof: 'Sunroof' } as Record<Zone, string>)[z] || z;
}

function buildSummary(input: AdvisorInput, rule: LegalRule, best: any, paneCount: number, savings: any) {
  const p = best.pricing;
  const parts: string[] = [];
  parts.push(`Best match: ${best.film.brand ? best.film.brand + ' ' : ''}${best.film.name} (score ${best.score}/100).`);
  if (input.segment === 'automotive') {
    const z = best.zoneShades;
    const bits: string[] = [];
    if (z.frontSides != null) bits.push(`${z.frontSides}% on the front sides`);
    if (z.rearSides != null) bits.push(`${z.rearSides}% on the rear sides`);
    if (z.rearWindscreen != null) bits.push(`${z.rearWindscreen}% on the rear windscreen`);
    if (bits.length) parts.push(`Run ${bits.join(', ')} — the darkest legal combination for ${rule.name}.`);
  } else {
    parts.push(`${best.shade.vlt}% VLT shade rejects ${best.perf.tser}% of solar energy.`);
  }
  parts.push(`${paneCount} pane groups · ${p.glassM2} m² of glass → cut from a ${p.rollWidth} mm roll using ${p.linearM} linear m (${p.materialM2} m², ${p.wastePct}% waste).`);
  parts.push(`Suggested price $${p.sell.toLocaleString()} · est. ${p.labourHours} h labour · ${p.marginPct}% margin.`);
  if (savings?.dollarsYear) parts.push(`Saves ≈ ${savings.kwhYear} kWh ($${savings.dollarsYear}) of cooling a year — payback in ${savings.paybackYears} years.`);
  if (savings?.cabinTempDropC) parts.push(`Parked cabin up to ~${savings.cabinTempDropC}°C cooler in direct sun.`);
  if (best.thermal.level !== 'low') parts.push(`Thermal stress risk: ${best.thermal.level}.`);
  if (!best.stock.enough) parts.push(`Stock check: only ${best.stock.availableM2} m² on hand — reorder before booking.`);
  return parts.join(' ');
}

export type { CutPlan };
