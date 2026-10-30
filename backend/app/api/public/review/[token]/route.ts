import { NextRequest } from 'next/server';
import { Contact, Project, Settings, Store } from '@/lib/models';
import { bad, body, conflict, handler, notFound, str, todayStr } from '@/lib/http';
import { autoAdvance, logActivity, measuredArea, optionTotals, proposalTotals, validateSelection } from '@/lib/project';
import { fire } from '@/lib/automation';

export const dynamic = 'force-dynamic';

async function find(token: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) throw notFound('This link has been withdrawn.');
  const p: any = await Project.findOne({ 'proposal.token': token, archived: false });
  if (!p || !p.proposal) throw notFound('This link has been withdrawn.');
  return p;
}

async function snapshot(p: any) {
  const [settings, contact, store] = await Promise.all([
    Settings.findOne({ key: 'workspace' }).lean<any>(),
    Contact.findById(p.contactId).select('name').lean<any>(),
    Store.findById(p.storeId).select('name phone address').lean<any>(),
  ]);
  const pr = p.proposal;
  const scope = pr.showScope !== false
    ? (p.measurements?.groups || []).map((g: any) => ({ name: g.name, panes: (g.panes || []).filter((x: any) => x.selected !== false).length, areaM2: measuredArea({ groups: [g] }).areaM2 })).filter((g: any) => g.panes)
    : [];
  return {
    business: { name: settings?.business?.name || 'TotalOps', phone: store?.phone || settings?.business?.phone, email: settings?.business?.email, address: settings?.business?.address, logoUrl: settings?.business?.logoUrl ? '/api/public/logo' : '' },
    store: store ? { name: store.name, phone: store.phone, address: store.address } : null,
    project: { number: p.number, title: p.title, segment: p.segment, vehicle: p.vehicle, property: p.property },
    customerFirstName: (contact?.name || '').split(' ')[0],
    intro: pr.intro, footer: pr.footer, terms: pr.terms,
    taxRate: pr.taxRate, validUntil: pr.validUntil,
    expired: !!pr.validUntil && pr.validUntil < todayStr() && pr.status !== 'approved',
    deposit: pr.deposit,
    status: pr.status,
    approvedBy: pr.approvedBy || '', approvedAt: pr.approvedAt || null,
    selectedOptionIds: pr.selectedOptionIds || [],
    recommendedSelection: proposalTotals({ ...pr, selectedOptionIds: [] }).selected,
    afterApprovalMessage: pr.afterApprovalMessage, nextStepLabel: pr.nextStepLabel, nextStepUrl: pr.nextStepUrl,
    scope,
    options: (pr.options || []).map((o: any) => ({
      id: o.id, title: o.title, filmLabel: o.filmLabel, group: o.group || '', recommended: !!o.recommended, detail: o.detail, comparisonPrice: o.comparisonPrice || 0,
      lines: (o.lines || []).map((l: any) => ({ name: l.name, coverage: l.coverage, qty: l.qty, unitPrice: l.unitPrice })),
      totals: optionTotals(o, pr.taxRate),
    })),
  };
}

export const GET = handler<{ token: string }>(async (_req, { token }) => {
  const p = await find(token);
  if (p.proposal.status === 'sent') {
    p.proposal = { ...p.proposal, status: 'viewed', viewedAt: new Date() };
    p.markModified('proposal');
    await p.save();
    await logActivity('proposal', 'Proposal viewed', `${p.number} · customer opened the link`, p._id);
  }
  return snapshot(p);
});

export const POST = handler<{ token: string }>(async (req: NextRequest, { token }) => {
  const p = await find(token);
  const data = await body<{ name?: string; optionIds?: string[]; acknowledge?: boolean }>(req);
  if (p.proposal.status === 'approved') throw conflict('This proposal is already approved.');
  if (p.proposal.validUntil && p.proposal.validUntil < todayStr()) throw bad('This offer has expired. Please contact the team for a current version.');
  const name = str(data.name, 'Your name', { required: true, max: 120 });
  if (!data.acknowledge) throw bad('Enter your name and acknowledge this confirmation.');
  const ids = Array.isArray(data.optionIds) ? data.optionIds.map(String) : [];
  const err = validateSelection(p.proposal.options, ids);
  if (err) throw bad(err);
  p.proposal = { ...p.proposal, status: 'approved', approvedBy: name, approvedAt: new Date(), selectedOptionIds: ids, approvedVia: 'customer_link' };
  p.markModified('proposal');
  p.value = proposalTotals(p.proposal).total;
  autoAdvance(p, 'approval');
  await p.save();
  await logActivity('proposal', 'Proposal approved', `${p.number} · ${name} approved $${p.value.toFixed(2)}`, p._id);
  await fire('proposal_approved', p.toObject());
  return snapshot(p);
});
