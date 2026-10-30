import type { Zone } from './legal';

export type GlassPane = { key: string; label: string; zone: Zone; width: number; height: number; qty: number; minutes: number };

export type BodyType = {
  key: string;
  label: string;
  examples: string;
  privacyRearCommon: boolean;
  panes: GlassPane[];
};

const side = (prefix: string, label: string, zone: Zone, w: number, h: number, minutes: number): GlassPane[] => [
  { key: `${prefix}_l`, label: `${label} left`, zone, width: w, height: h, qty: 1, minutes },
  { key: `${prefix}_r`, label: `${label} right`, zone, width: w, height: h, qty: 1, minutes },
];

/** Typical glass sizes (mm) per body style — a starting point the installer verifies on the car. */
export const BODY_TYPES: BodyType[] = [
  {
    key: 'sedan', label: 'Sedan', examples: 'Toyota Camry, Tesla Model 3, Mazda 6', privacyRearCommon: false,
    panes: [
      ...side('front', 'Front door', 'frontSides', 900, 500, 20),
      ...side('rear', 'Rear door', 'rearSides', 780, 470, 20),
      ...side('quarter', 'Rear quarter', 'rearSides', 260, 180, 12),
      { key: 'rear_screen', label: 'Rear windscreen', zone: 'rearWindscreen', width: 1300, height: 600, qty: 1, minutes: 60 },
    ],
  },
  {
    key: 'hatch', label: 'Hatchback', examples: 'Toyota Corolla hatch, Hyundai i30, VW Golf', privacyRearCommon: false,
    panes: [
      ...side('front', 'Front door', 'frontSides', 850, 480, 20),
      ...side('rear', 'Rear door', 'rearSides', 650, 430, 18),
      ...side('quarter', 'Rear quarter', 'rearSides', 320, 210, 12),
      { key: 'rear_screen', label: 'Rear windscreen', zone: 'rearWindscreen', width: 1050, height: 520, qty: 1, minutes: 50 },
    ],
  },
  {
    key: 'suv', label: 'SUV', examples: 'Toyota RAV4, Tesla Model Y, Mazda CX-5, LandCruiser', privacyRearCommon: true,
    panes: [
      ...side('front', 'Front door', 'frontSides', 950, 560, 22),
      ...side('rear', 'Rear door', 'rearSides', 850, 520, 22),
      ...side('quarter', 'Rear quarter', 'rearSides', 600, 380, 18),
      { key: 'rear_screen', label: 'Rear windscreen', zone: 'rearWindscreen', width: 1150, height: 600, qty: 1, minutes: 55 },
    ],
  },
  {
    key: 'wagon', label: 'Wagon', examples: 'Subaru Outback, Skoda Octavia wagon', privacyRearCommon: false,
    panes: [
      ...side('front', 'Front door', 'frontSides', 920, 520, 20),
      ...side('rear', 'Rear door', 'rearSides', 800, 480, 20),
      ...side('quarter', 'Rear quarter', 'rearSides', 650, 360, 18),
      { key: 'rear_screen', label: 'Rear windscreen', zone: 'rearWindscreen', width: 1100, height: 560, qty: 1, minutes: 55 },
    ],
  },
  {
    key: 'ute', label: 'Dual-cab ute', examples: 'Toyota Hilux, Ford Ranger, Mazda BT-50', privacyRearCommon: false,
    panes: [
      ...side('front', 'Front door', 'frontSides', 900, 540, 22),
      ...side('rear', 'Rear door', 'rearSides', 650, 500, 20),
      { key: 'rear_screen', label: 'Rear cab glass', zone: 'rearWindscreen', width: 1350, height: 380, qty: 1, minutes: 35 },
    ],
  },
  {
    key: 'single_cab', label: 'Single-cab ute', examples: 'Hilux workmate single cab, Isuzu D-Max SC', privacyRearCommon: false,
    panes: [
      ...side('front', 'Door', 'frontSides', 950, 540, 22),
      { key: 'rear_screen', label: 'Rear cab glass', zone: 'rearWindscreen', width: 1400, height: 400, qty: 1, minutes: 35 },
    ],
  },
  {
    key: 'coupe', label: 'Coupe', examples: 'BMW 4 Series, Ford Mustang, Toyota GR86', privacyRearCommon: false,
    panes: [
      ...side('front', 'Frameless door', 'frontSides', 1050, 450, 28),
      ...side('quarter', 'Rear quarter', 'rearSides', 450, 300, 15),
      { key: 'rear_screen', label: 'Rear windscreen', zone: 'rearWindscreen', width: 1200, height: 550, qty: 1, minutes: 65 },
    ],
  },
  {
    key: 'van', label: 'Van / people mover', examples: 'Toyota HiAce, Kia Carnival, Ford Transit', privacyRearCommon: true,
    panes: [
      ...side('front', 'Front door', 'frontSides', 800, 550, 22),
      ...side('slider', 'Sliding door', 'rearSides', 900, 550, 25),
      ...side('quarter', 'Rear quarter', 'rearSides', 1000, 500, 25),
      { key: 'rear_l', label: 'Rear barn door left', zone: 'rearWindscreen', width: 500, height: 450, qty: 1, minutes: 20 },
      { key: 'rear_r', label: 'Rear barn door right', zone: 'rearWindscreen', width: 500, height: 450, qty: 1, minutes: 20 },
    ],
  },
];

export const OPTIONAL_PANES: GlassPane[] = [
  { key: 'visor', label: 'Windscreen visor strip', zone: 'windscreen', width: 1450, height: 120, qty: 1, minutes: 20 },
  { key: 'sunroof', label: 'Sunroof', zone: 'sunroof', width: 800, height: 450, qty: 1, minutes: 30 },
];

export function getBody(key?: string) {
  return BODY_TYPES.find((b) => b.key === key) || BODY_TYPES[2];
}

/** Rough body-type guess from a make/model string (used when AI detection is unavailable). */
export function guessBodyType(text: string) {
  const t = text.toLowerCase();
  if (/(hilux|ranger|bt-?50|d-?max|navara|triton|tundra|f-?150|amarok|gladiator|ute|pickup|colorado)/.test(t)) return 'ute';
  if (/(hiace|transit|carnival|sprinter|trafic|staria|odyssey|van)/.test(t)) return 'van';
  if (/(mustang|gr86|brz|coupe|camaro|370z|supra|4 series|911)/.test(t)) return 'coupe';
  if (/(outback|wagon|estate|levorg)/.test(t)) return 'wagon';
  if (/(corolla hatch|i30|golf|yaris|mazda ?2|mazda ?3 hatch|polo|swift|hatch|fiesta|jazz)/.test(t)) return 'hatch';
  if (/(model y|rav4|cx-?5|cx-?9|landcruiser|prado|tucson|sportage|seltos|everest|santa fe|x-?trail|outlander|forester|kluger|suv|ioniq 5|macan|q5|x5|glc|tiguan|pajero|fortuner|creta|xuv)/.test(t)) return 'suv';
  return 'sedan';
}
