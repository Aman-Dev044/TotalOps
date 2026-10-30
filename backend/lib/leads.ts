import { Contact, LeadForm, Project, Store, nextSeq } from './models';
import { bad, str } from './http';
import { logActivity } from './project';
import { fire } from './automation';
import { guessBodyType, getBody } from './engine/vehicles';

/** Creates a contact + lead project from a lead-form submission (public form or CRM test submit). */
export async function submitLead(form: any, raw: Record<string, unknown>, test = false) {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw || {})) data[k.toLowerCase()] = str(v, k, { max: 2000 });
  const name = data.name || data['full name'];
  if (!name) throw bad('Please enter your name');
  if (!data.email && !data.phone) throw bad('Please enter an email address or phone number');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw bad('Please enter a valid email address');

  const storeId = form.storeId || (await Store.findOne({}).select('_id').lean<any>())?._id;
  const email = (data.email || '').toLowerCase();
  let contact = email ? await Contact.findOne({ email }) : null;
  if (!contact && data.phone) contact = await Contact.findOne({ phone: data.phone });
  if (!contact) {
    contact = await Contact.create({ name, email, phone: data.phone, company: data.company, address: data.address, segment: form.segment, source: 'Website form', storeId, status: 'prospect' });
  }
  const vehicleText = data.vehicle || '';
  const vehicle: any = {};
  let measurements: any = { groups: [], verified: false };
  if (form.segment === 'automotive' && vehicleText) {
    const parts = vehicleText.split(/\s+/);
    const year = /^(19|20)\d{2}$/.test(parts[0]) ? parts.shift() : '';
    Object.assign(vehicle, { year, make: parts.shift() || '', model: parts.join(' '), bodyType: guessBodyType(vehicleText) });
    const tpl = getBody(vehicle.bodyType);
    measurements = { groups: [{ id: crypto.randomUUID().slice(0, 12), name: 'Vehicle glass', panes: tpl.panes.map((p) => ({ id: crypto.randomUUID().slice(0, 12), label: p.label, zone: p.zone, windowType: 'Vehicle', width: p.width, height: p.height, unit: 'mm', qty: p.qty, selected: true })) }], verified: false };
  }
  const title = form.segment === 'automotive'
    ? `${vehicleText || 'Vehicle'} · ${data.scope ? data.scope.slice(0, 40) : 'tint enquiry'}`
    : `${form.segment === 'commercial' ? 'Commercial' : 'Residential'} · ${data.address || data.company || name}`;
  const project = await Project.create({
    number: `PRJ-${await nextSeq('project')}`,
    title: title.slice(0, 150),
    segment: form.segment,
    stage: 'lead',
    storeId,
    contactId: contact._id,
    source: 'Website form',
    tags: test ? ['Test submission'] : [],
    vehicle,
    property: form.segment !== 'automotive' ? { address: data.address || '' } : {},
    location: { type: form.segment === 'automotive' ? 'in_shop' : 'on_site', address: data.address || '' },
    requirements: [data.scope, data.message, data.notes].filter(Boolean).join('\n'),
    measurements,
  });
  await LeadForm.updateOne({ _id: form._id }, { $push: { submissions: { $each: [{ at: new Date(), data, contactId: contact._id, projectId: project._id, test }], $position: 0, $slice: 500 } } });
  await logActivity('lead', test ? 'Test lead submitted' : 'New lead', `${form.name} → ${project.number} · ${name}`, project._id);
  await fire('lead_created', project.toObject());
  return { projectId: project._id, contactId: contact._id, number: project.number };
}
