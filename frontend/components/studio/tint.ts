import type { Film, LegalRule } from '@/lib/types';

export type TintZone = 'frontSides' | 'rearSides' | 'rearWindscreen' | 'sunroof';
export const TINT_ZONES: { key: TintZone; label: string; short: string }[] = [
  { key: 'frontSides', label: 'Front side windows', short: 'Front sides' },
  { key: 'rearSides', label: 'Rear side windows & quarters', short: 'Rear sides' },
  { key: 'rearWindscreen', label: 'Rear windscreen', short: 'Rear screen' },
  { key: 'sunroof', label: 'Sunroof', short: 'Sunroof' },
];

export type ZoneTint = { filmId: string | null; vlt: number | null };
export type Finish = 'gloss' | 'metallic' | 'pearl' | 'matte';
export type EnvKey = 'day' | 'sunset' | 'night' | 'studio';
export type CameraKey = 'front' | 'side' | 'rear' | 'top' | 'inside';
export type WheelColor = 'silver' | 'black' | 'gunmetal' | 'bronze' | 'chrome';

export type CarConfig = {
  bodyType: string;
  paint: string;
  finish: Finish;
  roof: 'body' | 'black';
  chromeDelete: boolean;
  wheelColor: WheelColor;
  wheelSize: 17 | 19 | 21;
  privacyRear: boolean;
  sunroof: boolean;
  visor: { enabled: boolean; filmId: string | null; vlt: number | null };
  region: string;
  zones: Record<TintZone, ZoneTint>;
};

export const DEFAULT_CONFIG: CarConfig = {
  bodyType: 'suv',
  paint: '#f2f3f5',
  finish: 'pearl',
  roof: 'body',
  chromeDelete: false,
  wheelColor: 'gunmetal',
  wheelSize: 19,
  privacyRear: false,
  sunroof: false,
  visor: { enabled: false, filmId: null, vlt: null },
  region: 'AU-WA',
  zones: {
    frontSides: { filmId: null, vlt: null },
    rearSides: { filmId: null, vlt: null },
    rearWindscreen: { filmId: null, vlt: null },
    sunroof: { filmId: null, vlt: null },
  },
};

export const PAINTS = [
  { name: 'Pearl white', hex: '#f2f3f5' },
  { name: 'Silver', hex: '#b9bec5' },
  { name: 'Graphite', hex: '#4a4f57' },
  { name: 'Eclipse black', hex: '#121316' },
  { name: 'Soul red', hex: '#9b1b22' },
  { name: 'Deep blue', hex: '#1d3a6e' },
  { name: 'Performance blue', hex: '#2f6fd1' },
  { name: 'British green', hex: '#1f4a35' },
  { name: 'Sand', hex: '#c8b28d' },
  { name: 'Gravity gold', hex: '#8a7a55' },
  { name: 'Sunburst orange', hex: '#e2621b' },
  { name: 'Nardo grey', hex: '#7c8186' },
];

export const WHEEL_COLORS: Record<WheelColor, { label: string; hex: string; metal: number; rough: number }> = {
  silver: { label: 'Silver', hex: '#c7ccd2', metal: 0.85, rough: 0.3 },
  chrome: { label: 'Chrome', hex: '#e9edf1', metal: 1, rough: 0.08 },
  gunmetal: { label: 'Gunmetal', hex: '#53585f', metal: 0.8, rough: 0.35 },
  black: { label: 'Gloss black', hex: '#141518', metal: 0.5, rough: 0.25 },
  bronze: { label: 'Bronze', hex: '#8a6a3c', metal: 0.85, rough: 0.35 },
};

/** Factory glass transmission (fraction) — mirrors backend/lib/engine/legal.ts. */
export function factoryGlass(zone: TintZone | 'windscreen', privacyRear = false) {
  if (zone === 'windscreen') return 0.78;
  if (zone === 'sunroof') return 0.3;
  if (zone === 'frontSides') return 0.85;
  return privacyRear ? 0.25 : 0.85;
}

export function combinedVlt(zone: TintZone | 'windscreen', filmVlt: number | null, privacyRear = false) {
  const g = factoryGlass(zone, privacyRear);
  return Math.round((filmVlt == null ? 100 : filmVlt) * g * 10) / 10;
}

export function zoneMin(rule: LegalRule | undefined, zone: TintZone) {
  if (!rule) return 0;
  if (zone === 'frontSides') return rule.frontSideMin;
  if (zone === 'rearSides') return rule.rearSideMin;
  if (zone === 'rearWindscreen') return rule.rearWindscreenMin;
  return 0;
}

export type ZoneCheck = { zone: TintZone | 'windscreen'; label: string; combined: number; min: number; ok: boolean; note: string };

export function compliance(cfg: CarConfig, rule?: LegalRule): ZoneCheck[] {
  const out: ZoneCheck[] = [];
  for (const z of TINT_ZONES) {
    if (z.key === 'sunroof' && !cfg.sunroof) continue;
    const combined = combinedVlt(z.key, cfg.zones[z.key].vlt, cfg.privacyRear);
    const min = zoneMin(rule, z.key);
    const ok = combined + (rule?.tolerance || 0) >= min;
    out.push({ zone: z.key, label: z.short, combined, min, ok, note: ok ? (min ? `≥ ${min}% required` : 'No limit') : `Below ${min}% minimum` });
  }
  const stripOk = !cfg.visor.enabled || (rule ? rule.windscreenStripPct > 0 : true);
  out.unshift({
    zone: 'windscreen',
    label: 'Windscreen',
    combined: combinedVlt('windscreen', null),
    min: 0,
    ok: stripOk,
    note: cfg.visor.enabled ? (stripOk ? `Visor strip OK (top ${rule?.windscreenStripPct ?? 10}%)` : 'No strip permitted') : rule?.windscreen || 'Factory glass',
  });
  return out;
}

/** Visual glass appearance for a combined VLT. */
export function glassLook(combined: number, film: Film | undefined | null) {
  const darkness = Math.max(0, Math.min(1, 1 - combined / 100));
  return {
    color: film?.tintColor || '#9fb7c6',
    opacity: Math.min(0.97, 0.14 + 0.84 * Math.pow(darkness, 0.85)),
    metalness: Math.min(0.9, (film?.reflectivity ?? 0.06) * 1.6),
    roughness: 0.04,
  };
}

/** Picks the shade of a film closest to a target VLT (preferring lighter on ties). */
export function closestShade(film: Film | undefined, target: number) {
  if (!film?.shades?.length) return null;
  return [...film.shades].sort((a, b) => Math.abs(a.vlt - target) - Math.abs(b.vlt - target) || b.vlt - a.vlt)[0].vlt;
}

/** Darkest legal film shade for a zone. */
export function darkestLegal(film: Film | undefined, zone: TintZone, rule: LegalRule | undefined, privacyRear: boolean) {
  if (!film?.shades?.length) return null;
  const min = zoneMin(rule, zone);
  const g = factoryGlass(zone, privacyRear);
  const legal = film.shades.filter((s) => s.vlt * g + (rule?.tolerance || 0) >= min).sort((a, b) => a.vlt - b.vlt);
  return legal.length ? legal[0].vlt : null;
}

export function heatRejection(cfg: CarConfig, films: Film[]) {
  const vals: number[] = [];
  for (const z of TINT_ZONES) {
    if (z.key === 'sunroof' && !cfg.sunroof) continue;
    const t = cfg.zones[z.key];
    const f = films.find((x) => x._id === t.filmId);
    const s = f?.shades.find((x) => x.vlt === t.vlt);
    vals.push(s ? s.tser : 0);
  }
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}
