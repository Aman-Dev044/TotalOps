import { NextRequest } from 'next/server';
import { Contact, Film, Project, Staff } from '@/lib/models';
import { escapeRegex, handler } from '@/lib/http';
import { STAGE_LABELS } from '@/lib/project';

export const dynamic = 'force-dynamic';

/** Global search across projects, contacts, team and films. */
export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  if (q.length < 2) return { projects: [], contacts: [], staff: [], films: [] };
  const rx = new RegExp(escapeRegex(q), 'i');
  const contacts = await Contact.find({ $or: [{ name: rx }, { company: rx }, { email: rx }, { phone: rx }, { address: rx }] }).limit(8).lean<any[]>();
  const projects = await Project.find({
    $or: [{ title: rx }, { number: rx }, { 'vehicle.make': rx }, { 'vehicle.model': rx }, { 'vehicle.rego': rx }, { 'property.address': rx }, { 'location.address': rx }, { contactId: { $in: contacts.map((c) => c._id) } }],
  }).sort({ updatedAt: -1 }).limit(10).lean<any[]>();
  const [staff, films] = await Promise.all([
    Staff.find({ $or: [{ name: rx }, { title: rx }, { skills: rx }] }).limit(5).lean(),
    Film.find({ $or: [{ name: rx }, { brand: rx }, { category: rx }] }).limit(5).lean(),
  ]);
  const cm = new Map(contacts.map((c) => [String(c._id), c]));
  const missing = projects.filter((p) => p.contactId && !cm.has(String(p.contactId))).map((p) => p.contactId);
  if (missing.length) for (const c of await Contact.find({ _id: { $in: missing } }).lean<any[]>()) cm.set(String(c._id), c);
  return {
    projects: projects.map((p) => ({ _id: p._id, number: p.number, title: p.title, stage: p.stage, stageLabel: STAGE_LABELS[p.stage], segment: p.segment, archived: p.archived, contactName: cm.get(String(p.contactId))?.name || '' })),
    contacts,
    staff,
    films,
  };
});
