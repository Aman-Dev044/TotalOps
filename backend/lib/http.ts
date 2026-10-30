import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from './db';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const bad = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: connects to Mongo, converts thrown errors into JSON responses. */
export function handler<P = Record<string, string>>(
  fn: (req: NextRequest, params: P) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      await connectDB();
      const params = (ctx && ctx.params ? await ctx.params : {}) as P;
      const out = await fn(req, params);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err: unknown) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof mongoose.Error.CastError) return NextResponse.json({ error: `Invalid value for ${err.path}` }, { status: 400 });
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return NextResponse.json({ error: first?.message || 'Validation failed' }, { status: 400 });
  }
  const anyErr = err as { code?: number; keyValue?: Record<string, unknown>; name?: string; message?: string };
  if (anyErr?.code === 11000) {
    const key = Object.keys(anyErr.keyValue || {})[0] || 'value';
    return NextResponse.json({ error: `That ${key} is already in use` }, { status: 409 });
  }
  if (anyErr?.name === 'MongooseServerSelectionError' || anyErr?.name === 'MongoServerSelectionError') {
    console.error('[db]', anyErr.message);
    return NextResponse.json({ error: 'Database is unreachable. Check MONGODB_URI and that MongoDB is running.' }, { status: 503 });
  }
  console.error('[api]', err);
  return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const data = await req.json();
    if (data === null || typeof data !== 'object') throw new Error();
    return data as T;
  } catch {
    throw bad('Request body must be a JSON object');
  }
}

export function str(v: unknown, field: string, { required = false, max = 2000 } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`);
    return '';
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${field} must be text`);
  const s = String(v).trim();
  if (required && !s) throw bad(`${field} is required`);
  if (s.length > max) throw bad(`${field} is too long`);
  return s;
}

export function num(v: unknown, field: string, { min = -Infinity, max = Infinity, required = false } = {}): number {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`);
    return 0;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw bad(`${field} must be a number`);
  if (n < min) throw bad(`${field} must be at least ${min}`);
  if (n > max) throw bad(`${field} must be at most ${max}`);
  return n;
}

export function isId(v: unknown): v is string {
  return typeof v === 'string' && mongoose.isValidObjectId(v);
}

export function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return todayStr(dt);
}

export function publicUrl(path: string) {
  const base = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}
