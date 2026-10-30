import { NextRequest } from 'next/server';
import { Contact, Store } from '@/lib/models';
import { bad, body, handler } from '@/lib/http';
import { logActivity } from '@/lib/project';

export const dynamic = 'force-dynamic';

/** Body: { rows: [{ name, company, email, phone, address, segment, source, store }] } — duplicates (same email or phone) are skipped. */
export const POST = handler(async (req: NextRequest) => {
  const { rows } = await body<{ rows: any[] }>(req);
  if (!Array.isArray(rows) || !rows.length) throw bad('No rows to import');
  if (rows.length > 5000) throw bad('Import at most 5,000 rows at a time');
  const stores = await Store.find({}).lean<any[]>();
  let created = 0, skipped = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const get = (...keys: string[]) => {
      for (const k of Object.keys(r)) if (keys.includes(k.toLowerCase().trim())) return String(r[k] ?? '').trim();
      return '';
    };
    const name = get('name', 'full name', 'contact', 'customer');
    if (!name) { errors.push(`Row ${i + 2}: missing name`); continue; }
    const email = get('email', 'email address').toLowerCase();
    const phone = get('phone', 'mobile', 'phone number');
    if ((email && (await Contact.exists({ email }))) || (phone && (await Contact.exists({ phone })))) { skipped++; continue; }
    const storeName = get('store', 'branch').toLowerCase();
    const store = stores.find((s) => s.name.toLowerCase() === storeName);
    const seg = get('segment').toLowerCase();
    await Contact.create({
      name, email, phone,
      company: get('company', 'business'),
      address: get('address'),
      segment: ['automotive', 'residential', 'commercial'].includes(seg) ? seg : 'automotive',
      source: get('source') || 'Import',
      status: ['prospect', 'active', 'inactive'].includes(get('status').toLowerCase()) ? get('status').toLowerCase() : 'prospect',
      storeId: store?._id,
      tags: get('tags').split(/[;|]/).map((t) => t.trim()).filter(Boolean),
    });
    created++;
  }
  if (created) await logActivity('contact', 'Contacts imported', `${created} created · ${skipped} duplicates skipped`, undefined, '/customers');
  return { created, skipped, errors: errors.slice(0, 50) };
});
