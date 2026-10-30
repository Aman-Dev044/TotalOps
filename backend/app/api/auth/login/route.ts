import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { Admin } from '@/lib/models';
import { body, handler, HttpError, str } from '@/lib/http';
import { signToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Basic in-memory brute-force protection (per email+ip, 8 attempts / 15 min).
const attempts = new Map<string, { n: number; until: number }>();

export const POST = handler(async (req: NextRequest) => {
  const data = await body<{ email?: string; password?: string }>(req);
  const email = str(data.email, 'Email', { required: true }).toLowerCase();
  const password = str(data.password, 'Password', { required: true, max: 200 });
  const key = `${email}|${req.headers.get('x-forwarded-for') || 'local'}`;
  const rec = attempts.get(key);
  if (rec && rec.n >= 8 && rec.until > Date.now()) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');

  const admin = await Admin.findOne({ email });
  const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (!admin || !ok) {
    const n = rec && rec.until > Date.now() ? rec.n + 1 : 1;
    attempts.set(key, { n, until: Date.now() + 15 * 60_000 });
    throw new HttpError(401, 'Incorrect email or password');
  }
  attempts.delete(key);
  admin.lastLoginAt = new Date();
  await admin.save();
  const token = await signToken({ sub: String(admin._id), email: admin.email, name: admin.name });
  return { token, admin: { _id: admin._id, name: admin.name, email: admin.email, phone: admin.phone } };
});
