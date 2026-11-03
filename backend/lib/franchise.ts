import { Contact, Franchisee, Project, Store } from './models';
import { bad, conflict, isId, str } from './http';
import { logActivity } from './project';

/** Normalises a phone number to E.164-ish digits: "+61 488 958 100" → "+61488958100". AU local "04…" → "+614…". */
export function normalizePhone(v: unknown) {
  let s = String(v ?? '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  else if (/^0\d{9}$/.test(s)) s = `+61${s.slice(1)}`;
  else if (!s.startsWith('+')) s = `+${s}`;
  return s;
}

export const isE164 = (s: string) => /^\+[1-9]\d{7,14}$/.test(s);

/** Shared validation for create/update. `id` is the franchisee being edited (excluded from the store-ownership check). */
export async function prepareFranchisee(d: any, id?: string) {
  delete d.webhookToken;
  delete d.inbound;
  if (d.name !== undefined) d.name = str(d.name, 'Franchisee name', { required: true, max: 120 });

  if (d.storeIds !== undefined) {
    const ids = Array.from(new Set(((d.storeIds as unknown[]) || []).map(String))).filter(isId);
    if (ids.length && (await Store.countDocuments({ _id: { $in: ids } })) !== ids.length) throw bad('One of the selected stores no longer exists.');
    const taken = await Franchisee.findOne({ storeIds: { $in: ids }, ...(id ? { _id: { $ne: id } } : {}) }).lean<any>();
    if (taken) {
      const clash = await Store.find({ _id: { $in: ids.filter((s) => taken.storeIds.map(String).includes(s)) } }).select('name').lean<any[]>();
      throw conflict(`${clash.map((s) => s.name).join(', ')} already belongs to ${taken.name}. Remove it there first.`);
    }
    d.storeIds = ids;
  }

  if (d.sms !== undefined) {
    const sms = d.sms || {};
    const number = normalizePhone(sms.number);
    if (number && !isE164(number)) throw bad('Enter the SMS line in international format, e.g. +61 488 958 100.');
    if (number) {
      const dupe = await Franchisee.findOne({ 'sms.number': number, ...(id ? { _id: { $ne: id } } : {}) }).select('name').lean<any>();
      if (dupe) throw conflict(`${number} is already the SMS line for ${dupe.name}.`);
    }
    const prev = id ? await Franchisee.findById(id).select('sms').lean<any>() : null;
    const same = !!prev?.sms?.number && prev.sms.number === number;
    d.sms = {
      number,
      senderId: str(sms.senderId, 'Sender ID', { max: 60 }),
      provider: 'twilio',
      verified: same ? !!prev.sms.verified : false, // changing the number always needs re-verification
      verifiedAt: same ? prev.sms.verifiedAt : undefined,
    };
  }

  if (d.banking !== undefined) {
    const b = d.banking || {};
    d.banking = {
      bankName: str(b.bankName, 'Bank', { max: 80 }),
      accountName: str(b.accountName, 'Account name', { max: 120 }),
      bsb: str(b.bsb, 'BSB', { max: 20 }),
      accountNumber: str(b.accountNumber, 'Account number', { max: 30 }),
    };
  }
}

/** The dedicated SMS line ("+61…") of the franchisee that owns this store, or '' for head office. */
export async function lineForStore(storeId: unknown) {
  if (!isId(String(storeId ?? ''))) return '';
  const fr = await Franchisee.findOne({ storeIds: storeId, active: { $ne: false } }).select('sms').lean<any>();
  return fr?.sms?.number || '';
}

/**
 * Routes one inbound SMS that arrived on a franchisee's line: matches the sender to a contact
 * at one of the franchisee's stores and appends the message to their latest open project.
 */
export async function routeInbound(fr: any, from: string, text: string, test = false) {
  const sender = normalizePhone(from);
  const storeIds = (fr.storeIds || []).map(String);
  const tail = sender.replace(/\D/g, '').slice(-9); // match "0412 100 201" and "+61412100201" alike
  let contact: any = null;
  if (tail.length >= 8) {
    const candidates = await Contact.find({ phone: { $exists: true, $ne: '' } }).select('name phone storeId').lean<any[]>();
    const matches = candidates.filter((c) => String(c.phone).replace(/\D/g, '').endsWith(tail));
    contact = matches.find((c) => storeIds.includes(String(c.storeId))) || matches[0] || null;
  }
  let project: any = null;
  if (contact) {
    project = await Project.findOne({ contactId: contact._id, archived: false, ...(storeIds.length ? { storeId: { $in: storeIds } } : {}) })
      .sort({ updatedAt: -1 })
      .select('number title')
      .lean<any>();
  }

  const entry = {
    at: new Date(),
    from: sender || from,
    body: text,
    contactId: contact?._id || null,
    contactName: contact?.name || '',
    projectId: project?._id || null,
    projectNumber: project?.number || '',
    test,
  };
  if (project) {
    await Project.updateOne(
      { _id: project._id },
      { $push: { messages: { direction: 'in', channel: 'sms', body: text, from: contact.name, line: fr.sms?.number || '', simulated: test } } },
    );
  }
  await Franchisee.updateOne({ _id: fr._id }, { $push: { inbound: { $each: [entry], $position: 0, $slice: 50 } } });
  const who = contact?.name || entry.from || 'Unknown sender';
  await logActivity(
    'message',
    test ? `Test SMS routed · ${fr.name}` : `Inbound SMS · ${fr.name}`,
    project ? `${who} → ${project.number}: ${text.slice(0, 80)}` : `${who} (no matching project): ${text.slice(0, 80)}`,
    project?._id,
    project ? undefined : '/settings?tab=franchisees',
  );
  return entry;
}
