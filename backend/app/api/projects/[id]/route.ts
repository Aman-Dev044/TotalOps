import { NextRequest } from 'next/server';
import { Activity, Contact, FileDoc, Note, Project, Store } from '@/lib/models';
import { bad, body, conflict, handler, isId, notFound, str } from '@/lib/http';
import { loadProject, logActivity } from '@/lib/project';

export const dynamic = 'force-dynamic';

export const GET = handler<{ id: string }>(async (_req, { id }) => {
  if (!isId(id)) throw bad('Invalid project id');
  const project = await loadProject(id);
  if (!project) throw notFound('Project not found');
  const [notes, files, activity] = await Promise.all([
    Note.find({ projectId: id }).sort({ createdAt: -1 }).lean(),
    FileDoc.find({ projectId: id, archived: { $ne: true } }).sort({ createdAt: -1 }).lean(),
    Activity.find({ projectId: id }).sort({ createdAt: -1 }).limit(60).lean(),
  ]);
  return { ...project, notes, files, activity };
});

const EDITABLE = ['title', 'segment', 'storeId', 'ownerId', 'contactId', 'dealerId', 'source', 'priority', 'tags', 'vehicle', 'property', 'location', 'reference', 'requirements', 'value', 'filmId', 'filmShade', 'designId'];

export const PATCH = handler<{ id: string }>(async (req: NextRequest, { id }) => {
  if (!isId(id)) throw bad('Invalid project id');
  const data = await body<any>(req);
  const set: Record<string, unknown> = {};
  for (const k of EDITABLE) if (data[k] !== undefined) set[k] = data[k];
  if (set.title !== undefined) set.title = str(set.title, 'Project title', { required: true, max: 160 });
  if (set.segment !== undefined && !['automotive', 'residential', 'commercial'].includes(String(set.segment))) throw bad('Unknown segment');
  for (const k of ['storeId', 'ownerId', 'contactId', 'dealerId', 'filmId', 'designId']) {
    if (set[k] === '' || set[k] === null) set[k] = undefined;
    else if (set[k] !== undefined && !isId(set[k])) throw bad(`Invalid ${k}`);
  }
  if (set.storeId && !(await Store.exists({ _id: set.storeId }))) throw bad('Choose a store.');
  if (set.contactId && !(await Contact.exists({ _id: set.contactId }))) throw bad('Choose a valid contact');
  const unset: Record<string, 1> = {};
  for (const [k, v] of Object.entries(set)) if (v === undefined) { delete set[k]; unset[k] = 1; }
  const updated = await Project.findByIdAndUpdate(id, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true });
  if (!updated) throw notFound('Project not found');
  await logActivity('project', 'Project updated', `${updated.number} · details saved`, id);
  return loadProject(id);
});

/** Permanent delete is only allowed for archived projects without financial history. */
export const DELETE = handler<{ id: string }>(async (_req, { id }) => {
  if (!isId(id)) throw bad('Invalid project id');
  const p = await Project.findById(id).lean<any>();
  if (!p) throw notFound('Project not found');
  if (!p.archived) throw conflict('Archive the project before deleting it permanently.');
  if (p.invoice || (p.payments || []).length) throw conflict('Projects with invoices or payments cannot be deleted — keep them archived.');
  await Promise.all([Project.deleteOne({ _id: id }), Note.deleteMany({ projectId: id }), Activity.deleteMany({ projectId: id })]);
  return { ok: true };
});
