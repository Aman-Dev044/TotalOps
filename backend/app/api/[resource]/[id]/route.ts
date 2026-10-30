import { NextRequest } from 'next/server';
import { bad, body, handler, isId, notFound } from '@/lib/http';
import { cleanBody, getResource } from '@/lib/registry';

export const dynamic = 'force-dynamic';

function resolve(resource: string, id: string) {
  const res = getResource(resource);
  if (!res) throw notFound(`Unknown resource "${resource}"`);
  if (!isId(id)) throw bad('Invalid id');
  return res;
}

export const GET = handler<{ resource: string; id: string }>(async (_req, { resource, id }) => {
  const res = resolve(resource, id);
  const doc = await res.model.findById(id).lean();
  if (!doc) throw notFound(`${res.label} not found`);
  return doc;
});

export const PATCH = handler<{ resource: string; id: string }>(async (req: NextRequest, { resource, id }) => {
  const res = resolve(resource, id);
  const data = cleanBody(await body(req));
  await res.beforeUpdate?.(data, id);
  const doc = await res.model.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean();
  if (!doc) throw notFound(`${res.label} not found`);
  return doc;
});

export const PUT = PATCH;

export const DELETE = handler<{ resource: string; id: string }>(async (_req, { resource, id }) => {
  const res = resolve(resource, id);
  await res.beforeDelete?.(id);
  const doc = await res.model.findByIdAndDelete(id).lean();
  if (!doc) throw notFound(`${res.label} not found`);
  await res.afterDelete?.(doc);
  return { ok: true };
});
