import { NextRequest } from 'next/server';
import { Franchisee } from '@/lib/models';
import { bad, handler, notFound } from '@/lib/http';
import { routeInbound } from '@/lib/franchise';

export const dynamic = 'force-dynamic';

/**
 * Inbound SMS webhook for a franchisee's dedicated line.
 * Accepts Twilio's form post (From, To, Body) or JSON { from, body } and replies with empty TwiML.
 */
export const POST = handler<{ token: string }>(async (req: NextRequest, { token }) => {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) throw notFound('Unknown SMS line.');
  const fr = await Franchisee.findOne({ webhookToken: token, active: { $ne: false } }).lean<any>();
  if (!fr) throw notFound('Unknown SMS line.');

  let from = '';
  let text = '';
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = await req.json().catch(() => ({}));
    from = String(data.from ?? data.From ?? '');
    text = String(data.body ?? data.Body ?? '');
  } else {
    const form = await req.formData().catch(() => null);
    from = String(form?.get('From') ?? '');
    text = String(form?.get('Body') ?? '');
  }
  text = text.trim().slice(0, 1600);
  if (!from || !text) throw bad('From and Body are required.');

  await routeInbound(fr, from, text);
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
});
