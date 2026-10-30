'use client';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'totalops.token';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getToken() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function onUnauthorized() {
  setToken('');
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
  }
}

type Opts = { auth?: boolean; signal?: AbortSignal };

export async function request<T = any>(method: string, path: string, body?: unknown, opts: Opts = {}): Promise<T> {
  const auth = opts.auth !== false;
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : '';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the TotalOps server. Is the backend running on ' + API_URL + '?');
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized();
    throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`, data);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string, opts?: Opts) => request<T>('GET', path, undefined, opts),
  post: <T = any>(path: string, body?: unknown, opts?: Opts) => request<T>('POST', path, body ?? {}, opts),
  patch: <T = any>(path: string, body?: unknown, opts?: Opts) => request<T>('PATCH', path, body ?? {}, opts),
  put: <T = any>(path: string, body?: unknown, opts?: Opts) => request<T>('PUT', path, body ?? {}, opts),
  del: <T = any>(path: string, opts?: Opts) => request<T>('DELETE', path, undefined, opts),
  /** POST /api/projects/:id/action */
  action: <T = any>(projectId: string, action: string, payload: Record<string, unknown> = {}) =>
    request<T>('POST', `/projects/${projectId}/action`, { action, ...payload }),
  /** POST /api/ops/:resource/:id */
  ops: <T = any>(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) =>
    request<T>('POST', `/ops/${resource}/${id}`, { action, ...payload }),
};

export type UploadedFile = { _id: string; name: string; size: number; mime: string; category: string; projectId?: string; createdAt: string };

export async function uploadFile(file: File | Blob, opts: { projectId?: string; category?: string; name?: string } = {}) {
  const fd = new FormData();
  fd.append('file', file, opts.name || (file as File).name || 'upload.png');
  if (opts.projectId) fd.append('projectId', opts.projectId);
  if (opts.category) fd.append('category', opts.category);
  return request<UploadedFile>('POST', '/upload', fd);
}

/** URL usable in <img src> / <a href> for an uploaded file. */
export function mediaUrl(fileId: string, download = false) {
  const t = encodeURIComponent(getToken());
  return `${API_URL}/api/media/${fileId}?token=${t}${download ? '&download=1' : ''}`;
}

/** Downloads an authenticated endpoint (CSV / JSON export) as a file. */
export async function downloadFrom(path: string, fallbackName = 'download') {
  const res = await fetch(`${API_URL}/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  const cd = res.headers.get('content-disposition') || '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
