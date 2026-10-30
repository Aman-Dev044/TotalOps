import { NextRequest } from 'next/server';
import { Activity, Contact, Note, Project, Roll, Staff, Store } from '@/lib/models';
import { addDays, handler, round2, todayStr } from '@/lib/http';
import { STAGE_LABELS, STAGE_ORDER, paymentSummary, projectValue } from '@/lib/project';
import { sweep } from '@/lib/automation';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const GET = handler(async (req: NextRequest) => {
  await sweep();
  const sp = req.nextUrl.searchParams;
  const storeId = sp.get('storeId') || '';
  const rangeDays = sp.get('range') === 'all' ? 3650 : Math.max(1, Number(sp.get('range')) || 30);
  const today = todayStr();
  const from = addDays(today, -rangeDays + 1);
  const prevFrom = addDays(from, -rangeDays);

  const base: any = storeId ? { storeId } : {};
  const [projects, rolls, staff, stores, activity, tasks] = await Promise.all([
    Project.find({ ...base, archived: false }).lean<any[]>(),
    Roll.find({ archived: { $ne: true }, ...(storeId ? { storeId } : {}) }).lean<any[]>(),
    Staff.find({ active: true, ...(storeId ? { storeId } : {}) }).lean<any[]>(),
    Store.find({}).lean<any[]>(),
    Activity.find({}).sort({ createdAt: -1 }).limit(12).lean<any[]>(),
    Note.find({ kind: 'task', done: false }).sort({ dueDate: 1 }).limit(20).lean<any[]>(),
  ]);
  const contacts = await Contact.find({ _id: { $in: projects.map((p) => p.contactId) } }).select('name phone').lean<any[]>();
  const cmap = new Map(contacts.map((c) => [String(c._id), c]));
  const smap = new Map(stores.map((s) => [String(s._id), s]));

  let revenue = 0, revenuePrev = 0, received = 0, receivedPrev = 0;
  const outstanding = { amount: 0, count: 0, overdueDays: 0, overdueCount: 0 };
  const proposalsAwaiting = { count: 0, value: 0 };
  const activeBySegment: Record<string, number> = { automotive: 0, residential: 0, commercial: 0 };
  const revenueBySegment: Record<string, number> = { automotive: 0, residential: 0, commercial: 0 };
  const stageCounts = STAGE_ORDER.map((s) => ({ stage: s, label: STAGE_LABELS[s], count: 0, value: 0 }));
  const sources = new Map<string, { source: string; count: number; won: number; value: number }>();
  const months: { key: string; label: string; revenue: number; received: number; jobs: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, revenue: 0, received: 0, jobs: 0 });
  }
  const monthIdx = new Map(months.map((m, i) => [m.key, i]));
  let newLeadsToday = 0, newLeadsWeek = 0;

  for (const p of projects) {
    const val = projectValue(p);
    const sc = stageCounts.find((s) => s.stage === p.stage);
    if (sc) { sc.count++; sc.value += val; }
    if (p.stage !== 'closed') activeBySegment[p.segment] = (activeBySegment[p.segment] || 0) + 1;
    const src = sources.get(p.source || 'Direct') || { source: p.source || 'Direct', count: 0, won: 0, value: 0 };
    src.count++;
    if (['approval', 'scheduled', 'in_progress', 'invoicing', 'closed'].includes(p.stage)) { src.won++; src.value += val; }
    sources.set(src.source, src);
    const created = todayStr(new Date(p.createdAt));
    if (created === today) newLeadsToday++;
    if (created >= addDays(today, -6)) newLeadsWeek++;

    if (p.invoice) {
      const issued = p.invoice.issuedAt;
      if (issued >= from && issued <= today) { revenue += p.invoice.total; revenueBySegment[p.segment] = (revenueBySegment[p.segment] || 0) + p.invoice.total; }
      if (issued >= prevFrom && issued < from) revenuePrev += p.invoice.total;
      const mi = monthIdx.get(issued.slice(0, 7));
      if (mi !== undefined) { months[mi].revenue += p.invoice.total; months[mi].jobs++; }
      const pay = paymentSummary(p);
      if (pay.balance > 0) {
        outstanding.amount += pay.balance;
        outstanding.count++;
        if (p.invoice.dueDate < today) {
          outstanding.overdueCount++;
          outstanding.overdueDays += Math.round((new Date(today).getTime() - new Date(p.invoice.dueDate).getTime()) / 86400_000);
        }
      }
    }
    for (const pay of p.payments || []) {
      if (pay.date >= from && pay.date <= today) received += pay.amount;
      if (pay.date >= prevFrom && pay.date < from) receivedPrev += pay.amount;
      const mi = monthIdx.get(String(pay.date).slice(0, 7));
      if (mi !== undefined) months[mi].received += pay.amount;
    }
    if (p.proposal && ['sent', 'viewed'].includes(p.proposal.status)) { proposalsAwaiting.count++; proposalsAwaiting.value += val; }
  }

  // Today's schedule
  const todays: any[] = [];
  for (const p of projects) for (const a of p.appointments || []) {
    if (a.date !== today || a.status === 'cancelled') continue;
    todays.push({ ...a, projectId: p._id, projectNumber: p.number, projectTitle: p.title, segment: p.segment, vehicle: p.vehicle, contact: cmap.get(String(p.contactId)) || null, installer: staff.find((s) => String(s._id) === String(a.installerId))?.name || null, store: smap.get(String(a.storeId || p.storeId))?.name || '' });
  }
  todays.sort((a, b) => a.start.localeCompare(b.start));

  // Installer workload this week (Mon–Sun)
  const dow = (now.getDay() + 6) % 7;
  const weekStart = addDays(today, -dow);
  const weekEnd = addDays(weekStart, 6);
  const workload = staff.filter((s) => s.role === 'installer').map((s) => {
    let mins = 0, jobsToday = 0;
    for (const p of projects) for (const a of p.appointments || []) {
      if (a.status === 'cancelled' || a.date < weekStart || a.date > weekEnd) continue;
      const mine = String(a.installerId) === String(s._id) || (a.coInstallerIds || []).map(String).includes(String(s._id));
      if (!mine) continue;
      mins += Math.max(0, minutes(a.end) - minutes(a.start));
      if (a.date === today) jobsToday++;
    }
    const capacity = s.hoursPerWeek || 38;
    const hours = round2(mins / 60);
    return { _id: s._id, name: s.name, title: s.title, color: s.color, store: smap.get(String(s.storeId))?.name || '', hoursBooked: hours, capacity, utilisation: Math.round((hours / capacity) * 100), jobsToday };
  }).sort((a, b) => b.utilisation - a.utilisation);

  const lowStock = rolls.filter((r) => r.remainingM2 <= r.reorderAtM2).map((r) => ({ _id: r._id, name: r.name, brand: r.brand, remainingM2: r.remainingM2, reorderAtM2: r.reorderAtM2, reorderPending: r.reorderPending, store: smap.get(String(r.storeId))?.name || '' }));

  // Action centre
  const actions: any[] = [];
  for (const p of projects) {
    const c = cmap.get(String(p.contactId));
    if (p.invoice && paymentSummary(p).balance > 0 && p.invoice.dueDate < today) actions.push({ kind: 'overdue', severity: 'high', title: `Overdue invoice ${p.invoice.number}`, detail: `${c?.name || p.title} · $${paymentSummary(p).balance.toFixed(2)} due ${p.invoice.dueDate}`, link: `/projects/${p._id}` });
    if (p.proposal && ['sent', 'viewed'].includes(p.proposal.status) && p.proposal.sentAt && Date.now() - new Date(p.proposal.sentAt).getTime() > 2 * 86400_000) actions.push({ kind: 'proposal', severity: 'medium', title: 'Proposal sent, no response for 2+ days', detail: `${p.number} · ${c?.name || p.title}`, link: `/projects/${p._id}` });
    if (p.proposal?.status === 'approved' && !(p.appointments || []).some((a: any) => a.type === 'installation' && a.status !== 'cancelled')) actions.push({ kind: 'schedule', severity: 'medium', title: 'Approved job ready to book', detail: `${p.number} · ${p.title}`, link: `/projects/${p._id}` });
    if (p.stage === 'lead' && Date.now() - new Date(p.createdAt).getTime() > 86400_000) actions.push({ kind: 'lead', severity: 'low', title: 'Lead waiting for first contact', detail: `${p.number} · ${c?.name || ''}`, link: `/projects/${p._id}` });
    const lastIn = [...(p.messages || [])].reverse().find((m: any) => m.direction === 'in');
    const lastOut = [...(p.messages || [])].reverse().find((m: any) => m.direction === 'out');
    if (lastIn && (!lastOut || new Date(lastIn.createdAt) > new Date(lastOut.createdAt))) actions.push({ kind: 'reply', severity: 'medium', title: `Unread reply from ${c?.name || 'customer'}`, detail: lastIn.body.slice(0, 90), link: `/projects/${p._id}` });
  }
  for (const r of lowStock.filter((x) => !x.reorderPending)) actions.push({ kind: 'stock', severity: 'low', title: `Low stock: ${r.brand} ${r.name}`, detail: `${r.remainingM2} m² left at ${r.store}`, link: '/inventory' });
  const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  const active = projects.filter((p) => p.stage !== 'closed');
  const won = projects.filter((p) => ['approval', 'scheduled', 'in_progress', 'invoicing', 'closed'].includes(p.stage)).length;
  const quarterly: { label: string; revenue: number }[] = [];
  for (let i = 0; i < 12; i += 3) quarterly.push({ label: `Q${Math.floor(Number(months[i].key.slice(5)) / 3.01) + 1} ${months[i].key.slice(2, 4)}`, revenue: round2(months[i].revenue + months[i + 1].revenue + months[i + 2].revenue) });

  return {
    range: { from, to: today, days: rangeDays },
    kpis: {
      revenue: round2(revenue),
      revenuePrev: round2(revenuePrev),
      received: round2(received),
      receivedPrev: round2(receivedPrev),
      activeProjects: active.length,
      activeBySegment,
      outstanding: { amount: round2(outstanding.amount), count: outstanding.count, overdueCount: outstanding.overdueCount, avgDaysOverdue: outstanding.overdueCount ? Math.round(outstanding.overdueDays / outstanding.overdueCount) : 0 },
      proposalsAwaiting: { count: proposalsAwaiting.count, value: round2(proposalsAwaiting.value) },
      pipelineValue: round2(active.reduce((s, p) => s + projectValue(p), 0)),
      newLeadsToday,
      newLeadsWeek,
      bookedToday: todays.length,
      conversionRate: projects.length ? Math.round((won / projects.length) * 100) : 0,
    },
    revenueTrend: months.map((m) => ({ ...m, revenue: round2(m.revenue), received: round2(m.received) })),
    quarterly,
    jobsBySegment: Object.entries(activeBySegment).map(([segment, count]) => ({ segment, count })),
    revenueBySegment: Object.entries(revenueBySegment).map(([segment, value]) => ({ segment, value: round2(value) })),
    stageCounts: stageCounts.map((s) => ({ ...s, value: round2(s.value) })),
    leadSources: Array.from(sources.values()).sort((a, b) => b.count - a.count),
    today: todays,
    workload,
    lowStock,
    actions: actions.slice(0, 12),
    tasks,
    recentActivity: activity,
  };
});
