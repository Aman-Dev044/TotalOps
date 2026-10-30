import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { FileDoc } from '@/lib/models';
import { bad, handler, isId, notFound } from '@/lib/http';
import { storageDir } from '@/lib/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Streams an uploaded file. Auth: Bearer header or ?token= (for <img> tags). Add ?download=1 to force download. */
export const GET = handler<{ id: string }>(async (req: NextRequest, { id }) => {
  if (!isId(id)) throw bad('Invalid file id');
  const doc = await FileDoc.findById(id).lean<any>();
  if (!doc?.diskName) throw notFound('File not found');
  let data: Buffer;
  try {
    data = await fs.readFile(path.join(storageDir(), 'uploads', path.basename(doc.diskName)));
  } catch {
    throw notFound('The stored file is missing');
  }
  const download = req.nextUrl.searchParams.get('download') === '1' || doc.mime === 'image/svg+xml';
  const safeName = String(doc.name).replace(/["\r\n]/g, '');
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': doc.mime || 'application/octet-stream',
      'Content-Length': String(data.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
