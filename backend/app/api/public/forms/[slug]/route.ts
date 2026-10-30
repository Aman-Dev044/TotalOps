import { NextRequest } from 'next/server';
import { LeadForm, Settings } from '@/lib/models';
import { body, handler, HttpError, notFound } from '@/lib/http';
import { submitLead } from '@/lib/leads';

export const dynamic = 'force-dynamic';

const hits = new Map<string, number[]>();

async function find(slug: string) {
  const form = await LeadForm.findOne({ slug: String(slug).toLowerCase(), active: true }).lean<any>();
  if (!form) throw notFound('This form is not available.');
  return form;
}

export const GET = handler<{ slug: string }>(async (_req, { slug }) => {
  const form = await find(slug);
  const settings = await Settings.findOne({ key: 'workspace' }).lean<any>();
  return { name: form.name, heading: form.heading, intro: form.intro, fields: form.fields, segment: form.segment, business: { name: settings?.business?.name || 'TotalOps', phone: settings?.business?.phone, logoUrl: settings?.business?.logoUrl ? '/api/public/logo' : '' } };
});

export const POST = handler<{ slug: string }>(async (req: NextRequest, { slug }) => {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) throw new HttpError(429, 'Too many submissions. Please try again in a minute.');
  hits.set(ip, [...recent, now]);
  const form = await find(slug);
  const data = await body<Record<string, unknown>>(req);
  if (data.website) return { ok: true }; // honeypot field — silently drop bots
  await submitLead(form, data);
  return { ok: true, message: 'Thanks! We have received your enquiry and will be in touch shortly.' };
});
