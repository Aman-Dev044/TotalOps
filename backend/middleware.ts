import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [/^\/api\/auth\/login\/?$/, /^\/api\/public\//, /^\/api\/health\/?$/];

/**
 * Allowed origins come from .env: CORS_ORIGINS (comma separated, "*" allows any origin),
 * falling back to FRONTEND_URL. CORS_ALLOW_LOCALHOST=false disables the localhost convenience rule.
 */
function allowedOrigin(origin: string) {
  if (!origin) return '';
  const list = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (list.includes('*') || list.includes(origin)) return origin;
  if (process.env.CORS_ALLOW_LOCALHOST !== 'false' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return '';
}

function withCors(res: NextResponse, origin: string) {
  const allow = allowedOrigin(origin);
  if (allow) {
    res.headers.set('Access-Control-Allow-Origin', allow);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Expose-Headers', 'Content-Disposition');
    res.headers.set('Access-Control-Max-Age', '86400');
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return withCors(new NextResponse(null, { status: 204 }), origin);

  const path = req.nextUrl.pathname;
  if (!PUBLIC_PATHS.some((r) => r.test(path))) {
    const header = req.headers.get('authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : req.nextUrl.searchParams.get('token') || '';
    if (!token) return withCors(NextResponse.json({ error: 'Please sign in' }, { status: 401 }), origin);
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'totalops-dev-secret-change-me-0123456789abcdef');
      await jwtVerify(token, secret, { algorithms: ['HS256'] });
    } catch {
      return withCors(NextResponse.json({ error: 'Session expired — please sign in again' }, { status: 401 }), origin);
    }
  }
  return withCors(NextResponse.next(), origin);
}

export const config = { matcher: '/api/:path*' };
