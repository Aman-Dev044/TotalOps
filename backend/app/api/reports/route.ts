import { NextRequest } from 'next/server';
import { Film, Project, Roll, Staff, Store } from '@/lib/models';
import { addDays, handler, round2, todayStr } from '@/lib/http';
import { STAGE_LABELS, STAGE_ORDER, measuredArea, paymentSummary, projectValue } from '@/lib/project';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const range = sp.get('range') || '90';
  const from = range === 'all' ? '0000-00-00' : addDays(todayStr(), -(Number(range) || 90) + 1);
  const storeId = sp.get('storeId');
  const projects = await Project.find({ archived: false, ...(storeId ? { storeId } : {}) }).lean<any[]>();
  const inRange = projects.filter((p) => todayStr(new Date(p.createdAt)) >= from || (p.invoice?.issuedAt || '') >= from);
  const [rolls, staff, stores, films] = await Promise.all([Roll.find({ archived: { $ne: true } }).lean<any[]>(), Staff.find({}).lean<any[]>(), Store.find({}).lean<any[]>(), Film.find({}).select('name brand').lean<any[]>()]);

  const byStage = STAGE_ORDER.map((s) => {
    const list = inRange.filter((p) => p.stage === s);
    return { stage: s, label: STAGE_LABELS[s], count: list.length, value: round2(list.reduce((t, p) => t + projectValue(p), 0)) };
  });
  const bySegment = ['automotive', 'residential', 'commercial'].map((s) => {
    const list = inRange.filter((p) => p.segment === s);
    return { segment: s, count: list.length, value: round2(list.reduce((t, p) => t + projectValue(p), 0)), areaM2: round2(list.reduce((t, p) => t + measuredArea(p.measurements).areaM2, 0)) };
  });
  const byStore = stores.map((st) => {
    const list = inRange.filter((p) => String(p.storeId) === String(st._id));
    const invoiced = list.filter((p) => p.invoice && p.invoice.issuedAt >= from).reduce((t, p) => t + p.invoice.total, 0);
    return { store: st.name, color: st.color, projects: list.length, invoiced: round2(invoiced), pipeline: round2(list.filter((p) => p.stage !== 'closed').reduce((t, p) => t + projectValue(p), 0)) };
  });
  const filmUse = new Map<string, { film: string; projects: number; areaM2: number }>();
  for (const p of inRange) {
    if (!p.filmId) continue;
    const f = films.find((x) => String(x._id) === String(p.filmId));
    const key = String(p.filmId);
    const row = filmUse.get(key) || { film: f ? `${f.brand} ${f.name}` : 'Unknown', projects: 0, areaM2: 0 };
    row.projects++;
    row.areaM2 = round2(row.areaM2 + measuredArea(p.measurements).areaM2);
    filmUse.set(key, row);
  }
  const installers = staff.filter((s) => s.role === 'installer').map((s) => {
    let jobs = 0, hours = 0, value = 0;
    for (const p of inRange) for (const a of p.appointments || []) {
      if (a.status !== 'completed' || String(a.installerId) !== String(s._id) || a.date < from) continue;
      jobs++;
      hours += (Number(a.end.slice(0, 2)) * 60 + Number(a.end.slice(3)) - Number(a.start.slice(0, 2)) * 60 - Number(a.start.slice(3))) / 60;
      value += projectValue(p);
    }
    return { name: s.name, store: stores.find((x) => String(x._id) === String(s.storeId))?.name || '', jobs, hours: round2(hours), value: round2(value), rating: s.rating };
  }).sort((a, b) => b.value - a.value);

  const won = inRange.filter((p) => ['approval', 'scheduled', 'in_progress', 'invoicing', 'closed'].includes(p.stage));
  const closed = inRange.filter((p) => p.stage === 'closed');
  const proposals = inRange.filter((p) => p.proposal);
  const approved = inRange.filter((p) => p.proposal?.status === 'approved');
  const outstanding = projects.reduce((t, p) => t + (p.invoice ? paymentSummary(p).balance : 0), 0);

  return {
    range,
    from,
    metrics: {
      projects: inRange.length,
      pipelineValue: round2(inRange.filter((p) => p.stage !== 'closed').reduce((t, p) => t + projectValue(p), 0)),
      wonValue: round2(won.reduce((t, p) => t + projectValue(p), 0)),
      closedJobs: closed.length,
      invoiced: round2(inRange.filter((p) => p.invoice && p.invoice.issuedAt >= from).reduce((t, p) => t + p.invoice.total, 0)),
      collected: round2(inRange.reduce((t, p) => t + (p.payments || []).filter((x: any) => x.date >= from).reduce((s: number, x: any) => s + x.amount, 0), 0)),
      outstanding: round2(outstanding),
      measuredAreaM2: round2(inRange.reduce((t, p) => t + measuredArea(p.measurements).areaM2, 0)),
      stockOnHandM2: round2(rolls.reduce((t, r) => t + (r.remainingM2 || 0), 0)),
      stockValue: round2(rolls.reduce((t, r) => t + (r.remainingM2 || 0) * (r.costPerM2 || 0), 0)),
      averageJobValue: won.length ? round2(won.reduce((t, p) => t + projectValue(p), 0) / won.length) : 0,
      winRate: proposals.length ? Math.round((approved.length / proposals.length) * 100) : 0,
    },
    conversion: [
      { step: 'Leads', count: inRange.length },
      { step: 'Proposals', count: proposals.length },
      { step: 'Approved', count: approved.length + inRange.filter((p) => p.proposal && p.proposal.status !== 'approved' && won.includes(p)).length },
      { step: 'Closed', count: closed.length },
    ],
    byStage,
    bySegment,
    byStore,
    films: Array.from(filmUse.values()).sort((a, b) => b.areaM2 - a.areaM2),
    installers,
  };
});
