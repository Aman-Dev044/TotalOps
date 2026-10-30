import { Automation, Contact, Note, Project, Settings, Store, Template } from './models';
import { addDays, publicUrl, todayStr } from './http';
import { logActivity, paymentSummary } from './project';

export const TRIGGERS: { key: string; label: string; timed?: boolean }[] = [
  { key: 'lead_created', label: 'New lead created' },
  { key: 'proposal_sent', label: 'Proposal sent' },
  { key: 'proposal_no_response', label: 'Proposal sent, no response after delay', timed: true },
  { key: 'proposal_approved', label: 'Proposal approved by customer' },
  { key: 'appointment_booked', label: 'Appointment booked' },
  { key: 'appointment_reminder', label: 'Day-before appointment reminder', timed: true },
  { key: 'installer_dispatched', label: 'Installer on the way' },
  { key: 'vehicle_ready', label: 'Vehicle ready for pickup' },
  { key: 'deposit_paid', label: 'Deposit paid' },
  { key: 'payment_received', label: 'Payment received' },
  { key: 'job_completed', label: 'Installation completed' },
  { key: 'job_closed', label: 'Paid job closed (review request)', timed: true },
];

export async function renderTemplate(text: string, project: any, extra: Record<string, string> = {}) {
  const [contact, store, settings] = await Promise.all([
    project.contactId ? Contact.findById(project.contactId).lean<any>() : null,
    project.storeId ? Store.findById(project.storeId).lean<any>() : null,
    Settings.findOne({ key: 'workspace' }).lean<any>(),
  ]);
  const appt = (project.appointments || []).filter((a: any) => a.status !== 'cancelled').sort((a: any, b: any) => (a.date + a.start).localeCompare(b.date + b.start)).find((a: any) => a.date >= todayStr());
  const v = project.vehicle || {};
  const vars: Record<string, string> = {
    name: contact?.name || 'there',
    first_name: (contact?.name || 'there').split(' ')[0],
    business: settings?.business?.name || 'TotalOps',
    store: store?.name || '',
    store_phone: store?.phone || settings?.business?.phone || '',
    project: project.title || '',
    number: project.number || '',
    vehicle: [v.year, v.make, v.model].filter(Boolean).join(' '),
    date: appt?.date || '',
    time: appt?.start || '',
    balance: `$${paymentSummary(project).balance.toFixed(2)}`,
    link: project.proposal?.token ? publicUrl(`/review/${project.proposal.token}`) : '',
    ...extra,
  };
  return (text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

async function execute(auto: any, project: any, key: string, manual = false) {
  if (!manual && auto.firedKeys?.includes(key)) return null;
  let text = auto.message || '';
  if (auto.templateId) {
    const t = await Template.findById(auto.templateId).lean<any>();
    if (t?.body) text = t.body;
  }
  const body = await renderTemplate(text || `Automation "${auto.name}" ran for {{project}}.`, project);
  let result = '';
  if (auto.action === 'create_task') {
    await Note.create({ kind: 'task', text: body, projectId: project._id, assignedTo: 'Office', author: `Automation · ${auto.name}` });
    result = 'Task created';
  } else {
    await Project.updateOne(
      { _id: project._id },
      { $push: { messages: { direction: 'out', channel: auto.channel || 'sms', body, from: `Automation · ${auto.name}`, simulated: true } } },
    );
    result = `${(auto.channel || 'sms').toUpperCase()} queued (simulated)`;
  }
  const run = { at: new Date(), projectId: String(project._id), projectNumber: project.number, projectTitle: project.title, result, preview: body.slice(0, 280), manual };
  await Automation.updateOne(
    { _id: auto._id },
    { $push: { runs: { $each: [run], $position: 0, $slice: 60 }, ...(manual ? {} : { firedKeys: { $each: [key], $slice: -2000 } }) } },
  );
  await logActivity('automation', `Automation: ${auto.name}`, `${result} · ${project.number}`, project._id);
  return run;
}

/** Fires every enabled, immediate automation listening to this trigger. Never throws. */
export async function fire(trigger: string, project: any, ref = '') {
  try {
    const autos = await Automation.find({ trigger, enabled: true }).lean();
    for (const a of autos) {
      if (TRIGGERS.find((t) => t.key === trigger)?.timed) continue;
      await execute(a, project, `${project._id}:${trigger}:${ref}`);
    }
  } catch (err) {
    console.error('[automation]', err);
  }
}

export async function runManually(autoId: string, projectId: string) {
  const [auto, project] = await Promise.all([Automation.findById(autoId).lean<any>(), Project.findById(projectId).lean<any>()]);
  if (!auto || !project) return null;
  return execute(auto, project, `manual:${Date.now()}`, true);
}

let lastSweep = 0;
/** Evaluates time-based automations. Called lazily (dashboard / notifications), throttled to once a minute. */
export async function sweep(force = false) {
  if (!force && Date.now() - lastSweep < 60_000) return 0;
  lastSweep = Date.now();
  let count = 0;
  try {
    const autos = await Automation.find({ enabled: true, trigger: { $in: ['proposal_no_response', 'appointment_reminder', 'job_closed'] } }).lean<any[]>();
    if (!autos.length) return 0;
    const now = Date.now();
    for (const a of autos) {
      const delayMs = (Number(a.delayHours) || 0) * 3600_000;
      if (a.trigger === 'proposal_no_response') {
        const list = await Project.find({ archived: false, 'proposal.status': { $in: ['sent', 'viewed'] } }).lean<any[]>();
        for (const p of list) {
          const sent = p.proposal?.sentAt ? new Date(p.proposal.sentAt).getTime() : 0;
          if (sent && now - sent >= delayMs && (await execute(a, p, `${p._id}:${a.trigger}:${sent}`))) count++;
        }
      }
      if (a.trigger === 'appointment_reminder') {
        const tomorrow = addDays(todayStr(), 1);
        const list = await Project.find({ archived: false, appointments: { $elemMatch: { date: tomorrow, status: { $in: ['scheduled', 'dispatched'] } } } }).lean<any[]>();
        for (const p of list) {
          for (const ap of p.appointments.filter((x: any) => x.date === tomorrow && x.reminder !== false && x.status !== 'cancelled')) {
            if (await execute(a, p, `${p._id}:${a.trigger}:${ap._id}`)) count++;
          }
        }
      }
      if (a.trigger === 'job_closed') {
        const list = await Project.find({ stage: 'closed', closedAt: { $lte: new Date(now - delayMs), $gte: new Date(now - 30 * 86400_000) } }).lean<any[]>();
        for (const p of list) if (await execute(a, p, `${p._id}:${a.trigger}`)) count++;
      }
    }
  } catch (err) {
    console.error('[automation sweep]', err);
  }
  return count;
}
