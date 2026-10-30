import { NextRequest } from 'next/server';
import { Contact, Project, Store, nextSeq } from '@/lib/models';
import { bad, body, escapeRegex, handler, isId, str } from '@/lib/http';
import { decorate, logActivity } from '@/lib/project';
import { fire } from '@/lib/automation';
import { getBody } from '@/lib/engine/vehicles';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const filter: Record<string, any> = { archived: sp.get('archived') === 'true' };
  if (sp.get('archived') === 'all') delete filter.archived;
  for (const key of ['stage', 'segment', 'storeId', 'contactId', 'dealerId', 'ownerId', 'source', 'priority']) {
    const v = sp.get(key);
    if (v) filter[key] = v.includes(',') ? { $in: v.split(',') } : v;
  }
  const installer = sp.get('installerId');
  if (installer) filter.$or = [{ 'appointments.installerId': installer }, { 'appointments.coInstallerIds': installer }];
  if (sp.get('proposal') === 'true') filter.proposal = { $ne: null };
  if (sp.get('invoice') === 'true') filter.invoice = { $ne: null };
  const q = sp.get('q')?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const contacts = await Contact.find({ $or: [{ name: rx }, { company: rx }, { phone: rx }, { email: rx }] }).select('_id').lean();
    const or = [{ title: rx }, { number: rx }, { 'vehicle.make': rx }, { 'vehicle.model': rx }, { 'vehicle.rego': rx }, { 'property.address': rx }, { tags: rx }, { contactId: { $in: contacts.map((c) => c._id) } }];
    filter.$and = [...(filter.$and || []), { $or: or }];
  }
  const limit = Math.min(1000, Number(sp.get('limit')) || 500);
  const list = await Project.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
  return decorate(list);
});

export const POST = handler(async (req: NextRequest) => {
  const data = await body<any>(req);
  const title = str(data.title, 'Scope / project title', { required: true, max: 160 });
  const segment = ['automotive', 'residential', 'commercial'].includes(data.segment) ? data.segment : 'automotive';
  if (!isId(data.storeId) || !(await Store.exists({ _id: data.storeId }))) throw bad('Choose a store.');

  let contactId = data.contactId;
  if (contactId) {
    if (!isId(contactId) || !(await Contact.exists({ _id: contactId }))) throw bad('Choose a valid contact');
  } else {
    const c = data.contact || {};
    const name = str(c.name, 'Contact name', { required: true, max: 120 });
    const contact = await Contact.create({ name, company: c.company, email: c.email, phone: c.phone, address: c.address, segment, source: data.source || 'Direct', storeId: data.storeId, status: 'prospect' });
    contactId = contact._id;
  }

  const vehicle = segment === 'automotive' ? { ...(data.vehicle || {}) } : {};
  const property = segment !== 'automotive' ? { ...(data.property || {}) } : {};
  let measurements: any = { groups: [], verified: false };
  if (segment === 'automotive' && vehicle.bodyType) {
    const tpl = getBody(vehicle.bodyType);
    measurements = { groups: [{ id: crypto.randomUUID().slice(0, 12), name: 'Vehicle glass', panes: tpl.panes.map((p) => ({ id: crypto.randomUUID().slice(0, 12), label: p.label, zone: p.zone, windowType: 'Vehicle', width: p.width, height: p.height, unit: 'mm', qty: p.qty, selected: true })) }], verified: false };
  }
  const store = await Store.findById(data.storeId).lean<any>();
  const num = await nextSeq('project');
  const project = await Project.create({
    number: `PRJ-${num}`,
    title,
    segment,
    stage: 'lead',
    storeId: data.storeId,
    ownerId: isId(data.ownerId) ? data.ownerId : undefined,
    contactId,
    dealerId: isId(data.dealerId) ? data.dealerId : undefined,
    source: str(data.source, 'Source', { max: 60 }) || 'Direct',
    priority: data.priority === 'high' ? 'high' : 'normal',
    tags: Array.isArray(data.tags) ? data.tags.map(String).slice(0, 20) : [],
    vehicle,
    property,
    location: data.location || { type: segment === 'automotive' ? 'in_shop' : 'on_site', address: segment === 'automotive' ? store?.address || '' : property.address || data.contact?.address || '' },
    requirements: str(data.requirements, 'Notes', { max: 4000 }),
    value: Number(data.value) || 0,
    filmId: isId(data.filmId) ? data.filmId : undefined,
    measurements,
  });
  await logActivity('lead', 'New lead', `${project.number} · ${title}`, project._id);
  await fire('lead_created', project.toObject());
  return Response.json((await decorate([project.toObject()]))[0], { status: 201 });
});
