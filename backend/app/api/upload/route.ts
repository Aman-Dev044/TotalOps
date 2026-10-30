import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { FileDoc, Project } from '@/lib/models';
import { bad, handler, isId } from '@/lib/http';
import { storageDir } from '@/lib/registry';
import { logActivity } from '@/lib/project';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'application/pdf': '.pdf', 'text/plain': '.txt', 'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'model/gltf-binary': '.glb',
};

export const POST = handler(async (req: NextRequest) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw bad('Send the file as multipart/form-data');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') throw bad('Choose a file to upload');
  if (file.size === 0) throw bad('The file is empty');
  if (file.size > MAX_BYTES) throw bad('Maximum upload size is 15 MB');
  let mime = file.type || '';
  if (!mime && /\.glb$/i.test(file.name)) mime = 'model/gltf-binary';
  const ext = ALLOWED[mime];
  if (!ext) throw bad('This file type is not supported. Upload images, PDF, text, CSV, Word, Excel or GLB files.');
  const projectId = form.get('projectId');
  if (projectId && (!isId(String(projectId)) || !(await Project.exists({ _id: projectId })))) throw bad('Project not found');
  const category = String(form.get('category') || (mime.startsWith('image/') ? 'photo' : 'document')).slice(0, 40);

  const _id = new mongoose.Types.ObjectId();
  const diskName = `${_id}${ext}`;
  const dir = path.join(storageDir(), 'uploads');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, diskName), Buffer.from(await file.arrayBuffer()));
  const doc = await FileDoc.create({ _id, name: file.name.slice(0, 200) || `upload${ext}`, size: file.size, mime, category, projectId: projectId || undefined, diskName });
  if (projectId) await logActivity('file', category === 'photo' ? 'Project photo added' : 'File attached', doc.name, String(projectId));
  return Response.json(doc.toObject(), { status: 201 });
});
