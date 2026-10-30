import type { Segment, Stage } from './types';

let currency = 'AUD';
let locale = 'en-AU';
export function setCurrency(code: string) {
  currency = code || 'AUD';
  locale = currency === 'INR' ? 'en-IN' : currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-AU';
}

export function money(n: number | null | undefined, opts: { cents?: boolean; compact?: boolean } = {}) {
  const v = Number(n) || 0;
  if (opts.compact && Math.abs(v) >= 10000) return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v);
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: opts.cents === false ? 0 : 2, maximumFractionDigits: opts.cents === false ? 0 : 2 }).format(v);
}

export function num(n: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(n) || 0);
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + days));
}

export function parseDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-10-30" → "Fri 30 Oct" */
export function fmtDate(date?: string | null, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!date) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseDate(date) : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, opts);
}

export function fmtDateTime(date?: string | null) {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function fmtTime(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${ap}`;
}

export function timeAgo(date?: string | null) {
  if (!date) return '';
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 45) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function minutesBetween(a: string, b: string) {
  const t = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  return t(b) - t(a);
}

export function initials(name?: string) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const SEGMENT_META: Record<Segment, { label: string; color: string; bg: string; hex: string }> = {
  automotive: { label: 'Automotive', color: 'text-indigo-600 dark:text-indigo-300', bg: 'bg-indigo-500/10', hex: '#6366f1' },
  residential: { label: 'Residential', color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/10', hex: '#10b981' },
  commercial: { label: 'Commercial', color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500/10', hex: '#f59e0b' },
};

export const STAGES: { key: Stage; label: string; hex: string }[] = [
  { key: 'lead', label: 'New lead', hex: '#94a3b8' },
  { key: 'consultation', label: 'Consultation', hex: '#38bdf8' },
  { key: 'measurements', label: 'Measurements', hex: '#22d3ee' },
  { key: 'proposal', label: 'Proposal', hex: '#818cf8' },
  { key: 'approval', label: 'Approval', hex: '#a78bfa' },
  { key: 'scheduled', label: 'Scheduled', hex: '#f472b6' },
  { key: 'in_progress', label: 'In progress', hex: '#fb923c' },
  { key: 'invoicing', label: 'Invoicing', hex: '#facc15' },
  { key: 'closed', label: 'Job closed', hex: '#34d399' },
];
export const stageMeta = (s: string) => STAGES.find((x) => x.key === s) || STAGES[0];

export const APPT_STATUS: Record<string, { label: string; tone: Tone }> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  dispatched: { label: 'Dispatched', tone: 'warning' },
  checked_in: { label: 'Checked in', tone: 'primary' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const SHOP_STATUS: Record<string, { label: string; tone: Tone }> = {
  booked: { label: 'Booked', tone: 'neutral' },
  arrived: { label: 'Arrived', tone: 'info' },
  in_bay: { label: 'In Bay', tone: 'primary' },
  installing: { label: 'Installing', tone: 'warning' },
  ready: { label: 'Ready for Pickup', tone: 'success' },
  collected: { label: 'Collected', tone: 'neutral' },
};
export const PROPOSAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  viewed: { label: 'Viewed', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
};
export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  none: { label: 'No invoice', tone: 'neutral' },
  deposit: { label: 'Deposit paid', tone: 'info' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
  partial: { label: 'Partially paid', tone: 'warning' },
  paid: { label: 'Paid in full', tone: 'success' },
};

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function vehicleLabel(v?: { year?: string; make?: string; model?: string }) {
  return [v?.year, v?.make, v?.model].filter(Boolean).join(' ');
}

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));

export const UNIT_MM: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
export function paneArea(p: { width: number; height: number; unit?: string; qty?: number }) {
  const f = UNIT_MM[p.unit || 'mm'] || 1;
  return ((Number(p.width) || 0) * f * (Number(p.height) || 0) * f * Math.max(1, Number(p.qty) || 1)) / 1e6;
}
