import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { Contact, Film, Package, Project, Settings, Staff, Store, nextSeq } from '@/lib/models';
import { addDays, bad, body, conflict, handler, isId, notFound, num, publicUrl, round2, str, todayStr, uid } from '@/lib/http';
import {
  STAGE_LABELS, autoAdvance, buildInvoice, loadProject, logActivity, measuredArea, paymentSummary, proposalTotals, stageError, validateProposal, validateSelection,
} from '@/lib/project';
import { fire, renderTemplate } from '@/lib/automation';

export const dynamic = 'force-dynamic';

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;
const overlap = (a1: string, a2: string, b1: string, b2: string) => a1 < b2 && b1 < a2;

async function assertNoConflict(projectId: string, appt: any, apptId?: string) {
  const people = [appt.installerId, ...(appt.coInstallerIds || [])].filter(Boolean).map(String);
  const others = await Project.find({ archived: false, appointments: { $elemMatch: { date: appt.date, status: { $ne: 'cancelled' } } } }).select('number title appointments').lean<any[]>();
  const staff = await Staff.find({ _id: { $in: people } }).select('name').lean<any[]>();
  const nameOf = (id: string) => staff.find((s) => String(s._id) === id)?.name || 'This installer';
  for (const p of others) {
    for (const a of p.appointments) {
      if (a.status === 'cancelled' || a.date !== appt.date) continue;
      if (apptId && String(a._id) === apptId && String(p._id) === projectId) continue;
      if (!overlap(appt.start, appt.end, a.start, a.end)) continue;
      const theirs = [a.installerId, ...(a.coInstallerIds || [])].filter(Boolean).map(String);
      const clash = people.find((x) => theirs.includes(x));
      if (clash) throw conflict(`${nameOf(clash)} is already booked ${a.start}–${a.end} on ${a.date} (${p.number}).`);
      const sharedBay = appt.bay && a.bay && appt.bay === a.bay && !/mobile/i.test(appt.bay) && String(a.storeId) === String(appt.storeId);
      if (sharedBay) throw conflict(`${appt.bay} is already booked ${a.start}–${a.end} on ${a.date} (${p.number}).`);
    }
  }
}

async function cleanAppointment(input: any, project: any) {
  const date = str(input.date, 'Date', { required: true });
  if (!DATE_RX.test(date)) throw bad('Choose a valid date.');
  const start = str(input.start, 'Start time', { required: true });
  const end = str(input.end, 'End time', { required: true });
  if (!TIME_RX.test(start) || !TIME_RX.test(end)) throw bad('Use 24-hour times like 09:30');
  if (end <= start) throw bad('End time must be after the start time.');
  const storeId = input.storeId || project.storeId;
  if (!isId(String(storeId)) || !(await Store.exists({ _id: storeId }))) throw bad('Choose a store.');
  let installerId = input.installerId || undefined;
  if (installerId) {
    if (!isId(installerId)) throw bad('Choose a valid installer');
    const inst = await Staff.findById(installerId).lean<any>();
    if (!inst) throw bad('Choose a valid installer');
    if (String(inst.storeId) !== String(storeId)) throw bad('Choose an installer based at this store.');
  }
  const coInstallerIds = Array.isArray(input.coInstallerIds) ? input.coInstallerIds.filter((x: string) => isId(x) && x !== installerId) : [];
  const type = ['consultation', 'measurement', 'installation', 'site_visit', 'collection'].includes(input.type) ? input.type : 'installation';
  return {
    type, date, start, end, installerId, coInstallerIds, storeId,
    bay: str(input.bay, 'Bay', { max: 40 }),
    location: input.location === 'on_site' ? 'on_site' : 'in_shop',
    address: str(input.address, 'Address', { max: 300 }),
    status: ['scheduled', 'dispatched', 'checked_in', 'completed', 'cancelled'].includes(input.status) ? input.status : 'scheduled',
    shopStatus: ['booked', 'arrived', 'in_bay', 'installing', 'ready', 'collected'].includes(input.shopStatus) ? input.shopStatus : 'booked',
    dealer: str(input.dealer, 'Dealer', { max: 120 }),
    notes: str(input.notes, 'Notes', { max: 2000 }),
    reminder: input.reminder !== false,
  };
}

function findAppt(p: any, apptId: string) {
  const a = p.appointments.id(apptId);
  if (!a) throw notFound('Appointment not found');
  return a;
}

function checkInAppt(p: any, a: any) {
  if (a.status === 'checked_in' || a.status === 'completed') return false;
  a.status = 'checked_in';
  a.checkedInAt = new Date();
  if (a.type === 'installation') {
    p.install = { ...(p.install || {}), status: 'in_progress', checkedInAt: new Date() };
    p.markModified('install');
    autoAdvance(p, 'in_progress');
  }
  return true;
}

function completeAppt(p: any, a: any) {
  if (a.status === 'completed') return false;
  if (a.status !== 'checked_in') throw bad('Check in before completing the visit.');
  a.status = 'completed';
  a.completedAt = new Date();
  if (a.type === 'installation') {
    p.install = { ...(p.install || {}), status: 'complete', completedAt: new Date() };
    p.markModified('install');
    autoAdvance(p, 'invoicing');
  }
  return true;
}

function newIds(options: any[]) {
  return (options || []).map((o: any) => ({ ...o, id: uid(), lines: (o.lines || []).map((l: any) => ({ ...l, id: uid() })) }));
}

export const POST = handler<{ id: string }>(async (req: NextRequest, { id }) => {
  if (!isId(id)) throw bad('Invalid project id');
  const data = await body<any>(req);
  const action = String(data.action || '');
  const p: any = await Project.findById(id);
  if (!p) throw notFound('Project not found');
  const events: [string, string][] = [];
  const settings = await Settings.findOne({ key: 'workspace' }).lean<any>();
  let extra: Record<string, unknown> = {};

  switch (action) {
    /* ---------- Stage ---------- */
    case 'stage': {
      const target = String(data.stage);
      if (!STAGE_LABELS[target]) throw bad('Unknown stage');
      const err = stageError(p, target);
      if (err) throw bad(err);
      p.stage = target;
      if (target === 'closed') p.closedAt = new Date();
      await logActivity('stage', `Moved to ${STAGE_LABELS[target]}`, `${p.number} · ${p.title}`, id);
      break;
    }

    /* ---------- Appointments ---------- */
    case 'appointment.save': {
      const appt = await cleanAppointment(data.appointment || {}, p);
      const apptId = data.appointment?._id;
      await assertNoConflict(id, appt, apptId);
      if (apptId) {
        const a = findAppt(p, apptId);
        const keep = { status: a.status, checkedInAt: a.checkedInAt, completedAt: a.completedAt };
        Object.assign(a, appt);
        if (!data.appointment.status) Object.assign(a, keep);
        await logActivity('appointment', 'Appointment updated', `${appt.type} · ${appt.date} ${appt.start}`, id);
      } else {
        p.appointments.push(appt);
        await logActivity('appointment', appt.type === 'installation' ? 'Installation scheduled' : 'Event scheduled', `${p.number} · ${appt.date} ${appt.start}–${appt.end}`, id);
        events.push(['appointment_booked', `${appt.date}${appt.start}`]);
      }
      if (appt.type === 'installation') autoAdvance(p, 'scheduled');
      else if (appt.type === 'consultation') autoAdvance(p, 'consultation');
      else if (appt.type === 'measurement') autoAdvance(p, 'measurements');
      break;
    }
    case 'appointment.remove': {
      const a = findAppt(p, data.appointmentId);
      a.deleteOne();
      await logActivity('appointment', 'Appointment removed', `${p.number} · ${a.date} ${a.start}`, id);
      break;
    }
    case 'appointment.checkin': {
      const a = findAppt(p, data.appointmentId);
      if (!checkInAppt(p, a)) throw bad('This appointment is already checked in or completed.');
      if (a.shopStatus === 'booked' || a.shopStatus === 'arrived') a.shopStatus = 'in_bay';
      await logActivity('appointment', 'Installer checked in', `${p.number} · ${a.type}`, id);
      break;
    }
    case 'appointment.dispatch': {
      const a = findAppt(p, data.appointmentId);
      if (a.status !== 'scheduled') throw bad('Only scheduled visits can be dispatched.');
      a.status = 'dispatched';
      events.push(['installer_dispatched', String(a._id)]);
      await logActivity('appointment', 'Installer dispatched', `${p.number} · on the way`, id);
      break;
    }
    case 'appointment.complete': {
      const a = findAppt(p, data.appointmentId);
      if (!completeAppt(p, a)) throw bad('This appointment is already completed.');
      if (a.type === 'installation') events.push(['job_completed', String(a._id)]);
      await logActivity('appointment', 'Appointment completed', `${p.number} · ${a.type}`, id);
      break;
    }
    case 'appointment.reopen': {
      const a = findAppt(p, data.appointmentId);
      if (p.invoice) throw bad('An invoiced project cannot reopen its appointments.');
      a.status = 'checked_in';
      a.completedAt = undefined;
      if (a.type === 'installation') { p.install = { ...(p.install || {}), status: 'in_progress' }; p.markModified('install'); if (p.stage === 'invoicing') p.stage = 'in_progress'; }
      await logActivity('appointment', 'Appointment reopened', `${p.number}`, id);
      break;
    }
    case 'appointment.shopStatus': {
      const a = findAppt(p, data.appointmentId);
      const s = String(data.shopStatus);
      if (!['booked', 'arrived', 'in_bay', 'installing', 'ready', 'collected'].includes(s)) throw bad('Unknown shop status');
      a.shopStatus = s;
      if (['in_bay', 'installing', 'ready', 'collected'].includes(s)) checkInAppt(p, a);
      if (s === 'ready' || s === 'collected') {
        if (a.status !== 'completed') { completeAppt(p, a); if (a.type === 'installation') events.push(['job_completed', String(a._id)]); }
        if (s === 'ready') events.push(['vehicle_ready', String(a._id)]);
      }
      await logActivity('shop', `Shop status: ${s.replace('_', ' ')}`, `${p.number} · ${p.title}`, id);
      break;
    }

    /* ---------- Measurements ---------- */
    case 'measurements.save': {
      const m = data.measurements || {};
      if (!Array.isArray(m.groups)) throw bad('Measurements must contain groups');
      for (const g of m.groups) {
        if (!String(g.name || '').trim()) throw bad('Every area / room needs a name');
        for (const pn of g.panes || []) {
          if (pn.selected === false) continue;
          if (!String(pn.label || '').trim() || !(Number(pn.qty) >= 1) || !Number.isInteger(Number(pn.qty))) throw bad('Selected panes need a label and a whole quantity of at least 1.');
          if (!(Number(pn.width) > 0) || !(Number(pn.height) > 0)) throw bad('Selected panes need positive width and height when dimensions are enabled.');
        }
      }
      p.measurements = { ...m, measuredAt: new Date() };
      p.markModified('measurements');
      autoAdvance(p, 'measurements');
      const area = measuredArea(p.measurements);
      await logActivity('measurement', 'Measurements saved', `${p.number} · ${area.panes} panes · ${area.areaM2} m²`, id);
      break;
    }

    /* ---------- Proposal ---------- */
    case 'proposal.save': {
      if (p.invoice) throw bad('Pricing is locked to preserve the invoice and recorded payments. Duplicate the project for revised scope.');
      const prop = data.proposal || {};
      const err = validateProposal(prop);
      if (err) throw bad(err);
      if (!DATE_RX.test(String(prop.validUntil || '')) || prop.validUntil < todayStr()) throw bad('Set a current validity date and tax between 0 and 100%.');
      const prev = p.proposal || {};
      const ids = new Set(prop.options.map((o: any) => o.id));
      p.proposal = {
        ...prev,
        options: prop.options.map((o: any) => ({ ...o, discount: Number(o.discount) || 0, comparisonPrice: Number(o.comparisonPrice) || 0, lines: o.lines.map((l: any) => ({ ...l, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) })),
        intro: str(prop.intro, 'Opening message', { max: 4000 }),
        footer: str(prop.footer, 'Closing notes', { max: 4000 }),
        terms: str(prop.terms, 'Terms', { max: 4000 }),
        taxRate: Number(prop.taxRate),
        validUntil: prop.validUntil,
        deposit: { mode: ['none', 'fixed', 'percent'].includes(prop.deposit?.mode) ? prop.deposit.mode : 'none', value: Number(prop.deposit?.value) || 0 },
        showScope: prop.showScope !== false,
        afterApprovalMessage: str(prop.afterApprovalMessage, 'Message', { max: 2000 }),
        nextStepLabel: str(prop.nextStepLabel, 'Next step label', { max: 60 }),
        nextStepUrl: str(prop.nextStepUrl, 'Next step URL', { max: 400 }),
        internalSelection: (prop.internalSelection || []).filter((x: string) => ids.has(x)),
        selectedOptionIds: (prev.selectedOptionIds || []).filter((x: string) => ids.has(x)),
        status: prev.status || 'draft',
        token: prev.token || null,
      };
      if (p.proposal.internalSelection.length) {
        const selErr = validateSelection(p.proposal.options, p.proposal.internalSelection);
        if (selErr) throw bad(selErr);
      }
      p.markModified('proposal');
      p.value = proposalTotals(p.proposal).total;
      autoAdvance(p, 'proposal');
      await logActivity('proposal', 'Proposal saved', `${p.number} · $${p.value.toFixed(2)}`, id);
      break;
    }
    case 'proposal.fromPackage': {
      if (p.invoice) throw bad('This project cannot be repriced after an invoice has been issued.');
      if (!isId(data.packageId)) throw bad('Choose a proposal package');
      const pkg = await Package.findById(data.packageId).lean<any>();
      if (!pkg) throw notFound('Package not found');
      const intro = await renderTemplate(pkg.intro || '', p.toObject());
      p.proposal = {
        ...(p.proposal || {}),
        options: newIds(pkg.options),
        intro, footer: pkg.footer || '', terms: pkg.terms || settings?.defaults?.terms || '',
        taxRate: pkg.taxRate ?? settings?.business?.taxRate ?? 10,
        validUntil: addDays(todayStr(), pkg.validDays || 30),
        deposit: pkg.deposit || { mode: 'percent', value: 50 },
        showScope: pkg.showScope !== false,
        afterApprovalMessage: pkg.afterApprovalMessage || '', nextStepLabel: pkg.nextStepLabel || '', nextStepUrl: pkg.nextStepUrl || '',
        internalSelection: [], selectedOptionIds: [],
        status: p.proposal?.status === 'approved' ? 'draft' : p.proposal?.status || 'draft',
        token: p.proposal?.token || null,
      };
      p.markModified('proposal');
      p.value = proposalTotals(p.proposal).total;
      autoAdvance(p, 'proposal');
      await logActivity('proposal', 'Proposal package applied', `${pkg.name} → ${p.number}`, id);
      break;
    }
    case 'proposal.fromMeasurements': {
      if (p.invoice) throw bad('This project cannot be repriced after an invoice has been issued.');
      const groups = (p.measurements?.groups || []) as any[];
      const filmIds = Array.from(new Set(groups.flatMap((g) => (g.panes || []).map((x: any) => x.filmId || String(p.filmId || ''))).filter((x) => isId(x))));
      const films = await Film.find({ _id: { $in: filmIds } }).lean<any[]>();
      const fallback = p.filmId ? await Film.findById(p.filmId).lean<any>() : null;
      const filmOf = (fid: string) => films.find((f) => String(f._id) === fid) || fallback;
      const options: any[] = [];
      const areaOf = (panes: any[]) => measuredArea({ groups: [{ panes }] }).areaM2;
      if (p.segment === 'automotive') {
        const lines: any[] = [];
        const byFilm = new Map<string, any[]>();
        for (const g of groups) for (const pn of g.panes || []) if (pn.selected !== false) byFilm.set(pn.filmId || String(p.filmId || ''), [...(byFilm.get(pn.filmId || String(p.filmId || '')) || []), pn]);
        for (const [fid, panes] of byFilm) {
          const f = filmOf(fid);
          const area = areaOf(panes);
          lines.push({ id: uid(), name: f ? `${f.brand} ${f.name}` : 'Window film', coverage: `${panes.length} panes · ${area} m²`, detail: f?.description || '', qty: 1, unitPrice: round2(Math.max(180, area * (f?.sellPerM2 || 110))) });
        }
        if (!lines.length) throw bad('Save a measurement sheet with selected panes first.');
        options.push({ id: uid(), title: 'Measured film package', filmLabel: lines[0].name, group: '', recommended: true, detail: 'Calculated from the saved measurement sheet.', discount: 0, lines });
      } else {
        for (const g of groups) {
          const panes = (g.panes || []).filter((x: any) => x.selected !== false);
          if (!panes.length) continue;
          const f = filmOf(panes[0].filmId || String(p.filmId || ''));
          const area = areaOf(panes);
          options.push({ id: uid(), title: `${g.name}`, filmLabel: f ? `${f.name}` : 'Film', group: '', recommended: true, detail: `${panes.length} panes · ${area} m² measured`, discount: 0, lines: [{ id: uid(), name: f ? `${f.brand} ${f.name} · supply & install` : 'Window film · supply & install', coverage: 'Measured glass area (m²)', detail: '', qty: area, unitPrice: f?.sellPerM2 || 110 }] });
        }
        if (!options.length) throw bad('Save a measurement sheet with selected panes first.');
      }
      p.proposal = {
        ...(p.proposal || {}),
        options,
        intro: p.proposal?.intro || (await renderTemplate('Hi {{first_name}}, here is your proposal based on our measurements.', p.toObject())),
        footer: p.proposal?.footer || 'Prices cover the work described. Please contact us with any questions.',
        terms: p.proposal?.terms || settings?.defaults?.terms || '',
        taxRate: p.proposal?.taxRate ?? settings?.business?.taxRate ?? 10,
        validUntil: addDays(todayStr(), settings?.defaults?.validDays || 30),
        deposit: p.proposal?.deposit || { mode: 'percent', value: settings?.defaults?.depositPercent ?? 50 },
        showScope: true,
        internalSelection: [], selectedOptionIds: [],
        status: p.proposal?.status === 'approved' ? 'draft' : p.proposal?.status || 'draft',
        token: p.proposal?.token || null,
      };
      p.markModified('proposal');
      p.value = proposalTotals(p.proposal).total;
      autoAdvance(p, 'proposal');
      await logActivity('proposal', 'Proposal priced from measurements', `${p.number} · $${p.value.toFixed(2)}`, id);
      break;
    }
    case 'proposal.send': {
      if (!p.proposal) throw bad('Create a proposal first.');
      const err = validateProposal(p.proposal);
      if (err) throw bad(err);
      if (p.proposal.validUntil < todayStr()) throw bad('This proposal has expired. Update the validity date before sending.');
      p.proposal = { ...p.proposal, status: p.proposal.status === 'approved' ? 'approved' : 'sent', sentAt: new Date(), token: p.proposal.token || uid() + uid() };
      p.markModified('proposal');
      const link = publicUrl(`/review/${p.proposal.token}`);
      const contact = await Contact.findById(p.contactId).lean<any>();
      p.messages.push({ direction: 'out', channel: 'email', body: `Your window tinting proposal: ${link}`, from: 'Proposal sender', simulated: true });
      autoAdvance(p, 'proposal');
      await logActivity('proposal', 'Proposal sent', `${p.number} → ${contact?.email || contact?.name || 'customer'}`, id);
      events.push(['proposal_sent', String(p.proposal.sentAt.getTime())]);
      extra = { link };
      break;
    }
    case 'proposal.status': {
      if (!p.proposal) throw bad('Create a proposal before moving its status.');
      const order = ['draft', 'sent', 'viewed'];
      const s = String(data.status);
      if (s === 'approved') throw bad('Use “Record simulated approval” to approve a proposal.');
      if (!order.includes(s)) throw bad('Unknown proposal status');
      if (p.proposal.status === 'approved') throw bad('This proposal is already approved.');
      if (order.indexOf(s) !== order.indexOf(p.proposal.status) + 1 && order.indexOf(s) >= order.indexOf(p.proposal.status)) throw bad('Move proposal statuses in order: Draft, Sent, then Viewed.');
      p.proposal = { ...p.proposal, status: s, ...(s === 'sent' ? { sentAt: new Date(), token: p.proposal.token || uid() + uid() } : {}), ...(s === 'viewed' ? { viewedAt: new Date() } : {}) };
      p.markModified('proposal');
      await logActivity('proposal', `Proposal ${s}`, p.number, id);
      break;
    }
    case 'proposal.approve': {
      if (!p.proposal) throw bad('Create a proposal first.');
      if (!['sent', 'viewed'].includes(p.proposal.status)) throw bad(p.proposal.status === 'approved' ? 'This proposal is already approved.' : 'Send the proposal before recording approval.');
      const name = str(data.name, 'Customer signature name', { required: true, max: 120 });
      const ids = Array.isArray(data.optionIds) && data.optionIds.length ? data.optionIds : proposalTotals(p.proposal).selected;
      const err = validateSelection(p.proposal.options, ids);
      if (err) throw bad(err);
      p.proposal = { ...p.proposal, status: 'approved', approvedBy: name, approvedAt: new Date(), selectedOptionIds: ids, approvedVia: 'crm' };
      p.markModified('proposal');
      p.value = proposalTotals(p.proposal).total;
      autoAdvance(p, 'approval');
      await logActivity('proposal', 'Proposal approved', `${p.number} · ${name} · $${p.value.toFixed(2)}`, id);
      events.push(['proposal_approved', '']);
      break;
    }
    case 'proposal.link': {
      if (!p.proposal) throw bad('Create a proposal first.');
      p.proposal = { ...p.proposal, token: uid() + uid(), status: p.proposal.status === 'draft' ? 'sent' : p.proposal.status, sentAt: p.proposal.sentAt || new Date() };
      p.markModified('proposal');
      autoAdvance(p, 'proposal');
      extra = { link: publicUrl(`/review/${p.proposal.token}`) };
      await logActivity('proposal', 'Customer review link created', p.number, id);
      break;
    }
    case 'proposal.unlink': {
      if (!p.proposal?.token) throw bad('There is no active review link.');
      p.proposal = { ...p.proposal, token: null };
      p.markModified('proposal');
      await logActivity('proposal', 'Customer review link withdrawn', p.number, id);
      break;
    }

    /* ---------- Invoice & payments ---------- */
    case 'invoice.create': {
      if (p.invoice) throw bad('An invoice already exists for this project.');
      if (!p.proposal) throw bad('Create a proposal before invoicing.');
      const err = validateProposal(p.proposal);
      if (err) throw bad('Complete every service price before invoicing. A missing rate is not a free service.');
      if (p.proposal.status !== 'approved' && !data.force) throw bad("Confirm the customer's chosen options before invoicing this offer.");
      p.invoice = buildInvoice(p.toObject(), `INV-${await nextSeq('invoice', 2000)}`, settings?.defaults?.invoiceDueDays || 14);
      p.markModified('invoice');
      p.value = p.invoice.total;
      autoAdvance(p, 'invoicing');
      await logActivity('invoice', 'Invoice created', `${p.invoice.number} · $${p.invoice.total.toFixed(2)}`, id);
      break;
    }
    case 'invoice.send': {
      if (!p.invoice) throw bad('Create an invoice first.');
      p.invoice = { ...p.invoice, sentAt: new Date(), status: 'sent' };
      p.markModified('invoice');
      p.messages.push({ direction: 'out', channel: 'email', body: `Invoice ${p.invoice.number} for $${p.invoice.total.toFixed(2)} — due ${p.invoice.dueDate}.`, from: 'Accounts', simulated: true });
      await logActivity('invoice', 'Invoice sent (simulation)', p.invoice.number, id);
      break;
    }
    case 'payment.add': {
      const amount = round2(num(data.amount, 'Amount', { required: true, min: 0.01, max: 10_000_000 }));
      const date = str(data.date, 'Payment date') || todayStr();
      if (!DATE_RX.test(date)) throw bad('Choose a valid payment date');
      const kind = data.kind === 'deposit' ? 'deposit' : 'payment';
      const paidSoFar = paymentSummary(p).paid;
      if (!p.invoice) {
        if (kind !== 'deposit') throw bad('Create an invoice to record a payment. Deposits can be recorded before invoicing.');
        const quoted = p.proposal ? proposalTotals(p.proposal).total : 0;
        if (!quoted) throw bad('Create a priced proposal before recording a deposit.');
        if (paidSoFar + amount > quoted + 0.009) throw bad(`Deposit exceeds the quoted total ($${quoted.toFixed(2)}).`);
      } else if (paidSoFar + amount > p.invoice.total + 0.009) {
        throw bad(`Payment exceeds the outstanding balance ($${(p.invoice.total - paidSoFar).toFixed(2)}).`);
      }
      p.payments.push({ kind, amount, method: str(data.method, 'Payment method', { max: 60 }) || 'Bank transfer', date, reference: str(data.reference, 'Reference', { max: 80 }) });
      await logActivity('payment', kind === 'deposit' ? 'Deposit paid' : 'Payment received', `${p.number} · $${amount.toFixed(2)}`, id);
      events.push([kind === 'deposit' ? 'deposit_paid' : 'payment_received', `${date}:${amount}:${p.payments.length}`]);
      if (paymentSummary(p).status === 'paid' && autoAdvance(p, 'closed')) await logActivity('stage', 'Job closed', `${p.number} · paid in full`, id);
      break;
    }
    case 'payment.remove': {
      const pay = p.payments.id(data.paymentId);
      if (!pay) throw notFound('Payment not found');
      if (p.stage === 'closed') throw bad('Closed jobs keep their payment history.');
      pay.deleteOne();
      await logActivity('payment', 'Payment removed', `${p.number} · $${Number(pay.amount).toFixed(2)}`, id);
      break;
    }

    /* ---------- Install, film, messaging ---------- */
    case 'install.complete': {
      const active = p.appointments.find((a: any) => a.type === 'installation' && a.status === 'checked_in');
      if (!active && !hasCompletedInstall(p)) throw bad('Check in to an installation appointment before completing the job.');
      if (active) completeAppt(p, active);
      p.install = { ...(p.install || {}), status: 'complete', completedAt: new Date() };
      p.markModified('install');
      autoAdvance(p, 'invoicing');
      events.push(['job_completed', 'manual']);
      await logActivity('install', 'Installation complete', p.number, id);
      break;
    }
    case 'film.set': {
      if (!isId(data.filmId)) throw bad('Choose a film');
      const f = await Film.findById(data.filmId).lean<any>();
      if (!f) throw notFound('Film not found');
      p.filmId = f._id;
      p.filmShade = data.shade !== undefined ? Number(data.shade) : f.shades?.[0]?.vlt;
      await logActivity('film', 'Film type set', `${f.brand} ${f.name} ${p.filmShade ?? ''}%`, id);
      break;
    }
    case 'message.send': {
      const text = str(data.body, 'Message', { required: true, max: 1600 });
      const rendered = await renderTemplate(text, p.toObject());
      p.messages.push({ direction: 'out', channel: data.channel === 'email' ? 'email' : 'sms', body: rendered, from: 'Workspace Admin', simulated: true });
      await logActivity('message', 'Customer message (simulated)', `${p.number} · ${rendered.slice(0, 80)}`, id);
      break;
    }
    case 'message.reply': {
      const contact = await Contact.findById(p.contactId).lean<any>();
      const text = str(data.body, 'Reply', { max: 1600 }) || 'Sounds great, looking forward to it!';
      p.messages.push({ direction: 'in', channel: 'sms', body: text, from: contact?.name || 'Customer', simulated: true });
      await logActivity('message', 'Customer replied', `${contact?.name || 'Customer'}: ${text.slice(0, 80)}`, id);
      break;
    }
    case 'contact.update': {
      const c = data.contact || {};
      const name = str(c.name, 'Contact name', { required: true, max: 120 });
      await Contact.updateOne({ _id: p.contactId }, { $set: { name, company: str(c.company, 'Company', { max: 120 }), email: str(c.email, 'Email', { max: 120 }).toLowerCase(), phone: str(c.phone, 'Phone', { max: 40 }), address: str(c.address, 'Address', { max: 300 }) } });
      await logActivity('contact', 'Contact updated', name, id);
      break;
    }

    /* ---------- Lifecycle ---------- */
    case 'duplicate': {
      const src = p.toObject();
      const number = `PRJ-${await nextSeq('project')}`;
      const copy = await Project.create({
        ...src, _id: new mongoose.Types.ObjectId(), number, title: `${src.title} (copy)`, stage: src.proposal ? 'proposal' : 'lead',
        appointments: [], invoice: null, payments: [], messages: [], archived: false, closedAt: undefined,
        install: { status: 'pending' },
        proposal: src.proposal ? { ...src.proposal, options: newIds(src.proposal.options), status: 'draft', token: null, sentAt: null, viewedAt: null, approvedAt: null, approvedBy: '', selectedOptionIds: [], internalSelection: [] } : null,
        createdAt: undefined, updatedAt: undefined,
      });
      await logActivity('project', 'Project duplicated', `${p.number} → ${number}`, copy._id);
      return { duplicated: await loadProject(String(copy._id)) };
    }
    case 'archive':
    case 'restore': {
      p.archived = action === 'archive';
      await logActivity('project', action === 'archive' ? 'Project archived' : 'Project restored', p.number, id);
      break;
    }
    default:
      throw bad(`Unknown action "${action}"`);
  }

  await p.save();
  const fresh = p.toObject();
  for (const [trigger, ref] of events) await fire(trigger, fresh, ref);
  return { ...(await loadProject(id)), ...extra };
});

function hasCompletedInstall(p: any) {
  return p.appointments.some((a: any) => a.type === 'installation' && a.status === 'completed');
}
