import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { Admin } from '@/lib/models';
import { bad, body, handler, HttpError, str } from '@/lib/http';
import { tokenFrom, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function current(req: NextRequest) {
  try {
    const payload = await verifyToken(tokenFrom(req));
    const admin = await Admin.findById(payload.sub);
    if (!admin) throw new Error();
    return admin;
  } catch {
    throw new HttpError(401, 'Please sign in');
  }
}

export const GET = handler(async (req: NextRequest) => {
  const a = await current(req);
  return { _id: a._id, name: a.name, email: a.email, phone: a.phone, lastLoginAt: a.lastLoginAt };
});

/** Update profile and/or password. Password change requires the current password. */
export const PATCH = handler(async (req: NextRequest) => {
  const a = await current(req);
  const data = await body<{ name?: string; email?: string; phone?: string; currentPassword?: string; newPassword?: string }>(req);
  if (data.name !== undefined) a.name = str(data.name, 'Name', { required: true, max: 80 });
  if (data.phone !== undefined) a.phone = str(data.phone, 'Phone', { max: 40 });
  if (data.email !== undefined) {
    const email = str(data.email, 'Email', { required: true, max: 120 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Enter a valid email address');
    a.email = email;
  }
  if (data.newPassword) {
    if (!data.currentPassword || !(await bcrypt.compare(data.currentPassword, a.passwordHash))) throw bad('Current password is incorrect');
    if (data.newPassword.length < 8) throw bad('New password must be at least 8 characters');
    a.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }
  await a.save();
  return { _id: a._id, name: a.name, email: a.email, phone: a.phone };
});
