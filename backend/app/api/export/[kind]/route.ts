import mongoose from 'mongoose';
import { Contact, Film, Project, Roll, Staff, Store } from '@/lib/models';
import { handler, notFound, todayStr } from '@/lib/http';
import { STAGE_LABELS, measuredArea, paymentSummary, projectValue } from '@/lib/project';

export const dynamic = 'force-dynamic';

function csv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

function file(name: string, content: string, type = 'text/csv; charset=utf-8') {
  return new Response(content, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"` } });
}

export const GET = handler<{ kind: string }>(async (_req, { kind }) => {
  const stamp = todayStr();
  if (kind === 'projects') {
    const [projects, contacts, stores] = await Promise.all([Project.find({}).sort({ createdAt: -1 }).lean<any[]>(), Contact.find({}).lean<any[]>(), Store.find({}).lean<any[]>()]);
    const cm = new Map(contacts.map((c) => [String(c._id), c]));
    const sm = new Map(stores.map((s) => [String(s._id), s]));
    const rows = [['Number', 'Title', 'Customer', 'Phone', 'Email', 'Segment', 'Stage', 'Store', 'Source', 'Value', 'Invoice', 'Paid', 'Balance', 'Measured m2', 'Archived', 'Created']];
    for (const p of projects) {
      const c = cm.get(String(p.contactId));
      const pay = paymentSummary(p);
      rows.push([p.number, p.title, c?.name, c?.phone, c?.email, p.segment, STAGE_LABELS[p.stage], sm.get(String(p.storeId))?.name, p.source, projectValue(p).toFixed(2), p.invoice?.number || '', pay.paid.toFixed(2), pay.balance.toFixed(2), measuredArea(p.measurements).areaM2, p.archived ? 'yes' : 'no', todayStr(new Date(p.createdAt))]);
    }
    return file(`totalops-projects-${stamp}.csv`, csv(rows));
  }
  if (kind === 'contacts') {
    const [contacts, stores] = await Promise.all([Contact.find({}).sort({ name: 1 }).lean<any[]>(), Store.find({}).lean<any[]>()]);
    const rows = [['Name', 'Company', 'Email', 'Phone', 'Address', 'Status', 'Segment', 'Source', 'Store', 'Tags']];
    for (const c of contacts) rows.push([c.name, c.company, c.email, c.phone, c.address, c.status, c.segment, c.source, stores.find((s) => String(s._id) === String(c.storeId))?.name, (c.tags || []).join('; ')]);
    return file(`totalops-contacts-${stamp}.csv`, csv(rows));
  }
  if (kind === 'stock') {
    const [rolls, stores, films] = await Promise.all([Roll.find({}).lean<any[]>(), Store.find({}).lean<any[]>(), Film.find({}).lean<any[]>()]);
    const rows = [['Roll', 'Brand', 'Film', 'Shade %', 'Store', 'Width mm', 'Remaining m2', 'Reorder at m2', 'Cost $/m2', 'Sell $/m2', 'Stock value', 'Batch', 'Location', 'Low stock']];
    for (const r of rolls) rows.push([r.name, r.brand, films.find((f) => String(f._id) === String(r.filmId))?.name, r.shade, stores.find((s) => String(s._id) === String(r.storeId))?.name, r.widthMm, r.remainingM2, r.reorderAtM2, r.costPerM2, r.sellPerM2, ((r.remainingM2 || 0) * (r.costPerM2 || 0)).toFixed(2), r.batch, r.location, r.remainingM2 <= r.reorderAtM2 ? 'yes' : 'no']);
    return file(`totalops-stock-${stamp}.csv`, csv(rows));
  }
  if (kind === 'payments') {
    const [projects, contacts] = await Promise.all([Project.find({ 'payments.0': { $exists: true } }).lean<any[]>(), Contact.find({}).lean<any[]>()]);
    const rows = [['Date', 'Project', 'Customer', 'Kind', 'Method', 'Reference', 'Amount', 'Invoice']];
    for (const p of projects) for (const pay of p.payments) rows.push([pay.date, p.number, contacts.find((c) => String(c._id) === String(p.contactId))?.name, pay.kind, pay.method, pay.reference, Number(pay.amount).toFixed(2), p.invoice?.number || '']);
    rows.splice(1, rows.length - 1, ...rows.slice(1).sort((a, b) => String(b[0]).localeCompare(String(a[0]))));
    return file(`totalops-payments-${stamp}.csv`, csv(rows));
  }
  if (kind === 'schedule') {
    const [projects, staff] = await Promise.all([Project.find({ 'appointments.0': { $exists: true } }).lean<any[]>(), Staff.find({}).lean<any[]>()]);
    const rows = [['Date', 'Start', 'End', 'Type', 'Status', 'Project', 'Title', 'Installer', 'Bay', 'Address']];
    for (const p of projects) for (const a of p.appointments) rows.push([a.date, a.start, a.end, a.type, a.status, p.number, p.title, staff.find((s) => String(s._id) === String(a.installerId))?.name, a.bay, a.address]);
    rows.splice(1, rows.length - 1, ...rows.slice(1).sort((a, b) => String(a[0] + '' + a[1]).localeCompare(String(b[0] + '' + b[1]))));
    return file(`totalops-schedule-${stamp}.csv`, csv(rows));
  }
  if (kind === 'backup') {
    const out: Record<string, unknown[]> = {};
    for (const name of mongoose.modelNames()) {
      if (name === 'Admin' || name === 'Counter') continue; // never export password hashes
      const M = mongoose.model(name);
      out[M.collection.collectionName] = await M.find({}).lean();
    }
    return file(`totalops-backup-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), app: 'TotalOps', collections: out }, null, 2), 'application/json');
  }
  throw notFound('Unknown export');
});
