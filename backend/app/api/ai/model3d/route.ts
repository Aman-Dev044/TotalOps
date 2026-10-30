import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { FileDoc } from '@/lib/models';
import { bad, body, handler, HttpError, isId, notFound } from '@/lib/http';
import { storageDir } from '@/lib/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Optional photo → real 3D mesh via Meshy's image-to-3D API.
 * POST { fileId } → { taskId }. Poll GET /api/ai/model3d/:taskId.
 */
export const POST = handler(async (req: NextRequest) => {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new HttpError(501, 'Photo → 3D mesh is not configured. Add MESHY_API_KEY to backend/.env.local to enable it.');
  const { fileId } = await body<{ fileId?: string }>(req);
  if (!isId(fileId)) throw bad('Upload a photo first');
  const doc = await FileDoc.findById(fileId).lean<any>();
  if (!doc?.diskName || !String(doc.mime).startsWith('image/')) throw notFound('Photo not found');
  const data = await fs.readFile(path.join(storageDir(), 'uploads', path.basename(doc.diskName)));
  const res = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: `data:${doc.mime};base64,${data.toString('base64')}`, enable_pbr: true, should_texture: true }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `3D service error: ${json?.message || res.status}`);
  return { taskId: json.result };
});
