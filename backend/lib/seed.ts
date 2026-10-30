import bcrypt from 'bcryptjs';
import {
  Activity, Admin, Automation, Contact, Dealer, Film, LeadForm, Note, Package, Project, Review, Roll, Service, Settings, Staff, Store, Template, nextSeq,
} from './models';
import { addDays, todayStr, uid } from './http';
import { BODY_TYPES } from './engine/vehicles';
import { buildInvoice, proposalTotals, measuredArea } from './project';

export const DEFAULT_ROLES = [
  { key: 'owner', name: 'Owner / administrator', description: 'Protected full-access role for administration and recovery.', protected: true, permissions: 'full' },
  { key: 'manager', name: 'Store manager', description: 'Manage day-to-day delivery, customers and store operations.', permissions: 'standard' },
  { key: 'sales', name: 'Sales consultant', description: 'Manage enquiries and quotations without deleting history.', permissions: 'standard' },
  { key: 'installer', name: 'Installer', description: 'Capture onsite work without access to customer finances.', permissions: 'restricted' },
];

export async function ensureSeed() {
  if ((await Admin.countDocuments()) === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@totalops.app').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';
    await Admin.create({ name: process.env.ADMIN_NAME || 'Workspace Admin', email, passwordHash: await bcrypt.hash(password, 10) });
    console.log(`[seed] admin created: ${email}`);
  }
  if (!(await Settings.exists({ key: 'workspace' }))) {
    await Settings.create({
      key: 'workspace',
      business: {
        name: 'TotalOps Window Tinting',
        email: 'hello@totalops.app',
        phone: '08 9581 0000',
        address: '123 Pinjarra Rd, Mandurah WA 6210',
        abn: '12 345 678 901',
        taxRate: 10,
        taxLabel: 'GST',
        currency: 'AUD',
        website: 'https://totalops.app',
      },
      region: 'AU-WA',
      defaults: {
        labourRate: 55,
        chargeOutRate: 70,
        electricityRate: 0.32,
        trimMm: 10,
        validDays: 30,
        depositPercent: 50,
        terms: '50% deposit to secure booking. Balance due on completion. Manufacturer warranty included.',
        invoiceDueDays: 14,
      },
      measurementProfiles: {
        automotive: { title: 'Vehicle coverage', groupLabel: 'Area', unit: 'mm', dimensions: true, sections: ['dimensions', 'film', 'removal', 'photos', 'cut'] },
        residential: { title: 'Home glass survey', groupLabel: 'Room', unit: 'mm', dimensions: true, sections: ['dimensions', 'glazing', 'exposure', 'film', 'photos', 'cut'] },
        commercial: { title: 'Building glazing survey', groupLabel: 'Level / zone', unit: 'mm', dimensions: true, sections: ['dimensions', 'glazing', 'exposure', 'access', 'film', 'photos', 'cut'] },
      },
      roles: DEFAULT_ROLES,
    });
  }
  if ((await Store.countDocuments()) === 0) {
    await seedDemo();
    console.log('[seed] demo workspace created');
  }
}

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

async function seedDemo() {
  const today = todayStr();
  const d = (n: number) => addDays(today, n);

  /* Stores */
  const stores = await Store.insertMany([
    { name: 'Mandurah', code: 'MDH', address: '123 Pinjarra Rd, Mandurah WA 6210', phone: '08 9581 0001', color: '#6366f1', lat: -32.536, lng: 115.744, bays: ['Bay 1', 'Bay 2', 'Bay 3', 'Mobile Bay', 'Inspection Bay'] },
    { name: 'Rockingham', code: 'RKH', address: '28 Dixon Road, Rockingham WA 6168', phone: '08 9527 0002', color: '#0ea5e9', lat: -32.278, lng: 115.735, bays: ['Bay 1', 'Bay 2', 'Clean Bay', 'Mobile Bay'] },
    { name: 'Jandakot', code: 'JDK', address: '6 Armadale Road, Jandakot WA 6164', phone: '08 9414 0003', color: '#10b981', lat: -32.103, lng: 115.871, bays: ['Bay 1', 'Fleet Bay', 'Clean Bay 2', 'Mobile Bay'] },
    { name: 'Cannington', code: 'CNG', address: '142 Albany Highway, Cannington WA 6107', phone: '08 9356 0004', color: '#f59e0b', lat: -32.017, lng: 115.935, bays: ['Bay 1', 'Bay 2', 'Prep Station', 'Mobile Bay'] },
  ]);
  const [MDH, RKH, JDK, CNG] = stores;

  /* Team */
  const staff = await Staff.insertMany([
    { name: 'Jake Reynolds', role: 'installer', title: 'Senior Automotive Lead', storeId: MDH._id, phone: '0412 100 201', skills: ['Rear glass shrink', 'Tesla specialist'], color: '#6366f1', rating: 4.9 },
    { name: 'Liam Davis', role: 'installer', title: 'Automotive Installer', storeId: MDH._id, phone: '0412 100 202', skills: ['Ceramic IR', 'Visor strips'], color: '#8b5cf6', rating: 4.8 },
    { name: 'Ben Harrison', role: 'installer', title: 'Commercial Tint Specialist', storeId: MDH._id, phone: '0412 100 203', skills: ['Security film', 'High-reach scaffolding'], color: '#a855f7', rating: 4.7 },
    { name: 'Ryan Cooper', role: 'installer', title: 'Master Automotive Installer', storeId: RKH._id, phone: '0412 100 204', skills: ['Nano-ceramic', 'ComputerCut precision'], color: '#0ea5e9', rating: 4.9 },
    { name: 'Mia Zhang', role: 'installer', title: 'PPF & Automotive Tech', storeId: RKH._id, phone: '0412 100 205', skills: ['Ceramic tint', 'Windshield visor'], color: '#06b6d4', rating: 4.8 },
    { name: 'Lucas Vance', role: 'installer', title: 'Mobile Residential Specialist', storeId: RKH._id, phone: '0412 100 206', skills: ['Balustrade frosting', 'Glare reduction'], color: '#14b8a6', rating: 4.6 },
    { name: 'Sam Taylor', role: 'installer', title: 'Commercial Solar & Safety Lead', storeId: JDK._id, phone: '0412 100 207', skills: ['Solar heat control', 'Boom lift certified'], color: '#10b981', rating: 4.8 },
    { name: 'Alex Morgan', role: 'installer', title: 'Fleet & Commercial Vehicle Tech', storeId: JDK._id, phone: '0412 100 208', skills: ['Fleet batch tinting', 'Security mesh'], color: '#22c55e', rating: 4.7 },
    { name: 'Jordan Bell', role: 'installer', title: 'Ceramic IR Specialist', storeId: JDK._id, phone: '0412 100 209', skills: ['Ceramic windshield', 'Frameless doors'], color: '#84cc16', rating: 4.9 },
    { name: 'Matt Sanders', role: 'installer', title: 'Automotive Installer', storeId: CNG._id, phone: '0412 100 210', skills: ['Full SUV package', 'Heat gun shaping'], color: '#f59e0b', rating: 4.7 },
    { name: 'Ella Watson', role: 'installer', title: 'Residential Solar & Privacy Tech', storeId: CNG._id, phone: '0412 100 211', skills: ['French doors', 'Low-E thermal film'], color: '#f97316', rating: 4.8 },
    { name: 'Noah Davies', role: 'installer', title: 'Commercial Installer', storeId: CNG._id, phone: '0412 100 212', skills: ['Anti-graffiti', 'Retail glazing'], color: '#ef4444', rating: 4.6 },
    { name: 'Ava Collins', role: 'manager', title: 'Office & Operations Manager', storeId: MDH._id, phone: '0412 100 213', email: 'ava@totalops.app', color: '#ec4899', hoursPerWeek: 38 },
    { name: 'Chloe Martin', role: 'sales', title: 'Sales Consultant', storeId: RKH._id, phone: '0412 100 214', email: 'chloe@totalops.app', color: '#d946ef', hoursPerWeek: 38 },
  ]);
  const installersOf = (storeId: unknown) => staff.filter((s) => s.role === 'installer' && String(s.storeId) === String(storeId));

  /* Films */
  const S = (vlt: number, tser: number, glare: number, absorptance: number) => ({ vlt, tser, glare, absorptance });
  const autoOnly = ['automotive'];
  const flat = ['residential', 'commercial'];
  const films = await Film.insertMany([
    { name: 'Prime XR Plus', brand: 'XPEL', line: 'Prime', category: 'ceramic', segments: autoOnly, irr: 98, uvr: 99.9, reflectivity: 0.06, signalSafe: true, tintColor: '#11151b', warrantyYears: 25, rollWidths: [1016, 1524], costPerM2: 38, sellPerM2: 150, tier: 4, description: 'Flagship multi-layer nano-ceramic. Up to 98% infrared rejection with no signal interference.', shades: [S(5, 66, 94, 0.55), S(15, 63, 83, 0.5), S(20, 61, 77, 0.48), S(35, 56, 61, 0.42), S(50, 50, 44, 0.36), S(70, 46, 22, 0.3)] },
    { name: 'Ceramic IR', brand: '3M', line: 'Ceramic IR Series', category: 'ceramic', segments: autoOnly, irr: 95, uvr: 99.9, reflectivity: 0.07, signalSafe: true, tintColor: '#14181e', warrantyYears: 25, rollWidths: [1016, 1524], costPerM2: 32, sellPerM2: 125, tier: 3, description: 'Nano-ceramic IR heat shield. Legal 35% front / 20% rear packages.', shades: [S(5, 62, 93, 0.53), S(15, 59, 82, 0.49), S(25, 55, 70, 0.45), S(35, 52, 60, 0.41), S(50, 47, 42, 0.35), S(70, 42, 20, 0.28)] },
    { name: 'Crystalline', brand: '3M', line: 'Crystalline', category: 'crystalline', segments: ['automotive', 'residential', 'commercial'], irr: 97, uvr: 99.9, reflectivity: 0.09, signalSafe: true, tintColor: '#2a3540', warrantyYears: 25, rollWidths: [1016, 1524, 1830], costPerM2: 55, sellPerM2: 185, tier: 5, description: '200+ layer spectrally selective film — rejects heat while staying almost clear.', glassCompat: { double_glazed: 'caution', low_e: 'caution' }, shades: [S(40, 56, 52, 0.34), S(50, 53, 43, 0.32), S(70, 50, 21, 0.3), S(90, 34, 4, 0.24)] },
    { name: 'CIR Ceramic', brand: 'SunTek', line: 'CIR', category: 'ceramic', segments: autoOnly, irr: 88, uvr: 99, reflectivity: 0.07, signalSafe: true, tintColor: '#15191f', warrantyYears: 15, rollWidths: [1016, 1524], costPerM2: 26, sellPerM2: 105, tier: 3, description: 'Carbon-ceramic construction with excellent colour stability.', shades: [S(5, 58, 92, 0.52), S(15, 55, 81, 0.48), S(20, 53, 75, 0.46), S(35, 48, 58, 0.4), S(50, 43, 40, 0.33)] },
    { name: 'CTX Ceramic', brand: 'LLumar', line: 'CTX', category: 'ceramic', segments: autoOnly, irr: 88, uvr: 99, reflectivity: 0.08, signalSafe: true, tintColor: '#171a20', warrantyYears: 15, rollWidths: [1016, 1524], costPerM2: 24, sellPerM2: 98, tier: 2, description: 'Value nano-ceramic with neutral charcoal look.', shades: [S(5, 57, 92, 0.52), S(20, 51, 75, 0.46), S(35, 46, 58, 0.4), S(50, 41, 40, 0.33)] },
    { name: 'Carbon Classic', brand: 'LLumar', line: 'ATC', category: 'carbon', segments: autoOnly, irr: 45, uvr: 99, reflectivity: 0.05, signalSafe: true, tintColor: '#1a1a1c', warrantyYears: 10, rollWidths: [1016, 1524], costPerM2: 14, sellPerM2: 68, tier: 2, description: 'Colour-stable carbon film with a classic matte charcoal factory aesthetic.', shades: [S(5, 50, 93, 0.6), S(15, 45, 82, 0.56), S(20, 43, 76, 0.54), S(35, 37, 58, 0.48), S(50, 32, 40, 0.42)] },
    { name: 'SunSmart Auto Film', brand: 'SunSmart', line: 'Dyed', category: 'dyed', segments: autoOnly, irr: 15, uvr: 99, reflectivity: 0.05, signalSafe: true, tintColor: '#1b1b20', warrantyYears: 5, rollWidths: [1016, 1524], costPerM2: 8, sellPerM2: 48, tier: 1, description: 'Entry-level dyed film. Great privacy, modest heat rejection; may fade over time.', shades: [S(5, 42, 93, 0.68), S(15, 37, 82, 0.62), S(20, 35, 76, 0.6), S(35, 29, 58, 0.52)] },
    { name: 'XP Solar Hybrid', brand: '3M', line: 'XP', category: 'metallic', segments: autoOnly, irr: 70, uvr: 99, reflectivity: 0.13, signalSafe: false, tintColor: '#1d2329', warrantyYears: 10, rollWidths: [1524], costPerM2: 18, sellPerM2: 72, tier: 2, description: 'Metallised hybrid — strong heat rejection but can affect GPS/keyless signals.', shades: [S(15, 58, 83, 0.4), S(20, 55, 77, 0.38), S(35, 49, 58, 0.34)] },
    { name: 'Silver 20 Heat Reject', brand: 'Solar Gard', line: 'Silver', category: 'reflective', segments: flat, irr: 85, uvr: 99, reflectivity: 0.48, signalSafe: false, tintColor: '#8c97a3', warrantyYears: 12, rollWidths: [1524, 1830], costPerM2: 15, sellPerM2: 88, tier: 2, glassCompat: { single_tinted: 'caution', double_glazed: 'caution', low_e: 'no', laminated: 'caution' }, description: 'Highly reflective mirror film — maximum heat rejection and daytime privacy.', shades: [S(15, 82, 85, 0.3), S(20, 79, 80, 0.28), S(35, 68, 62, 0.26)] },
    { name: 'Dual Reflective 25', brand: 'Madico', line: 'Dual Reflective', category: 'reflective', segments: flat, irr: 78, uvr: 99, reflectivity: 0.3, signalSafe: false, tintColor: '#4b535c', warrantyYears: 12, rollWidths: [1524, 1830], costPerM2: 17, sellPerM2: 92, tier: 3, glassCompat: { low_e: 'caution', double_glazed: 'caution' }, description: 'Reflective outside, low reflectance inside — clear night-time views.', shades: [S(15, 75, 84, 0.38), S(25, 70, 72, 0.36), S(35, 64, 60, 0.33)] },
    { name: 'Vista Spectrally Selective', brand: 'LLumar', line: 'Vista', category: 'spectrally_selective', segments: ['residential'], irr: 90, uvr: 99.9, reflectivity: 0.09, signalSafe: true, tintColor: '#3a4652', warrantyYears: 25, rollWidths: [1524, 1830], costPerM2: 30, sellPerM2: 135, tier: 4, description: 'Premium home film — natural light, minimal tint, fade protection for floors and furniture.', shades: [S(40, 55, 50, 0.38), S(50, 51, 42, 0.36), S(70, 45, 20, 0.33)] },
    { name: 'Prestige 70', brand: '3M', line: 'Prestige', category: 'spectrally_selective', segments: flat, irr: 97, uvr: 99.9, reflectivity: 0.08, signalSafe: true, tintColor: '#55636f', warrantyYears: 25, rollWidths: [1524, 1830], costPerM2: 45, sellPerM2: 155, tier: 5, description: 'Non-metal multilayer — almost invisible, rejects up to 97% of infrared.', shades: [S(40, 59, 54, 0.36), S(50, 54, 44, 0.34), S(60, 50, 32, 0.32), S(70, 47, 22, 0.3)] },
    { name: 'DR Grey 15', brand: 'Avery Dennison', line: 'Dual Reflective', category: 'reflective', segments: flat, irr: 72, uvr: 99, reflectivity: 0.22, signalSafe: false, tintColor: '#2b2f35', warrantyYears: 10, rollWidths: [1524, 1830], costPerM2: 14, sellPerM2: 82, tier: 2, glassCompat: { double_glazed: 'caution', low_e: 'no', single_tinted: 'caution' }, description: 'Dark grey dual-reflective — strong privacy and glare control.', shades: [S(15, 72, 86, 0.52), S(25, 66, 74, 0.48), S(35, 59, 61, 0.44)] },
    { name: 'Safety & Security Ultra S800', brand: '3M', line: 'Ultra', category: 'safety', segments: flat, irr: 10, uvr: 99, reflectivity: 0.09, signalSafe: true, tintColor: '#c8d3dc', thicknessMil: 8, warrantyYears: 10, rollWidths: [1524, 1830], costPerM2: 40, sellPerM2: 165, tier: 4, description: '8 mil micro-layered safety film — holds shattered glass together.', shades: [S(88, 15, 2, 0.1)] },
    { name: 'Clear Safety Film 4 mil', brand: 'Solar Gard', line: 'Safety', category: 'safety', segments: flat, irr: 8, uvr: 99, reflectivity: 0.08, signalSafe: true, tintColor: '#d4dde5', thicknessMil: 4, warrantyYears: 10, rollWidths: [1524], costPerM2: 15, sellPerM2: 78, tier: 2, description: 'Optically clear safety film for Australian Standard AS/NZS 2208 upgrades.', shades: [S(89, 13, 2, 0.08)] },
    { name: 'Dusted Crystal Frost', brand: '3M', line: 'Fasara', category: 'frost', segments: flat, irr: 10, uvr: 99, reflectivity: 0.1, signalSafe: true, tintColor: '#e6ecf1', warrantyYears: 10, rollWidths: [1270, 1524], costPerM2: 22, sellPerM2: 115, tier: 3, description: 'Decorative etched-glass look — privacy for bathrooms, meeting rooms and balustrades.', shades: [S(75, 20, 10, 0.12)] },
    { name: 'Low-E Thermal', brand: 'LLumar', line: 'Energy Saver', category: 'low_e', segments: flat, irr: 80, uvr: 99, reflectivity: 0.12, signalSafe: false, tintColor: '#5f6973', warrantyYears: 15, rollWidths: [1524, 1830], costPerM2: 35, sellPerM2: 140, tier: 4, glassCompat: { low_e: 'no', double_glazed: 'caution' }, description: 'Year-round comfort: rejects summer heat and keeps winter warmth inside.', shades: [S(35, 63, 60, 0.4), S(50, 55, 42, 0.36), S(70, 46, 20, 0.3)] },
    { name: 'Anti-Graffiti Clear 6 mil', brand: 'Avery Dennison', line: 'Protective', category: 'protective', segments: ['commercial'], irr: 5, uvr: 98, reflectivity: 0.08, signalSafe: true, tintColor: '#dfe6ec', thicknessMil: 6, warrantyYears: 5, rollWidths: [1524], costPerM2: 18, sellPerM2: 85, tier: 2, description: 'Sacrificial clear layer that protects storefront glass from scratching and tagging.', shades: [S(90, 10, 2, 0.06)] },
  ]);
  const F = Object.fromEntries(films.map((f) => [`${f.brand} ${f.name}`, f]));
  const xpel = F['XPEL Prime XR Plus'], ceramic = F['3M Ceramic IR'], carbon = F['LLumar Carbon Classic'], vista = F['LLumar Vista Spectrally Selective'], silver = F['Solar Gard Silver 20 Heat Reject'], frost = F['3M Dusted Crystal Frost'], safety = F['3M Safety & Security Ultra S800'], suntek = F['SunTek CIR Ceramic'], prestige = F['3M Prestige 70'];

  /* Inventory rolls */
  const roll = (f: any, store: any, shade: number, widthMm: number, remainingM2: number, reorderAtM2: number, batch: string) => ({
    filmId: f._id, name: `${f.name} ${shade}`, brand: f.brand, shade, storeId: store._id, widthMm, lengthM: 30.5, remainingM2, reorderAtM2, costPerM2: f.costPerM2, sellPerM2: f.sellPerM2, batch, location: `Rack ${batch.slice(-1)}`,
    movements: [{ id: uid(), type: 'received', qty: Math.round((widthMm / 1000) * 30.5 * 100) / 100, note: 'Opening stock', at: new Date(Date.now() - 20 * 86400_000) }],
  });
  await Roll.insertMany([
    roll(xpel, MDH, 20, 1524, 31.4, 10, 'XP-2408-A'),
    roll(xpel, MDH, 35, 1524, 8.2, 10, 'XP-2408-B'),
    roll(ceramic, MDH, 20, 1524, 22.6, 8, 'CIR-2407-C'),
    roll(ceramic, RKH, 35, 1524, 6.1, 8, 'CIR-2406-A'),
    roll(ceramic, RKH, 20, 1016, 18.9, 6, 'CIR-2406-B'),
    roll(suntek, RKH, 15, 1524, 27.3, 8, 'ST-2405-A'),
    roll(carbon, JDK, 20, 1524, 35.0, 10, 'ATC-2409-A'),
    roll(carbon, JDK, 5, 1016, 4.3, 6, 'ATC-2409-B'),
    roll(vista, CNG, 50, 1524, 29.8, 12, 'VS-2408-A'),
    roll(silver, CNG, 20, 1830, 41.2, 15, 'SG-2410-A'),
    roll(frost, CNG, 75, 1524, 9.5, 10, 'FR-2403-A'),
    roll(safety, JDK, 88, 1524, 25.7, 10, 'S800-2402-A'),
    roll(prestige, MDH, 70, 1524, 33.1, 12, 'PR-2407-A'),
  ]);

  /* Service catalogue */
  const svc = await Service.insertMany([
    { name: '3M Ceramic IR', variant: '2 side windows only', segment: 'automotive', coverage: 'Front sides', unitPrice: 180, filmId: ceramic._id, minutes: 45, detail: 'Install 3M Ceramic IR to the two front side windows.' },
    { name: '3M Ceramic IR', variant: 'Sides & rear windscreen', segment: 'automotive', coverage: 'Sides & rear', unitPrice: 520, filmId: ceramic._id, minutes: 180, detail: 'Install 3M Ceramic IR to 4 sides & rear windscreen.' },
    { name: '3M Ceramic IR', variant: 'Darkest legal', segment: 'automotive', coverage: 'Sides & rear — darkest legal', unitPrice: 560, filmId: ceramic._id, minutes: 180, detail: 'Darkest legal combination for Western Australia (35% front / 20% rear).' },
    { name: 'XPEL Prime XR Plus', variant: 'Full vehicle', segment: 'automotive', coverage: 'Sides & rear', unitPrice: 690, filmId: xpel._id, minutes: 200, detail: 'Maximum infrared heat rejection (up to 98% IR), 99.9% UV protection, zero signal interference.' },
    { name: 'Carbon Classic', variant: 'Sides & rear', segment: 'automotive', coverage: 'Sides & rear', unitPrice: 330, filmId: carbon._id, minutes: 160, detail: 'Colour-stable carbon film · classic factory aesthetic.' },
    { name: 'SunSmart Auto Film', variant: 'Supply & install', segment: 'automotive', coverage: 'Sides & rear', unitPrice: 249, minutes: 150, detail: 'Supply & install SunSmart Auto Film.' },
    { name: 'Film Removal', variant: 'Small', segment: 'automotive', coverage: 'With film installation', unitPrice: 80, minutes: 30, detail: 'We will take all care when removing existing window tint but cannot guarantee rear demister bars will be operational.' },
    { name: 'Film Removal', variant: 'Medium', segment: 'automotive', coverage: 'With film installation', unitPrice: 120, minutes: 45, detail: 'Remove existing film to allow installation of new window tint.' },
    { name: 'Film Removal', variant: 'Large', segment: 'automotive', coverage: 'With film installation', unitPrice: 160, minutes: 60, detail: 'Remove existing film to allow installation of new window tint.' },
    { name: 'Film Removal', variant: 'XLarge', segment: 'automotive', coverage: 'Removal of existing film only', unitPrice: 220, minutes: 90, detail: 'Removal of existing film only.' },
    { name: 'Rear Windscreen', variant: 'Remove & install new', segment: 'automotive', coverage: 'Rear windscreen', unitPrice: 180, minutes: 75, detail: 'Remove degraded film and install new film to the rear windscreen.' },
    { name: 'Side Window', variant: 'Remove & install (1 of)', segment: 'automotive', coverage: 'Single side window', unitPrice: 70, minutes: 25 },
    { name: 'Glare Strip', variant: 'Windscreen visor', segment: 'automotive', coverage: 'Top 10% of windscreen', unitPrice: 60, minutes: 20 },
    { name: 'Gtechniq Crystal Serum Ultra', variant: 'Paint protection', segment: 'automotive', coverage: 'Medium vehicles', unitPrice: 890, minutes: 300 },
    { name: 'Thinkware Q850 64GB Dash Camera', variant: 'Supply & install', segment: 'automotive', coverage: 'Front & rear', unitPrice: 549, minutes: 90 },
    { name: 'Water Spot Remover', variant: 'Glass treatment', segment: 'automotive', coverage: 'All glass', unitPrice: 45, minutes: 20 },
    { name: 'Solar-control film', variant: 'Supply & install', segment: 'residential', coverage: 'Measured glass area', unit: 'm2', unitPrice: 110, filmId: vista._id, minutes: 15, detail: 'Solar-control film · measured glass area · supply & installation.' },
    { name: 'Spectrally selective film', variant: 'Supply & install', segment: 'residential', coverage: 'Measured glass area', unit: 'm2', unitPrice: 150, filmId: prestige._id, minutes: 15 },
    { name: 'Frost / privacy film', variant: 'Supply & install', segment: 'residential', coverage: 'Measured glass area', unit: 'm2', unitPrice: 120, filmId: frost._id, minutes: 15 },
    { name: 'Safety & security film', variant: 'Supply & install', segment: 'residential', coverage: 'Measured glass area', unit: 'm2', unitPrice: 165, filmId: safety._id, minutes: 18 },
    { name: 'Site survey & measure', variant: 'Credited on acceptance', segment: 'residential', coverage: 'On site', unitPrice: 95, minutes: 60 },
    { name: 'Commercial solar film', variant: 'Supply & install', segment: 'commercial', coverage: 'Measured glass area', unit: 'm2', unitPrice: 95, filmId: silver._id, minutes: 12 },
    { name: 'Privacy glazing film', variant: 'Supply & install', segment: 'commercial', coverage: 'Measured glass area', unit: 'm2', unitPrice: 115, filmId: frost._id, minutes: 15 },
    { name: 'Anti-graffiti film', variant: 'Supply & install', segment: 'commercial', coverage: 'Measured glass area', unit: 'm2', unitPrice: 85, minutes: 12 },
    { name: 'After-hours installation', variant: 'Surcharge', segment: 'commercial', coverage: 'Per visit', unitPrice: 250, minutes: 0 },
    { name: 'Scissor lift hire', variant: 'Per day', segment: 'commercial', coverage: 'Access equipment', unitPrice: 320, minutes: 0 },
  ]);
  const svcBy = (name: string, variant?: string) => svc.find((s) => s.name === name && (!variant || s.variant === variant))!;
  const line = (s: any, qty = 1, price?: number) => ({ id: uid(), serviceId: String(s._id), name: `${s.name}${s.variant ? ` · ${s.variant}` : ''}`, coverage: s.coverage || '', detail: s.detail || '', qty, unitPrice: price ?? s.unitPrice });

  /* Proposal packages */
  const terms = '50% deposit to secure booking. Balance due on completion. Manufacturer warranty included.';
  const autoOptions = () => [
    { id: uid(), title: 'Nano-Ceramic IR (Sides & Rear)', filmLabel: 'Ceramic IR', group: 'Tint level', recommended: true, detail: 'Maximum solar infrared heat rejection (up to 88% IR), 99.9% UV protection, zero electronic signal interference.', discount: 0, lines: [line(svcBy('3M Ceramic IR', 'Sides & rear windscreen'))] },
    { id: uid(), title: 'Premium Carbon Film (Sides & Rear)', filmLabel: 'Carbon Classic', group: 'Tint level', recommended: false, detail: 'Rich charcoal matte finish, non-fading colour stability, and 99% UV blockage.', discount: 0, lines: [line(svcBy('Carbon Classic'))] },
    { id: uid(), title: 'Old Film Removal & Glass Prep (Optional)', filmLabel: 'De-tint & Prep', group: '', recommended: false, detail: 'Safe steam and chemical stripping of old bubbling or purple tint without defogger damage.', discount: 0, lines: [line(svcBy('Film Removal', 'Medium'))] },
  ];
  await Package.insertMany([
    { name: 'Automotive · ceramic package', segment: 'automotive', description: 'Ceramic vs carbon choice with optional de-tint.', validDays: 30, taxRate: 10, storeIds: stores.map((s) => s._id), intro: 'Hi {{first_name}}, here are your window tinting options. Choose the package that suits you best.', footer: 'Prices cover the work described. Installation is arranged after scope confirmation.', terms, afterApprovalMessage: 'Thank you! Our team will contact you to book your installation.', nextStepLabel: 'Book installation', deposit: { mode: 'percent', value: 50 }, options: autoOptions() },
    { name: 'Home · solar comfort', segment: 'residential', description: 'Measured-area pricing for rooms and elevations.', validDays: 30, taxRate: 10, storeIds: stores.map((s) => s._id), intro: 'Your home comfort proposal — each room can be accepted separately.', terms, deposit: { mode: 'percent', value: 50 }, options: [
      { id: uid(), title: 'Living areas · heat control', filmLabel: 'Vista 50', group: '', recommended: true, detail: 'Living room and west-facing lounge windows. Final dimensions verified onsite.', discount: 0, lines: [line(svcBy('Solar-control film'), 12)] },
      { id: uid(), title: 'Bedrooms · afternoon comfort', filmLabel: 'Vista 50', group: '', detail: 'Bedroom windows grouped for a separate customer choice.', discount: 0, lines: [line(svcBy('Solar-control film'), 6)] },
    ] },
    { name: 'Commercial · privacy upgrade', segment: 'commercial', description: 'Privacy glazing and site-survey line items.', validDays: 45, taxRate: 10, storeIds: stores.map((s) => s._id), intro: 'Two independent areas, individually reviewable.', terms: '30% deposit to schedule. Progress claims for multi-day installs.', deposit: { mode: 'percent', value: 30 }, options: [
      { id: uid(), title: 'Reception · privacy glazing', filmLabel: 'Dusted Crystal', group: '', recommended: true, detail: 'Ground-floor reception glazing. Work planned around office access.', discount: 0, lines: [line(svcBy('Privacy glazing film'), 18)] },
      { id: uid(), title: 'Meeting rooms · visual privacy', filmLabel: 'Dusted Crystal', group: '', detail: 'Meeting-room glazing can be accepted as a separate phase.', discount: 0, lines: [line(svcBy('Privacy glazing film'), 14)] },
    ] },
  ]);

  /* Message templates */
  const templates = await Template.insertMany([
    { name: 'Appointment reminder', channel: 'sms', purpose: 'reminder', body: 'Hi {{first_name}}, a reminder of your {{business}} appointment on {{date}} at {{time}} ({{store}}). Reply Y to confirm or call {{store_phone}}.' },
    { name: 'Proposal follow-up', channel: 'sms', purpose: 'follow_up', body: 'Hi {{first_name}}, just checking you received your tinting proposal for {{project}}. You can review and choose your options here: {{link}}' },
    { name: 'Your window tinting proposal', channel: 'email', purpose: 'proposal', subject: 'Your window tinting proposal', body: 'Hi {{first_name}},\n\nThanks for choosing {{business}}. Please review and approve your proposal here: {{link}}\n\nKind regards,\n{{business}}' },
    { name: 'Review request', channel: 'sms', purpose: 'review', body: 'Thanks for choosing {{business}}, {{first_name}}! If you are happy with your new tint, a quick Google review would mean the world to our team.' },
    { name: 'Installer on the way', channel: 'sms', purpose: 'dispatch', body: 'Hi {{first_name}}, our installer is on the way to your address. See you soon!' },
    { name: 'Vehicle ready', channel: 'sms', purpose: 'ready', body: 'Hi {{first_name}}, your {{vehicle}} is ready for pickup at {{store}}! Keep windows up for 48 hours while the film cures.' },
    { name: 'Deposit received', channel: 'sms', purpose: 'payment', body: 'Thanks {{first_name}} — we have received your deposit for {{project}}. Your booking is locked in.' },
  ]);
  const T = Object.fromEntries(templates.map((t) => [t.name, t]));

  /* Dealers */
  const dealers = await Dealer.insertMany([
    { name: "Brett's Prestige Auto", contactName: 'Brett Campbell', phone: '0400 555 101', email: 'brett@prestigeauto.example', storeId: MDH._id, token: uid() + uid() },
    { name: 'City Toyota Fleet', contactName: 'Hannah Lee', phone: '0400 555 102', email: 'fleet@citytoyota.example', storeId: RKH._id, token: uid() + uid() },
    { name: 'Premier Holden', contactName: 'Greg Walsh', phone: '0400 555 103', email: 'greg@premier.example', storeId: CNG._id, token: uid() + uid() },
  ]);

  /* Automations */
  await Automation.insertMany([
    { name: 'Consultation reminder', trigger: 'appointment_reminder', delayHours: 24, action: 'send_message', channel: 'sms', templateId: T['Appointment reminder']._id, enabled: true },
    { name: 'Proposal follow-up', trigger: 'proposal_no_response', delayHours: 48, action: 'send_message', channel: 'sms', templateId: T['Proposal follow-up']._id, enabled: true },
    { name: 'Review request', trigger: 'job_closed', delayHours: 2, action: 'send_message', channel: 'sms', templateId: T['Review request']._id, enabled: true },
    { name: 'Vehicle ready SMS', trigger: 'vehicle_ready', delayHours: 0, action: 'send_message', channel: 'sms', templateId: T['Vehicle ready']._id, enabled: true },
    { name: 'Deposit thank-you', trigger: 'deposit_paid', delayHours: 0, action: 'send_message', channel: 'sms', templateId: T['Deposit received']._id, enabled: true },
    { name: 'Call new leads fast', trigger: 'lead_created', delayHours: 0, action: 'create_task', message: 'Call {{name}} within 1 hour about "{{project}}" ({{number}}).', enabled: true },
    { name: 'Installer on the way', trigger: 'installer_dispatched', delayHours: 0, action: 'send_message', channel: 'sms', templateId: T['Installer on the way']._id, enabled: false },
  ]);

  /* Lead forms */
  await LeadForm.insertMany([
    { name: 'Website · Get a quote', slug: 'get-a-quote', heading: 'Let’s make your car more comfortable.', intro: 'Tell us about your vehicle and we will send a tailored proposal within one business day.', fields: ['Name', 'Email', 'Phone', 'Vehicle', 'Scope'], segment: 'automotive', storeId: MDH._id, active: true },
    { name: 'Home comfort enquiry', slug: 'home', heading: 'Let’s make your space more comfortable.', intro: 'Hotter rooms, glare or privacy issues? We will measure and quote on site.', fields: ['Name', 'Email', 'Phone', 'Address', 'Scope'], segment: 'residential', storeId: CNG._id, active: true },
    { name: 'Commercial enquiries', slug: 'commercial', heading: 'Tell us about your building.', intro: 'Solar control, privacy and safety film for offices, retail and industrial sites.', fields: ['Name', 'Company', 'Email', 'Phone', 'Address', 'Scope'], segment: 'commercial', storeId: JDK._id, active: true },
  ]);

  /* Contacts + projects */
  type Spec = { name: string; company?: string; seg: 'automotive' | 'residential' | 'commercial'; stage: string; store: number; title: string; vehicle?: [string, string, string, string, string]; rooms?: [string, number, number, number][]; source: string; dealer?: number; apptDay?: number; apptTime?: string; shop?: string; paid?: 'none' | 'deposit' | 'full'; proposalStatus?: string };
  const specs: Spec[] = [
    { name: 'Ryan Thompson', seg: 'automotive', stage: 'in_progress', store: 0, title: 'Tesla Model Y · Ceramic IR', vehicle: ['2024', 'Tesla', 'Model Y', 'suv', 'Pearl white'], source: 'Website', apptDay: 0, apptTime: '08:30', shop: 'installing', paid: 'deposit' },
    { name: 'Charlotte Adams', seg: 'automotive', stage: 'scheduled', store: 0, title: 'Ford Ranger · privacy package', vehicle: ['2023', 'Ford', 'Ranger Wildtrak', 'ute', 'Graphite'], source: 'Google Ads', dealer: 0, apptDay: 0, apptTime: '10:30', shop: 'arrived', paid: 'deposit' },
    { name: 'Liam Thompson', seg: 'automotive', stage: 'scheduled', store: 1, title: 'Mazda CX-5 · sides & rear', vehicle: ['2022', 'Mazda', 'CX-5', 'suv', 'Soul red'], source: 'Referral', apptDay: 0, apptTime: '09:00', shop: 'in_bay', paid: 'deposit' },
    { name: 'Grace Mitchell', seg: 'residential', stage: 'proposal', store: 3, title: 'Residential · Applecross · 24 m²', rooms: [['Living room', 2400, 2100, 2], ['Kitchen', 1800, 1200, 1], ['Master bedroom', 1500, 1200, 2]], source: 'Website', proposalStatus: 'sent' },
    { name: 'Ethan James', seg: 'automotive', stage: 'approval', store: 1, title: 'Kia Sportage · full tint', vehicle: ['2024', 'Kia', 'Sportage', 'suv', 'Silver'], source: 'Instagram', proposalStatus: 'viewed' },
    { name: 'West Coast Realty', company: 'West Coast Realty', seg: 'commercial', stage: 'measurements', store: 0, title: 'Commercial · Mandurah · 42 m²', rooms: [['Storefront glazing', 1800, 2400, 4], ['Boardroom partition', 1200, 2100, 2]], source: 'Phone call', apptDay: 2, apptTime: '13:00' },
    { name: 'Harper Clarke', seg: 'automotive', stage: 'closed', store: 2, title: 'Hyundai Tucson · heat rejection', vehicle: ['2023', 'Hyundai', 'Tucson', 'suv', 'Deep blue'], source: 'Google', apptDay: -6, apptTime: '09:00', paid: 'full' },
    { name: 'Aria Evans', seg: 'automotive', stage: 'invoicing', store: 0, title: 'Toyota Hilux · ceramic tint', vehicle: ['2024', 'Toyota', 'Hilux SR5', 'ute', 'Glacier white'], source: 'Website', apptDay: -2, apptTime: '08:00', paid: 'deposit' },
    { name: 'Henry Brown', seg: 'automotive', stage: 'consultation', store: 3, title: 'Tesla Model 3 · Ceramic IR', vehicle: ['2024', 'Tesla', 'Model 3', 'sedan', 'Midnight silver'], source: 'Website', apptDay: 1, apptTime: '11:00' },
    { name: 'Isla Roberts', seg: 'automotive', stage: 'lead', store: 1, title: 'Toyota RAV4 · full tint', vehicle: ['2023', 'Toyota', 'RAV4 Cruiser', 'suv', 'Graphite'], source: 'Instagram' },
    { name: 'Jack Walker', seg: 'automotive', stage: 'scheduled', store: 2, title: 'Ford Everest · ceramic tint', vehicle: ['2024', 'Ford', 'Everest Platinum', 'suv', 'Blue lightning'], source: 'Referral', dealer: 1, apptDay: 0, apptTime: '11:30', shop: 'booked', paid: 'none' },
    { name: 'Coastal Dental Group', company: 'Coastal Dental Group', seg: 'commercial', stage: 'scheduled', store: 1, title: 'Commercial · Rockingham office · 31 m²', rooms: [['Reception glazing', 2000, 2400, 3], ['Level 1 office', 1400, 1600, 6]], source: 'Phone call', apptDay: 3, apptTime: '07:30', paid: 'deposit' },
    { name: 'Leo Anderson', seg: 'residential', stage: 'closed', store: 1, title: 'Residential · Safety Bay · 18 m²', rooms: [['Living room east', 2400, 2100, 2], ['Balcony slider', 2100, 2100, 2]], source: 'Google', apptDay: -12, apptTime: '09:00', paid: 'full' },
    { name: 'Sienna Wright', seg: 'automotive', stage: 'proposal', store: 3, title: 'Mazda BT-50 · full tint', vehicle: ['2022', 'Mazda', 'BT-50', 'ute', 'Rock grey'], source: 'Website', proposalStatus: 'draft' },
    { name: 'Mason Harris', seg: 'automotive', stage: 'in_progress', store: 1, title: 'Ford Ranger · ceramic tint', vehicle: ['2023', 'Ford', 'Ranger XLT', 'ute', 'Arctic white'], source: 'Google Ads', dealer: 1, apptDay: 0, apptTime: '08:00', shop: 'ready', paid: 'deposit' },
    { name: 'Ava Bennett', seg: 'automotive', stage: 'closed', store: 0, title: 'Toyota Corolla · full tint', vehicle: ['2021', 'Toyota', 'Corolla Ascent hatch', 'hatch', 'Ink blue'], source: 'Repeat customer', apptDay: -20, apptTime: '10:00', paid: 'full' },
    { name: 'Fremantle Design Co.', company: 'Fremantle Design Co.', seg: 'commercial', stage: 'approval', store: 2, title: 'Commercial · Fremantle · 31 m²', rooms: [['Studio north glazing', 1800, 2400, 5], ['Meeting room', 1200, 2100, 3]], source: 'Referral', proposalStatus: 'approved' },
    { name: 'Noah Cooper', seg: 'residential', stage: 'measurements', store: 2, title: 'Residential · Cockburn · 20 m²', rooms: [['Bedroom window', 1500, 1200, 3], ['Bathroom window', 600, 900, 1]], source: 'Website', apptDay: 4, apptTime: '10:00' },
    { name: 'Zoe Parker', seg: 'automotive', stage: 'scheduled', store: 3, title: 'Hyundai i30 · sides & rear', vehicle: ['2022', 'Hyundai', 'i30 N Line', 'hatch', 'Performance blue'], source: 'Instagram', dealer: 2, apptDay: 0, apptTime: '13:00', shop: 'booked', paid: 'none' },
    { name: 'Hudson Lee', seg: 'automotive', stage: 'invoicing', store: 2, title: 'Toyota LandCruiser · ceramic', vehicle: ['2024', 'Toyota', 'LandCruiser 300', 'suv', 'Eclipse black'], source: 'Referral', apptDay: -1, apptTime: '08:00', paid: 'none' },
    { name: 'Olivia Carter', seg: 'automotive', stage: 'lead', store: 0, title: 'Kia Seltos · privacy package', vehicle: ['2023', 'Kia', 'Seltos', 'suv', 'Clear white'], source: 'Website' },
    { name: 'Archie Taylor', seg: 'automotive', stage: 'scheduled', store: 0, title: 'Toyota Camry · full tint', vehicle: ['2023', 'Toyota', 'Camry Ascent', 'sedan', 'Silver'], source: 'Phone call', dealer: 0, apptDay: 1, apptTime: '09:30', shop: 'booked', paid: 'deposit' },
    { name: 'Cannington Business Hub', company: 'Cannington Business Hub', seg: 'commercial', stage: 'proposal', store: 3, title: 'Commercial · Cannington · 38 m²', rooms: [['Lift lobby', 2400, 2700, 2], ['Level 1 west', 1500, 1800, 8]], source: 'Google', proposalStatus: 'sent' },
    { name: 'Lucas Morgan', seg: 'residential', stage: 'consultation', store: 0, title: 'Residential · Halls Head · west lounge', rooms: [['West lounge', 2400, 2100, 3]], source: 'Website', apptDay: 1, apptTime: '14:00' },
    { name: 'Mia Wilson', seg: 'automotive', stage: 'lead', store: 2, title: 'Porsche Macan EV · Ceramic IR', vehicle: ['2024', 'Porsche', 'Macan EV', 'suv', 'Gentian blue'], source: 'Instagram' },
    { name: 'Oscar White', seg: 'automotive', stage: 'closed', store: 3, title: 'Hyundai Ioniq 5 · full SUV package', vehicle: ['2024', 'Hyundai', 'Ioniq 5', 'suv', 'Gravity gold'], source: 'Google', apptDay: -3, apptTime: '09:00', paid: 'full' },
  ];

  const stageIdx = (s: string) => ['lead', 'consultation', 'measurements', 'proposal', 'approval', 'scheduled', 'in_progress', 'invoicing', 'closed'].indexOf(s);

  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    const store = stores[sp.store];
    const crew = installersOf(store._id);
    const lead = pick(crew, i);
    const contact = await Contact.create({
      name: sp.name,
      company: sp.company,
      email: `${sp.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@example.com`,
      phone: `04${String(10 + i).padStart(2, '0')} ${String(200 + i * 7).padStart(3, '0')} ${String(300 + i * 11).slice(-3)}`,
      address: sp.seg === 'automotive' ? '' : `${12 + i} ${pick(['Marina Quay', 'Ocean Drive', 'Albany Hwy', 'Wellington Rd', 'Latrobe Tce'], i)}, ${store.name} WA`,
      status: stageIdx(sp.stage) >= stageIdx('approval') ? 'active' : 'prospect',
      segment: sp.seg,
      source: sp.source,
      storeId: store._id,
      tags: sp.company ? ['Business'] : [],
    });

    const film = sp.seg === 'automotive' ? (i % 3 === 0 ? xpel : ceramic) : sp.seg === 'residential' ? vista : i % 2 ? frost : silver;
    let measurements: any = { groups: [], verified: false };
    let vehicle: any = {};
    let property: any = {};
    if (sp.vehicle) {
      const [year, make, model, body, color] = sp.vehicle;
      vehicle = { year, make, model, bodyType: body, color, rego: `1${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(66 + ((i * 3) % 24))}${100 + i * 13}`, stockPo: sp.dealer !== undefined ? `PO-${4500 + i}` : '' };
      const tpl = BODY_TYPES.find((b) => b.key === body)!;
      measurements = {
        groups: [{ id: uid(), name: 'Vehicle glass', panes: tpl.panes.map((p) => ({ id: uid(), label: p.label, zone: p.zone, windowType: 'Vehicle', width: p.width, height: p.height, unit: 'mm', qty: p.qty, filmId: String(film._id), selected: true })) }],
        verified: stageIdx(sp.stage) >= stageIdx('proposal'),
        measuredAt: stageIdx(sp.stage) >= stageIdx('measurements') ? new Date() : null,
      };
    }
    if (sp.rooms) {
      property = { type: sp.seg === 'commercial' ? 'Office / retail' : 'House', glazing: i % 2 ? 'Double glazed low-E' : 'Single clear', orientation: pick(['W', 'N', 'NW', 'E'], i), levels: sp.seg === 'commercial' ? 2 : 1, address: contact.address };
      measurements = {
        groups: sp.rooms.map(([room, w, h, q]) => ({ id: uid(), name: room, panes: Array.from({ length: q }, (_, k) => ({ id: uid(), label: q > 1 ? `Pane ${k + 1} of ${q}` : 'Fixed window', windowType: pick(['Fixed', 'Slider', 'Door', 'Awning'], k), width: w, height: h, unit: 'mm', qty: 1, filmId: String(film._id), selected: true })) })),
        verified: stageIdx(sp.stage) >= stageIdx('proposal'),
        measuredAt: stageIdx(sp.stage) >= stageIdx('proposal') ? new Date() : null,
      };
    }

    const appointments: any[] = [];
    const si = stageIdx(sp.stage);
    if (sp.apptDay !== undefined) {
      const isInstall = si >= stageIdx('scheduled');
      const [hh, mm] = (sp.apptTime || '09:00').split(':').map(Number);
      const hours = sp.seg === 'automotive' ? (isInstall ? 3 : 1) : isInstall ? 6 : 1.5;
      const endH = Math.min(17, hh + Math.floor(hours));
      const endM = mm + (hours % 1 ? 30 : 0);
      const end = `${String(endH + Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;
      const status = si >= stageIdx('invoicing') ? 'completed' : si === stageIdx('in_progress') ? 'checked_in' : 'scheduled';
      appointments.push({
        type: isInstall ? 'installation' : si === stageIdx('measurements') ? 'measurement' : 'consultation',
        date: d(sp.apptDay),
        start: sp.apptTime || '09:00',
        end,
        installerId: lead._id,
        coInstallerIds: sp.seg === 'commercial' && isInstall ? [pick(crew, i + 1)._id] : [],
        storeId: store._id,
        bay: sp.seg === 'automotive' ? pick(store.bays, i) : 'Mobile Bay',
        location: sp.seg === 'automotive' ? 'in_shop' : 'on_site',
        address: sp.seg === 'automotive' ? store.address : contact.address,
        status,
        shopStatus: sp.shop || (status === 'completed' ? 'collected' : 'booked'),
        dealer: sp.dealer !== undefined ? dealers[sp.dealer].name : '',
        notes: sp.seg === 'automotive' ? 'Customer drop-off confirmed. Photograph glass condition and confirm shade at check-in.' : 'Call 15 minutes before arrival. Protect floors and move furniture with homeowner.',
        checkedInAt: status !== 'scheduled' ? new Date() : undefined,
        completedAt: status === 'completed' ? new Date() : undefined,
      });
    }

    let proposal: any = null;
    if (si >= stageIdx('proposal')) {
      const area = measuredArea(measurements).areaM2;
      const options = sp.seg === 'automotive'
        ? autoOptions().slice(0, i % 2 ? 3 : 2)
        : [
            { id: uid(), title: sp.seg === 'commercial' ? 'Reception · privacy glazing' : 'Living areas · heat control', filmLabel: film.name, group: '', recommended: true, detail: 'Final dimensions verified onsite.', discount: 0, lines: [line(sp.seg === 'commercial' ? svcBy('Commercial solar film') : svcBy('Solar-control film'), Math.max(1, Math.round(area)))] },
          ];
      const status = sp.proposalStatus || (si >= stageIdx('scheduled') ? 'approved' : 'draft');
      proposal = {
        status,
        token: status === 'draft' ? null : uid() + uid(),
        intro: `Hi ${sp.name.split(' ')[0]}, thanks for the opportunity. Here are your options.`,
        footer: 'Prices cover the work described. Installation is arranged after scope confirmation. Please contact us with any questions.',
        terms,
        taxRate: 10,
        validUntil: d(30),
        deposit: { mode: 'percent', value: 50 },
        showScope: true,
        afterApprovalMessage: 'Thank you. Your choices have been recorded and our team will contact you to arrange the next step.',
        nextStepLabel: 'Book installation',
        options,
        internalSelection: [],
        selectedOptionIds: status === 'approved' ? options.filter((o) => !o.group || o.recommended).map((o) => o.id) : [],
        approvedBy: status === 'approved' ? sp.name : '',
        approvedAt: status === 'approved' ? new Date(Date.now() - 3 * 86400_000) : null,
        sentAt: status !== 'draft' ? new Date(Date.now() - (i % 4) * 86400_000 - 3600_000) : null,
        viewedAt: ['viewed', 'approved'].includes(status) ? new Date(Date.now() - 2 * 86400_000) : null,
      };
    }

    const num = await nextSeq('project');
    const doc: any = {
      number: `PRJ-${num}`,
      title: sp.title,
      segment: sp.seg,
      stage: sp.stage,
      storeId: store._id,
      ownerId: staff.find((s) => s.role === 'sales')!._id,
      contactId: contact._id,
      dealerId: sp.dealer !== undefined ? dealers[sp.dealer]._id : undefined,
      source: sp.source,
      priority: i % 7 === 0 ? 'high' : 'normal',
      tags: sp.dealer !== undefined ? ['Dealer'] : i % 5 === 0 ? ['Repeat customer'] : [],
      vehicle,
      property,
      location: { type: sp.seg === 'automotive' ? 'in_shop' : 'on_site', address: sp.seg === 'automotive' ? store.address : contact.address },
      requirements: sp.seg === 'automotive' ? 'Customer selected Ceramic IR. Keep removed film photos in project.' : 'Site access confirmed. Check pane dimensions before cutting.',
      filmId: film._id,
      filmShade: sp.seg === 'automotive' ? 20 : film.shades[0].vlt,
      measurements,
      appointments,
      install: si >= stageIdx('invoicing') ? { status: 'complete', completedAt: new Date() } : si === stageIdx('in_progress') ? { status: 'in_progress', checkedInAt: new Date() } : { status: 'pending' },
      proposal,
      messages: [],
      payments: [],
      archived: false,
    };
    if (si >= stageIdx('invoicing') && proposal) {
      doc.invoice = buildInvoice(doc, `INV-${await nextSeq('invoice', 2000)}`);
      doc.invoice.issuedAt = d(sp.apptDay ?? -1);
    }
    const total = doc.invoice ? doc.invoice.total : proposal ? proposalTotals(proposal).total : 0;
    if (sp.paid === 'deposit' && total) doc.payments.push({ kind: 'deposit', amount: Math.round(total * 0.5 * 100) / 100, method: 'Bank transfer', date: d(-5), reference: `DEP-${num}` });
    if (sp.paid === 'full' && total) {
      doc.payments.push({ kind: 'deposit', amount: Math.round(total * 0.5 * 100) / 100, method: 'Card · external terminal', date: d((sp.apptDay ?? -5) - 4), reference: `DEP-${num}` });
      doc.payments.push({ kind: 'payment', amount: Math.round((total - Math.round(total * 0.5 * 100) / 100) * 100) / 100, method: 'Card · external terminal', date: d(sp.apptDay ?? -1), reference: `RCPT-${num}` });
      doc.closedAt = new Date(Date.now() - 40 * 86400_000);
    }
    doc.value = total || (sp.seg === 'automotive' ? 520 : 2400);
    if (sp.stage === 'in_progress' || sp.stage === 'scheduled') {
      doc.messages.push({ direction: 'out', channel: 'sms', body: `Hi ${sp.name.split(' ')[0]}, your booking is confirmed for ${appointments[0]?.date} at ${appointments[0]?.start}.`, from: 'Office · Ava', simulated: true });
      doc.messages.push({ direction: 'in', channel: 'sms', body: 'Thanks! Can you please let me know approximately how long the tint installation will take?', from: sp.name, simulated: true });
    }
    await Project.create(doc);
  }

  // Spread invoice history across the last months so revenue charts have shape.
  const closedPast = await Project.find({ invoice: { $ne: null } }).lean<any[]>();
  for (let k = 0; k < closedPast.length; k++) {
    const p = closedPast[k];
    if (p.stage !== 'closed') continue;
    const monthsBack = (k % 6) + 1;
    const dt = new Date();
    dt.setMonth(dt.getMonth() - monthsBack);
    await Project.updateOne({ _id: p._id }, { $set: { 'invoice.issuedAt': todayStr(dt), createdAt: dt } });
  }

  /* Historic closed jobs — gives the revenue trend 12 months of data */
  const vehicles = [['Toyota', 'Corolla', 'hatch'], ['Mazda', 'CX-5', 'suv'], ['Ford', 'Ranger', 'ute'], ['Tesla', 'Model 3', 'sedan'], ['Kia', 'Sportage', 'suv'], ['Toyota', 'Hilux', 'ute']];
  for (let m = 1; m <= 11; m++) {
    for (let j = 0; j < 3 + (m % 3); j++) {
      const store = stores[(m + j) % 4];
      const v = vehicles[(m * 3 + j) % vehicles.length];
      const contact = await Contact.create({ name: `${pick(['Ruby', 'Thomas', 'Lily', 'James', 'Ella', 'Oliver', 'Sophie', 'William', 'Chloe', 'Lucas'], m + j)} ${pick(['Kennedy', 'Murphy', 'Nguyen', 'Smith', 'Brown', 'Wilson', 'Taylor', 'Martin'], m * 2 + j)}`, phone: `04${m}${j} 5${m}${j} ${100 + m * 10 + j}`, status: 'active', segment: 'automotive', source: pick(['Website', 'Google', 'Referral', 'Instagram', 'Repeat customer'], m + j), storeId: store._id });
      const dt = new Date();
      dt.setMonth(dt.getMonth() - m);
      dt.setDate(3 + j * 6);
      const date = todayStr(dt);
      const options = [{ id: uid(), title: `${v[0]} ${v[1]} · ceramic tint`, filmLabel: 'Ceramic IR', group: '', recommended: true, detail: '', discount: 0, lines: [line(svcBy('3M Ceramic IR', 'Sides & rear windscreen'), 1, 480 + ((m * 37 + j * 53) % 260))] }];
      const proposal = { status: 'approved', token: null, taxRate: 10, validUntil: date, deposit: { mode: 'percent', value: 50 }, options, selectedOptionIds: options.map((o) => o.id), approvedBy: contact.name, terms };
      const num = await nextSeq('project');
      const doc: any = { number: `PRJ-${num}`, title: `${v[0]} ${v[1]} · ceramic tint`, segment: 'automotive', stage: 'closed', storeId: store._id, contactId: contact._id, source: contact.source, vehicle: { year: String(2018 + (m % 6)), make: v[0], model: v[1], bodyType: v[2], color: pick(['White', 'Silver', 'Grey', 'Black', 'Blue'], m + j) }, filmId: ceramic._id, proposal, install: { status: 'complete' }, appointments: [{ type: 'installation', date, start: '09:00', end: '12:00', installerId: pick(installersOf(store._id), j)._id, storeId: store._id, bay: 'Bay 1', status: 'completed', shopStatus: 'collected' }], archived: false, createdAt: dt, closedAt: dt };
      doc.invoice = buildInvoice(doc, `INV-${await nextSeq('invoice', 2000)}`);
      doc.invoice.issuedAt = date;
      doc.payments = [{ kind: 'payment', amount: doc.invoice.total, method: 'Card · external terminal', date, reference: `RCPT-${num}` }];
      doc.value = doc.invoice.total;
      await Project.create(doc);
    }
  }

  /* Notes & tasks */
  const firstProjects = await Project.find({ archived: false, stage: { $ne: 'closed' } }).sort({ createdAt: 1 }).limit(8).lean<any[]>();
  await Note.insertMany([
    { kind: 'task', text: 'Review XPEL film roll inventory stock levels at Mandurah', assignedTo: 'Ava Collins', dueDate: today, author: 'Workspace Admin' },
    { kind: 'task', text: "Confirm residential measurements with customer before quoting", assignedTo: 'Chloe Martin', dueDate: today, projectId: firstProjects[3]?._id, author: 'Workspace Admin' },
    { kind: 'task', text: 'Send formal proposal for commercial survey', assignedTo: 'Chloe Martin', dueDate: d(1), projectId: firstProjects[5]?._id, author: 'Workspace Admin' },
    { kind: 'task', text: 'Follow up on unpaid invoice', assignedTo: 'Ava Collins', dueDate: today, projectId: firstProjects[7]?._id, author: 'Workspace Admin' },
    { kind: 'note', text: 'Customer selected Ceramic IR. Keep removed film photos in project.', projectId: firstProjects[0]?._id, author: 'Jake Reynolds' },
    { kind: 'note', text: 'Ready for booking. Customer is flexible after 12:00.', projectId: firstProjects[4]?._id, author: 'Chloe Martin' },
    { kind: 'reply', text: 'Customer asked for care instructions — sent the 48-hour cure sheet.', projectId: firstProjects[1]?._id, author: 'Liam Davis' },
    { kind: 'task', text: 'Order replacement 1524 mm Ceramic IR 35 roll for Rockingham', assignedTo: 'Ava Collins', dueDate: d(2), done: true, author: 'Workspace Admin' },
  ]);

  /* Reviews */
  const closed = await Project.find({ stage: 'closed' }).populate('contactId').limit(6).lean<any[]>();
  const quotes = ['Our home is noticeably cooler and the team left everything spotless.', 'Booked in, done in two hours and the car looks factory. Highly recommend!', 'Super professional — explained the legal shades and the ceramic film is amazing in summer.', 'Great communication from booking to pickup.'];
  await Review.insertMany(closed.slice(0, 4).map((p, k) => ({ projectId: p._id, customerName: p.contactId?.name || 'Customer', rating: k === 3 ? 4 : 5, quote: quotes[k], platform: 'Google', status: k < 2 ? 'published' : k === 2 ? 'sent' : 'draft', log: [] })));

  /* Activity feed */
  const recent = await Project.find({ stage: { $ne: 'closed' } }).sort({ updatedAt: -1 }).limit(6).lean<any[]>();
  const acts = [
    ['proposal', 'Proposal viewed', 'Customer opened the proposal link'],
    ['payment', 'Deposit paid', 'Deposit recorded via bank transfer'],
    ['appointment', 'Installation scheduled', 'Installer and bay reserved'],
    ['lead', 'New lead', 'Captured from Website · Get a quote'],
    ['measurement', 'Measurements saved', 'Measurement sheet verified by installer'],
    ['inventory', 'Low film stock', 'Ceramic IR 35 at Rockingham is below reorder level'],
  ];
  await Activity.insertMany(acts.map(([type, title, text], k) => ({ type, title, text: `${text} · ${recent[k]?.number || ''}`, projectId: recent[k]?._id, link: recent[k] ? `/projects/${recent[k]._id}` : '/inventory', read: k > 3, createdAt: new Date(Date.now() - k * 47 * 60_000) })));
}
