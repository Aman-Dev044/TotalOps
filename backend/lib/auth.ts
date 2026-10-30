import { SignJWT, jwtVerify } from 'jose';

const DEV_FALLBACK = 'totalops-dev-secret-change-me-0123456789abcdef';

export function jwtKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET || DEV_FALLBACK);
}

export async function signToken(payload: { sub: string; email: string; name: string }) {
  return new SignJWT({ email: payload.email, name: payload.name, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtKey());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ['HS256'] });
  return payload as { sub: string; email: string; name: string; role: string };
}

export function tokenFrom(req: Request) {
  const h = req.headers.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  const url = new URL(req.url);
  return url.searchParams.get('token') || '';
}
