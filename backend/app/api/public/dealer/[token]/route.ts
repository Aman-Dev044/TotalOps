import { NextRequest } from 'next/server';
import { Dealer, Film, Project, Staff, Store } from '@/lib/models';
import { handler, notFound, todayStr } from '@/lib/http';
import { measuredArea } from '@/lib/project';

export const dynamic = 'force-dynamic';

/** Read-only live dealer portal: today's vehicles for this dealership. */
export const GET = handler<{ token: string }>(async (req: NextRequest, { token }) => {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) throw notFound('This dealer link is not valid.');
  const dealer = await Dealer.findOne({ token, active: { $ne: false } }).lean<any>();
  if (!dealer) throw notFound('This dealer link is not valid.');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get('date') || '') ? req.nextUrl.searchParams.get('date')! : todayStr();
  const projects = await Project.find({
    archived: false,
    appointments: { $elemMatch: { date } },
    $or: [{ dealerId: dealer._id }, { 'appointments.dealer': dealer.name }],
  }).lean<any[]>();
  const [staff, stores, films, homeStore] = await Promise.all([
    Staff.find({}).select('name').lean<any[]>(),
    Store.find({}).select('name phone address').lean<any[]>(),
    Film.find({ _id: { $in: projects.map((p) => p.filmId).filter(Boolean) } }).lean<any[]>(),
    dealer.storeId ? Store.findById(dealer.storeId).select('name phone').lean<any>() : null,
  ]);
  const vehicles: any[] = [];
  for (const p of projects) {
    for (const a of p.appointments) {
      if (a.date !== date || a.status === 'cancelled') continue;
      const film = films.find((f) => String(f._id) === String(p.filmId));
      const shade = p.filmShade ?? film?.shades?.[0]?.vlt;
      const shadeRow = film?.shades?.find((s: any) => s.vlt === shade) || film?.shades?.[0];
      const panes = (p.measurements?.groups || []).flatMap((g: any) => (g.panes || []).filter((x: any) => x.selected !== false).map((x: any) => ({ label: x.label, width: x.width, height: x.height, unit: x.unit || 'mm', qty: x.qty || 1, areaM2: measuredArea({ groups: [{ panes: [x] }] }).areaM2 })));
      vehicles.push({
        id: String(a._id),
        fleetId: p.number,
        time: `${a.start}–${a.end}`,
        start: a.start,
        bay: a.bay || '',
        store: stores.find((s) => String(s._id) === String(a.storeId || p.storeId))?.name || '',
        vehicle: p.vehicle || {},
        stockPo: p.vehicle?.stockPo || p.reference || '',
        shopStatus: a.shopStatus || 'booked',
        status: a.status,
        tech: [a.installerId, ...(a.coInstallerIds || [])].map((x: any) => staff.find((s) => String(s._id) === String(x))?.name?.split(' ')[0]).filter(Boolean),
        film: film ? { brand: film.brand, name: film.name, category: film.category, vlt: shade, tser: shadeRow?.tser, irr: film.irr, uvr: film.uvr, warrantyYears: film.warrantyYears } : null,
        coverage: p.title.split('·')[1]?.trim() || 'Sides & rear',
        panes,
        totalAreaM2: measuredArea(p.measurements).areaM2,
        notes: a.notes || '',
      });
    }
  }
  vehicles.sort((x, y) => x.start.localeCompare(y.start));
  return {
    dealer: { name: dealer.name, contactName: dealer.contactName },
    store: homeStore,
    date,
    syncedAt: new Date().toISOString(),
    counts: {
      total: vehicles.length,
      inBay: vehicles.filter((v) => ['in_bay', 'installing'].includes(v.shopStatus)).length,
      queued: vehicles.filter((v) => ['booked', 'arrived'].includes(v.shopStatus)).length,
      ready: vehicles.filter((v) => ['ready', 'collected'].includes(v.shopStatus)).length,
    },
    vehicles,
  };
});
