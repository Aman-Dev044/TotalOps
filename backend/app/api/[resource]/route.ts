import { NextRequest } from 'next/server';
import { body, handler, notFound } from '@/lib/http';
import { buildFilter, cleanBody, getResource } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export const GET = handler<{ resource: string }>(async (req: NextRequest, { resource }) => {
  const res = getResource(resource);
  if (!res) throw notFound(`Unknown resource "${resource}"`);
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(2000, Math.max(1, Number(sp.get('limit')) || 1000));
  const skip = Math.max(0, Number(sp.get('skip')) || 0);
  let sort: Record<string, 1 | -1> = res.sort || { createdAt: -1 };
  const s = sp.get('sort');
  if (s) sort = s.startsWith('-') ? { [s.slice(1)]: -1 } : { [s]: 1 };
  let query = res.model.find(buildFilter(res, sp)).sort(sort).skip(skip).limit(limit);
  if (resource === 'automations') query = query.select('-firedKeys');
  return query.lean();
});

export const POST = handler<{ resource: string }>(async (req: NextRequest, { resource }) => {
  const res = getResource(resource);
  if (!res) throw notFound(`Unknown resource "${resource}"`);
  const data = cleanBody(await body(req));
  await res.beforeCreate?.(data);
  const doc = await res.model.create(data);
  await res.afterCreate?.(doc.toObject());
  return Response.json(doc.toObject(), { status: 201 });
});
