import { NextRequest } from 'next/server';
import { Activity, Automation, Dealer, LeadForm, Project, Review, Roll, Template } from '@/lib/models';
import { bad, body, handler, isId, notFound, num, round2, str, uid } from '@/lib/http';
import { logActivity } from '@/lib/project';
import { renderTemplate, runManually, sweep } from '@/lib/automation';
import { submitLead } from '@/lib/leads';

export const dynamic = 'force-dynamic';

/** Domain actions that do not fit plain CRUD. POST { action, ...payload } */
export const POST = handler<{ resource: string; id: string }>(async (req: NextRequest, { resource, id }) => {
  const data = await body<any>(req);
  const action = String(data.action || '');

  if (resource === 'activities' && id === 'all') {
    if (action === 'readAll') await Activity.updateMany({ read: false }, { $set: { read: true } });
    else if (action === 'deleteAll') await Activity.deleteMany({});
    else throw bad('Unknown action');
    return { ok: true };
  }
  if (resource === 'automations' && id === 'sweep') return { ran: await sweep(true) };
  if (!isId(id)) throw bad('Invalid id');

  if (resource === 'inventory') {
    const roll: any = await Roll.findById(id);
    if (!roll) throw notFound('Film roll not found');
    const move = (type: string, qty: number, note: string, projectId?: string, projectNumber?: string) => {
      roll.movements = [{ id: uid(), type, qty: round2(qty), note, projectId, projectNumber, balance: round2(roll.remainingM2), at: new Date() }, ...(roll.movements || [])].slice(0, 200);
      roll.markModified('movements');
    };
    if (action === 'allocate') {
      const qty = num(data.qty, 'Area (m²)', { required: true, min: 0.01, max: 100000 });
      if (!isId(data.projectId)) throw bad('Enter a valid allocation.');
      const p = await Project.findById(data.projectId).lean<any>();
      if (!p) throw notFound('Project not found');
      if (String(p.storeId) !== String(roll.storeId)) throw bad('Allocate film to a project at the same store.');
      if (qty > roll.remainingM2 + 0.0001) throw bad('Not enough stock for this allocation.');
      roll.remainingM2 = round2(roll.remainingM2 - qty);
      move('allocated', -qty, str(data.note, 'Note', { max: 300 }) || `Allocated to ${p.number}`, String(p._id), p.number);
      await logActivity('inventory', 'Film allocated', `${roll.name} · ${qty} m² → ${p.number}`, p._id);
      if (roll.remainingM2 <= roll.reorderAtM2) await logActivity('inventory', 'Low film stock', `${roll.brand} ${roll.name} · ${roll.remainingM2} m² left`, undefined, '/inventory');
    } else if (action === 'reorder') {
      roll.reorderPending = true;
      move('reorder', 0, str(data.note, 'Note', { max: 300 }) || 'Reorder requested');
      await logActivity('inventory', 'Reorder placed', `${roll.brand} ${roll.name}`, undefined, '/inventory');
    } else if (action === 'receive') {
      const qty = num(data.qty, 'Area (m²)', { required: true, min: 0.01, max: 100000 });
      roll.remainingM2 = round2(roll.remainingM2 + qty);
      roll.reorderPending = false;
      move('received', qty, str(data.note, 'Note', { max: 300 }) || 'Reorder received');
      await logActivity('inventory', 'Stock received', `${roll.name} · +${qty} m²`, undefined, '/inventory');
    } else if (action === 'adjust') {
      const qty = num(data.qty, 'Adjustment', { required: true, min: -100000, max: 100000 });
      const reason = str(data.note, 'Reason', { required: true, max: 300 });
      if (roll.remainingM2 + qty < 0) throw bad('Stock cannot become negative.');
      roll.remainingM2 = round2(roll.remainingM2 + qty);
      move('adjusted', qty, reason);
    } else throw bad('Unknown inventory action');
    await roll.save();
    return roll.toObject();
  }

  if (resource === 'automations') {
    if (action === 'run') {
      const a = await Automation.findById(id).lean<any>();
      if (!a) throw notFound('Automation not found');
      if (!a.enabled) throw bad('Enable this automation before running a simulation.');
      if (!isId(data.projectId)) throw bad('Choose a project to run against');
      const run = await runManually(id, data.projectId);
      if (!run) throw notFound('Project not found');
      return { run, automation: await Automation.findById(id).select('-firedKeys').lean() };
    }
    if (action === 'preview') {
      const a = await Automation.findById(id).lean<any>();
      if (!a) throw notFound('Automation not found');
      const p = isId(data.projectId) ? await Project.findById(data.projectId).lean<any>() : await Project.findOne({ archived: false }).lean<any>();
      const t = a.templateId ? await Template.findById(a.templateId).lean<any>() : null;
      return { preview: p ? await renderTemplate(t?.body || a.message || '', p) : t?.body || a.message || '' };
    }
    throw bad('Unknown automation action');
  }

  if (resource === 'reviews') {
    const r: any = await Review.findById(id);
    if (!r) throw notFound('Review not found');
    if (action !== 'send') throw bad('Unknown review action');
    const p = r.projectId ? await Project.findById(r.projectId).lean<any>() : null;
    const t = await Template.findOne({ purpose: 'review' }).lean<any>();
    const message = p ? await renderTemplate(t?.body || 'Thanks for choosing {{business}}! Would you leave us a review?', p) : 'Thanks for choosing us! Would you leave us a review?';
    r.status = r.status === 'published' ? 'published' : 'sent';
    r.log = [{ at: new Date(), channel: 'sms', message, simulated: true }, ...(r.log || [])].slice(0, 50);
    r.markModified('log');
    await r.save();
    await logActivity('review', 'Review request sent (simulated)', r.customerName || '', r.projectId);
    return r.toObject();
  }

  if (resource === 'leadforms') {
    const form = await LeadForm.findById(id).lean<any>();
    if (!form) throw notFound('Lead form not found');
    if (action !== 'test') throw bad('Unknown form action');
    return submitLead(form, data.data || {}, true);
  }

  if (resource === 'dealers') {
    if (action !== 'regenerate') throw bad('Unknown dealer action');
    const d = await Dealer.findByIdAndUpdate(id, { $set: { token: uid() + uid() } }, { new: true }).lean();
    if (!d) throw notFound('Dealer not found');
    return d;
  }

  throw bad('Unknown resource action');
});
