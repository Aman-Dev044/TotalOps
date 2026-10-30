import { NextRequest } from 'next/server';
import { Contact, Dealer, Film, Project, Staff, Store } from '@/lib/models';
import { addDays, bad, handler, todayStr } from '@/lib/http';
import { STAGE_LABELS } from '@/lib/project';

export const dynamic = 'force-dynamic';

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Flattened appointment list used by Calendar, Planning, Jobs / My Day, Auto Shop Day and Team.
 * Query: from, to (YYYY-MM-DD, inclusive), storeId, installerId, type, status, includeCancelled
 */
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') || todayStr();
  const to = sp.get('to') || addDays(from, 6);
  if (!DATE_RX.test(from) || !DATE_RX.test(to)) throw bad('Use dates like 2026-01-31');
  const projects = await Project.find({ archived: false, appointments: { $elemMatch: { date: { $gte: from, $lte: to } } } })
    .select('number title segment stage storeId contactId dealerId vehicle property filmId filmShade appointments value measurements tags priority')
    .lean<any[]>();
  const [contacts, staff, stores, films, dealers] = await Promise.all([
    Contact.find({ _id: { $in: projects.map((p) => p.contactId) } }).select('name phone email company address').lean<any[]>(),
    Staff.find({}).select('name color storeId title').lean<any[]>(),
    Store.find({}).select('name color address phone').lean<any[]>(),
    Film.find({ _id: { $in: projects.map((p) => p.filmId).filter(Boolean) } }).select('name brand category tintColor').lean<any[]>(),
    Dealer.find({}).select('name').lean<any[]>(),
  ]);
  const by = (list: any[]) => new Map(list.map((x) => [String(x._id), x]));
  const cm = by(contacts), stm = by(staff), sm = by(stores), fm = by(films), dm = by(dealers);
  const storeId = sp.get('storeId');
  const installerId = sp.get('installerId');
  const type = sp.get('type');
  const status = sp.get('status');
  const withCancelled = sp.get('includeCancelled') === 'true';

  const out: any[] = [];
  for (const p of projects) {
    for (const a of p.appointments || []) {
      if (a.date < from || a.date > to) continue;
      if (!withCancelled && a.status === 'cancelled') continue;
      if (storeId && String(a.storeId || p.storeId) !== storeId) continue;
      if (installerId && String(a.installerId) !== installerId && !(a.coInstallerIds || []).map(String).includes(installerId)) continue;
      if (type && a.type !== type) continue;
      if (status && a.status !== status) continue;
      const area = (p.measurements?.groups || []).reduce((s: number, g: any) => s + (g.panes || []).filter((x: any) => x.selected !== false).length, 0);
      out.push({
        ...a,
        projectId: p._id,
        projectNumber: p.number,
        projectTitle: p.title,
        segment: p.segment,
        stage: p.stage,
        stageLabel: STAGE_LABELS[p.stage],
        value: p.value,
        priority: p.priority,
        tags: p.tags,
        vehicle: p.vehicle,
        property: p.property,
        panes: area,
        filmShade: p.filmShade,
        film: p.filmId ? fm.get(String(p.filmId)) || null : null,
        contact: cm.get(String(p.contactId)) || null,
        installer: a.installerId ? stm.get(String(a.installerId)) || null : null,
        coInstallers: (a.coInstallerIds || []).map((x: any) => stm.get(String(x))).filter(Boolean),
        store: sm.get(String(a.storeId || p.storeId)) || null,
        dealerName: a.dealer || (p.dealerId ? dm.get(String(p.dealerId))?.name : '') || '',
      });
    }
  }
  out.sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start));
  return out;
});
