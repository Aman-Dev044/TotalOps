import fs from 'fs/promises';
import path from 'path';
import { FileDoc, Settings } from '@/lib/models';
import { handler, isId, notFound } from '@/lib/http';
import { storageDir } from '@/lib/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public business logo (only the file chosen in Settings → Business profile is exposed). */
export const GET = handler(async () => {
  const settings = await Settings.findOne({ key: 'workspace' }).lean<any>();
  const raw = String(settings?.business?.logoUrl || '');
  const id = raw.split('/').pop()?.split('?')[0] || '';
  if (!isId(id)) throw notFound('No logo configured');
  const doc = await FileDoc.findById(id).lean<any>();
  if (!doc?.diskName || !/^image\/(png|jpeg|webp|gif)$/.test(doc.mime)) throw notFound('No logo configured');
  const data = await fs.readFile(path.join(storageDir(), 'uploads', path.basename(doc.diskName))).catch(() => null);
  if (!data) throw notFound('No logo configured');
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': doc.mime, 'Cache-Control': 'public, max-age=300' } });
});
