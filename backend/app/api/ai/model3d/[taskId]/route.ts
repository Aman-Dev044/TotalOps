import { NextRequest } from 'next/server';
import { bad, handler, HttpError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Poll a Meshy task. Add ?glb=1 to stream the finished GLB through this server (avoids CORS in the browser). */
export const GET = handler<{ taskId: string }>(async (req: NextRequest, { taskId }) => {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new HttpError(501, 'Photo → 3D mesh is not configured.');
  if (!/^[A-Za-z0-9-]{6,80}$/.test(taskId)) throw bad('Invalid task id');
  const res = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`, { headers: { Authorization: `Bearer ${key}` } });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `3D service error: ${json?.message || res.status}`);
  if (req.nextUrl.searchParams.get('glb') === '1') {
    const url = json?.model_urls?.glb;
    if (json.status !== 'SUCCEEDED' || !url) throw bad('The model is not ready yet');
    const glb = await fetch(url);
    if (!glb.ok) throw new HttpError(502, 'Could not download the 3D model');
    return new Response(glb.body, { headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'private, max-age=3600' } });
  }
  return { status: json.status, progress: json.progress ?? 0, thumbnail: json.thumbnail_url || null, ready: json.status === 'SUCCEEDED', failed: json.status === 'FAILED' || json.status === 'EXPIRED', error: json.task_error?.message || null };
});
