/**
 * Window-tint legal limits (minimum combined Visible Light Transmission, %).
 * Values are general guidance — always confirm with the local road authority.
 */
export type LegalRule = {
  code: string;
  name: string;
  hemisphere: 'south' | 'north';
  frontSideMin: number;
  rearSideMin: number;
  rearWindscreenMin: number;
  windscreen: string; // human-readable windscreen rule
  windscreenStripPct: number; // % of windscreen height allowed at the top (0 = none)
  tolerance: number; // measurement tolerance, % points
  notes: string;
};

export const LEGAL_RULES: LegalRule[] = [
  { code: 'AU-WA', name: 'Australia — Western Australia', hemisphere: 'south', frontSideMin: 35, rearSideMin: 20, rearWindscreenMin: 20, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Rear limits apply when the vehicle has both external side mirrors.' },
  { code: 'AU-NSW', name: 'Australia — New South Wales', hemisphere: 'south', frontSideMin: 35, rearSideMin: 20, rearWindscreenMin: 20, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Reflectance must not exceed 10%.' },
  { code: 'AU-VIC', name: 'Australia — Victoria', hemisphere: 'south', frontSideMin: 35, rearSideMin: 20, rearWindscreenMin: 20, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Reflectance must not exceed 10%.' },
  { code: 'AU-QLD', name: 'Australia — Queensland', hemisphere: 'south', frontSideMin: 35, rearSideMin: 20, rearWindscreenMin: 20, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Reflectance must not exceed 10%.' },
  { code: 'AU-SA', name: 'Australia — South Australia', hemisphere: 'south', frontSideMin: 35, rearSideMin: 20, rearWindscreenMin: 20, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Reflectance must not exceed 10%.' },
  { code: 'AU-TAS', name: 'Australia — Tasmania', hemisphere: 'south', frontSideMin: 35, rearSideMin: 20, rearWindscreenMin: 20, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Reflectance must not exceed 10%.' },
  { code: 'AU-ACT', name: 'Australia — ACT', hemisphere: 'south', frontSideMin: 35, rearSideMin: 20, rearWindscreenMin: 20, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Reflectance must not exceed 10%.' },
  { code: 'AU-NT', name: 'Australia — Northern Territory', hemisphere: 'south', frontSideMin: 35, rearSideMin: 15, rearWindscreenMin: 15, windscreen: 'Top 10% visor strip only', windscreenStripPct: 10, tolerance: 3, notes: 'Darker rear limit (15%) than other states.' },
  { code: 'NZ', name: 'New Zealand', hemisphere: 'south', frontSideMin: 35, rearSideMin: 35, rearWindscreenMin: 35, windscreen: 'Top strip above wiper sweep only', windscreenStripPct: 10, tolerance: 0, notes: 'Vans and utes may run 20% behind the driver.' },
  { code: 'IN', name: 'India', hemisphere: 'north', frontSideMin: 50, rearSideMin: 50, rearWindscreenMin: 70, windscreen: 'Minimum 70% VLT, no dark strip', windscreenStripPct: 0, tolerance: 0, notes: 'CMVR Rule 100 — confirm current enforcement locally.' },
  { code: 'UK', name: 'United Kingdom', hemisphere: 'north', frontSideMin: 70, rearSideMin: 0, rearWindscreenMin: 0, windscreen: 'Minimum 75% VLT', windscreenStripPct: 0, tolerance: 0, notes: 'No limit behind the B-pillar.' },
  { code: 'US-CA', name: 'United States — California', hemisphere: 'north', frontSideMin: 70, rearSideMin: 0, rearWindscreenMin: 0, windscreen: 'Top 4 inches only (non-reflective)', windscreenStripPct: 8, tolerance: 0, notes: 'Dual side mirrors required if rear glass is tinted.' },
  { code: 'US-TX', name: 'United States — Texas', hemisphere: 'north', frontSideMin: 25, rearSideMin: 0, rearWindscreenMin: 0, windscreen: 'Top 5 inches / AS-1 line, 25% min', windscreenStripPct: 10, tolerance: 3, notes: 'Rear windscreen any darkness with dual mirrors.' },
  { code: 'US-FL', name: 'United States — Florida', hemisphere: 'north', frontSideMin: 28, rearSideMin: 15, rearWindscreenMin: 15, windscreen: 'Above AS-1 line only', windscreenStripPct: 10, tolerance: 3, notes: 'Reflectance limits: 25% front / 35% rear.' },
  { code: 'AE', name: 'United Arab Emirates', hemisphere: 'north', frontSideMin: 50, rearSideMin: 50, rearWindscreenMin: 50, windscreen: 'No tint on windscreen', windscreenStripPct: 0, tolerance: 0, notes: 'Up to 50% tint permitted on side and rear glass.' },
  { code: 'NONE', name: 'No restriction / off-road / custom', hemisphere: 'south', frontSideMin: 0, rearSideMin: 0, rearWindscreenMin: 0, windscreen: 'Unrestricted', windscreenStripPct: 100, tolerance: 0, notes: 'Use for show vehicles, private property or custom rules.' },
];

export function getRule(code?: string): LegalRule {
  return LEGAL_RULES.find((r) => r.code === code) || LEGAL_RULES[0];
}

export type Zone = 'windscreen' | 'frontSides' | 'rearSides' | 'rearWindscreen' | 'sunroof';

/** Factory glass transmission (fraction) before any film. */
export function factoryGlass(zone: Zone, privacyRear = false) {
  if (zone === 'windscreen') return 0.78;
  if (zone === 'sunroof') return 0.3;
  if (zone === 'frontSides') return 0.85;
  return privacyRear ? 0.25 : 0.85;
}

export function zoneMin(rule: LegalRule, zone: Zone) {
  if (zone === 'frontSides') return rule.frontSideMin;
  if (zone === 'rearSides') return rule.rearSideMin;
  if (zone === 'rearWindscreen') return rule.rearWindscreenMin;
  if (zone === 'windscreen') return rule.windscreenStripPct >= 100 ? 0 : 70;
  return 0;
}

/** Combined VLT (%) of film over factory glass. */
export function combinedVlt(filmVlt: number, zone: Zone, privacyRear = false) {
  return Math.round(filmVlt * factoryGlass(zone, privacyRear) * 10) / 10;
}

export function checkZone(rule: LegalRule, zone: Zone, filmVlt: number | null, privacyRear = false) {
  if (filmVlt === null || filmVlt === undefined) return { ok: true, combined: Math.round(factoryGlass(zone, privacyRear) * 100), min: zoneMin(rule, zone), message: 'No film' };
  const combined = combinedVlt(filmVlt, zone, privacyRear);
  const min = zoneMin(rule, zone);
  if (zone === 'windscreen' && rule.windscreenStripPct < 100) {
    return { ok: false, combined, min, message: `Full windscreen film not permitted — ${rule.windscreen}` };
  }
  const ok = combined + rule.tolerance >= min;
  return { ok, combined, min, message: ok ? `Legal (${combined}% ≥ ${min}%)` : `Too dark (${combined}% < ${min}% minimum)` };
}
