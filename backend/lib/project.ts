import { Activity, Contact, Store, Staff, Film, Project } from './models';
import { round2, todayStr } from './http';

export const STAGE_ORDER = ['lead', 'consultation', 'measurements', 'proposal', 'approval', 'scheduled', 'in_progress', 'invoicing', 'closed'];
export const STAGE_LABELS: Record<string, string> = {
  lead: 'New lead',
  consultation: 'Consultation',
  measurements: 'Measurements',
  proposal: 'Proposal',
  approval: 'Approval',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  invoicing: 'Invoicing',
  closed: 'Job closed',
};
export const stageIndex = (s: string) => STAGE_ORDER.indexOf(s);

/* ---------------- Proposal maths ---------------- */
export type Line = { id: string; serviceId?: string; name: string; coverage?: string; detail?: string; qty: number; unitPrice: number };
export type Option = { id: string; title: string; filmLabel?: string; group?: string; recommended?: boolean; detail?: string; discount?: number; comparisonPrice?: number; lines: Line[] };

export function optionTotals(o: Option, taxRate = 0) {
  const subtotal = round2((o.lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0));
  const discount = Math.min(subtotal, Math.max(0, Number(o.discount) || 0));
  const taxable = subtotal - discount;
  const tax = round2((taxable * (Number(taxRate) || 0)) / 100);
  return { subtotal, discount: round2(discount), tax, total: round2(taxable + tax) };
}

/** Default internal selection: every additive option + the recommended (or first) option in each alternative group. */
export function defaultSelection(options: Option[]) {
  const picked: string[] = [];
  const groups = new Map<string, Option[]>();
  for (const o of options || []) {
    const g = (o.group || '').trim();
    if (!g) picked.push(o.id);
    else groups.set(g, [...(groups.get(g) || []), o]);
  }
  for (const list of groups.values()) picked.push((list.find((o) => o.recommended) || list[0]).id);
  return picked;
}

export function validateSelection(options: Option[], ids: string[]) {
  if (!ids.length) return 'Choose at least one offer option.';
  const set = new Set(ids);
  if (set.size !== ids.length) return 'Choose valid, unique offer options.';
  const byId = new Map(options.map((o) => [o.id, o]));
  const seenGroups = new Set<string>();
  for (const id of ids) {
    const o = byId.get(id);
    if (!o) return 'Choose valid, unique offer options.';
    const g = (o.group || '').trim();
    if (g) {
      if (seenGroups.has(g)) return 'Choose only one option from each alternative group.';
      seenGroups.add(g);
    }
  }
  return null;
}

export function proposalTotals(p: any, ids?: string[]) {
  if (!p || !Array.isArray(p.options)) return { subtotal: 0, discount: 0, tax: 0, total: 0, deposit: 0, selected: [] as string[] };
  const selected = ids && ids.length ? ids : p.selectedOptionIds?.length ? p.selectedOptionIds : p.internalSelection?.length ? p.internalSelection : defaultSelection(p.options);
  const chosen = p.options.filter((o: Option) => selected.includes(o.id));
  const sum = chosen.reduce(
    (acc: any, o: Option) => {
      const t = optionTotals(o, p.taxRate);
      return { subtotal: acc.subtotal + t.subtotal, discount: acc.discount + t.discount, tax: acc.tax + t.tax, total: acc.total + t.total };
    },
    { subtotal: 0, discount: 0, tax: 0, total: 0 },
  );
  const dep = p.deposit || { mode: 'none', value: 0 };
  const deposit = dep.mode === 'percent' ? (sum.total * (Number(dep.value) || 0)) / 100 : dep.mode === 'fixed' ? Math.min(sum.total, Number(dep.value) || 0) : 0;
  return { subtotal: round2(sum.subtotal), discount: round2(sum.discount), tax: round2(sum.tax), total: round2(sum.total), deposit: round2(deposit), selected };
}

export function validateProposal(p: any) {
  if (!Array.isArray(p.options) || !p.options.length) return 'Add at least one offer option.';
  const ids = new Set<string>();
  for (const o of p.options) {
    if (!o.id || ids.has(o.id)) return 'Offer IDs must be unique.';
    ids.add(o.id);
    if (!String(o.title || '').trim() || !Array.isArray(o.lines) || !o.lines.length) return 'Each option needs a title and at least one service.';
    for (const l of o.lines) {
      if (!String(l.name || '').trim() || !(Number(l.qty) > 0) || !(Number(l.unitPrice) >= 0) || l.unitPrice === '' || l.unitPrice === null) {
        return 'Complete service descriptions, quantities and prices for every option.';
      }
    }
    const t = optionTotals(o, 0);
    if ((Number(o.discount) || 0) > t.subtotal) return 'An option discount cannot exceed its subtotal.';
    if ((Number(o.comparisonPrice) || 0) < 0) return 'Comparison prices must be non-negative.';
  }
  const tax = Number(p.taxRate);
  if (!(tax >= 0 && tax <= 100)) return 'Set a current validity date and tax between 0 and 100%.';
  if (p.deposit?.mode === 'percent' && Number(p.deposit.value) > 100) return 'Deposit percentage must be at most 100.';
  return null;
}

export function buildInvoice(p: any, number: string, dueDays = 14) {
  const totals = proposalTotals(p.proposal);
  const chosen = (p.proposal?.options || []).filter((o: Option) => totals.selected.includes(o.id));
  const lines = chosen.flatMap((o: Option) =>
    (o.lines || []).map((l) => ({ name: l.name, coverage: l.coverage || '', option: o.title, qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0, amount: round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)) })),
  );
  const issued = todayStr();
  const [y, m, d] = issued.split('-').map(Number);
  return {
    number,
    issuedAt: issued,
    dueDate: todayStr(new Date(y, m - 1, d + dueDays)),
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    taxRate: Number(p.proposal?.taxRate) || 0,
    total: totals.total,
    terms: p.proposal?.terms || '',
    acceptedBy: p.proposal?.approvedBy || '',
    status: 'issued',
    sentAt: null as Date | null,
  };
}

/* ---------------- Payments ---------------- */
export function paymentSummary(project: any) {
  const total = project.invoice ? Number(project.invoice.total) || 0 : 0;
  const paid = round2((project.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));
  const balance = round2(Math.max(0, total - paid));
  const status = !project.invoice ? (paid > 0 ? 'deposit' : 'none') : paid <= 0 ? 'unpaid' : balance <= 0.009 ? 'paid' : 'partial';
  return { invoiceTotal: total, paid, balance, status };
}

/* ---------------- Stage rules ---------------- */
export function hasInstallBooking(p: any) {
  return (p.appointments || []).some((a: any) => a.type === 'installation' && a.status !== 'cancelled');
}
export function hasCheckedIn(p: any) {
  return (p.appointments || []).some((a: any) => a.status === 'checked_in' || a.status === 'completed');
}

export function stageError(p: any, target: string): string | null {
  const t = stageIndex(target);
  const c = stageIndex(p.stage);
  if (t < 0) return 'Unknown stage';
  if (t === c) return null;
  if (p.invoice && t < stageIndex('invoicing')) return 'An invoiced project cannot be moved back before Invoicing.';
  if (c >= stageIndex('scheduled') && t < c) return 'Scheduled and later jobs cannot be moved back to an earlier workflow stage.';
  if (t >= stageIndex('proposal') && !p.proposal) return 'Create a proposal first.';
  if (t >= stageIndex('approval') && !['sent', 'viewed', 'approved'].includes(p.proposal?.status)) return 'Send a proposal before moving to approval.';
  if (t >= stageIndex('scheduled') && !hasInstallBooking(p)) return 'Book an installation before marking this project scheduled.';
  if (t >= stageIndex('in_progress') && !hasCheckedIn(p)) return 'Check in to an installation appointment before starting the job.';
  if (t >= stageIndex('invoicing') && !(p.install?.status === 'complete' || p.invoice)) return 'Complete the installation or create an invoice first.';
  if (t >= stageIndex('closed')) {
    const pay = paymentSummary(p);
    if (!(p.install?.status === 'complete' && p.invoice && pay.status === 'paid')) return 'Complete installation and record full payment before closing the job.';
  }
  return null;
}

/** Moves the project forward when the event makes a later stage valid. Never moves backwards. */
export function autoAdvance(p: any, target: string) {
  if (stageIndex(target) <= stageIndex(p.stage)) return false;
  if (stageError(p, target)) return false;
  p.stage = target;
  if (target === 'closed') p.closedAt = new Date();
  return true;
}

export function projectValue(p: any) {
  if (p.invoice) return Number(p.invoice.total) || 0;
  if (p.proposal) return proposalTotals(p.proposal).total;
  return Number(p.value) || 0;
}

/* ---------------- Measurements ---------------- */
const UNIT_MM: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
export function measuredArea(m: any) {
  let area = 0;
  let panes = 0;
  for (const g of m?.groups || []) {
    for (const p of g.panes || []) {
      if (p.selected === false) continue;
      const f = UNIT_MM[p.unit || 'mm'] || 1;
      const q = Math.max(1, Number(p.qty) || 1);
      area += ((Number(p.width) || 0) * f * (Number(p.height) || 0) * f * q) / 1e6;
      panes += q;
    }
  }
  return { areaM2: round2(area), panes };
}

/* ---------------- Activity ---------------- */
export async function logActivity(type: string, title: string, text = '', projectId?: unknown, link?: string) {
  try {
    await Activity.create({ type, title, text, projectId: projectId || undefined, link: link || (projectId ? `/projects/${projectId}` : undefined) });
  } catch (err) {
    console.error('[activity]', err);
  }
}

/* ---------------- Response shaping ---------------- */
export async function decorate(projects: any[]) {
  const ids = (key: string) => Array.from(new Set(projects.map((p) => p[key]).filter(Boolean).map(String)));
  const [contacts, stores, staff, films] = await Promise.all([
    Contact.find({ _id: { $in: ids('contactId') } }).lean(),
    Store.find({ _id: { $in: ids('storeId') } }).lean(),
    Staff.find({}).lean(),
    Film.find({ _id: { $in: ids('filmId') } }).select('name brand category tintColor shades warrantyYears').lean(),
  ]);
  const map = (list: any[]) => new Map(list.map((x) => [String(x._id), x]));
  const cm = map(contacts), sm = map(stores), stm = map(staff), fm = map(films);
  const today = todayStr();
  return projects.map((p) => {
    const upcoming = (p.appointments || [])
      .filter((a: any) => a.status !== 'cancelled' && a.status !== 'completed' && a.date >= today)
      .sort((a: any, b: any) => (a.date + a.start).localeCompare(b.date + b.start))[0];
    const ms = measuredArea(p.measurements);
    return {
      ...p,
      contact: p.contactId ? cm.get(String(p.contactId)) || null : null,
      store: p.storeId ? sm.get(String(p.storeId)) || null : null,
      owner: p.ownerId ? stm.get(String(p.ownerId)) || null : null,
      film: p.filmId ? fm.get(String(p.filmId)) || null : null,
      nextAppointment: upcoming ? { ...upcoming, installer: upcoming.installerId ? stm.get(String(upcoming.installerId))?.name || null : null } : null,
      totals: { ...paymentSummary(p), proposal: p.proposal ? proposalTotals(p.proposal) : null, measuredM2: ms.areaM2, panes: ms.panes },
      stageLabel: STAGE_LABELS[p.stage] || p.stage,
    };
  });
}

export async function loadProject(id: string) {
  const p = await Project.findById(id).lean();
  if (!p) return null;
  return (await decorate([p]))[0];
}
