import { NextRequest } from 'next/server';
import { Film, Project, Roll, Settings } from '@/lib/models';
import { bad, body, handler, isId, notFound } from '@/lib/http';
import { runAdvisor, type AdvisorInput, type FilmLite } from '@/lib/engine/advisor';
import { bestCut } from '@/lib/engine/cut';

export const dynamic = 'force-dynamic';

/**
 * Smart Film Advisor.
 * Body: AdvisorInput (+ optional projectId to use the project's saved measurement sheet, storeId for stock checks).
 * Body with { mode: 'cut', pieces, widths, trimMm } returns only a cut plan.
 */
export const POST = handler(async (req: NextRequest) => {
  const data = await body<any>(req);
  if (data.mode === 'cut') {
    if (!Array.isArray(data.pieces) || !data.pieces.length) throw bad('Add at least one pane');
    const pieces = data.pieces.map((p: any) => ({ label: String(p.label || 'Pane'), w: Number(p.w) || 0, h: Number(p.h) || 0, qty: Number(p.qty) || 1 })).filter((p: any) => p.w > 0 && p.h > 0);
    if (!pieces.length) throw bad('Panes need positive width and height');
    const widths = (Array.isArray(data.widths) ? data.widths : [1524]).map(Number).filter((w: number) => w > 0);
    return bestCut(pieces, widths, Number(data.trimMm) || 10);
  }

  const settings = await Settings.findOne({ key: 'workspace' }).lean<any>();
  const input: AdvisorInput = {
    segment: ['automotive', 'residential', 'commercial'].includes(data.segment) ? data.segment : 'automotive',
    region: data.region || settings?.region || 'AU-WA',
    bodyType: data.bodyType,
    privacyRear: !!data.privacyRear,
    includeVisor: !!data.includeVisor,
    includeSunroof: !!data.includeSunroof,
    panes: Array.isArray(data.panes) ? data.panes : undefined,
    goals: data.goals || {},
    glassType: data.glassType,
    orientation: data.orientation,
    climate: data.climate,
    shading: !!data.shading,
    removal: !!data.removal,
    preferSignalSafe: data.preferSignalSafe !== false,
    trimMm: Number(data.trimMm) || settings?.defaults?.trimMm || 10,
    electricityRate: Number(data.electricityRate) || settings?.defaults?.electricityRate || 0.32,
    labourRate: Number(data.labourRate) || settings?.defaults?.labourRate || 55,
    chargeOutRate: Number(data.chargeOutRate) || settings?.defaults?.chargeOutRate || 70,
  };

  if (data.projectId) {
    if (!isId(data.projectId)) throw bad('Invalid project id');
    const p = await Project.findById(data.projectId).lean<any>();
    if (!p) throw notFound('Project not found');
    input.segment = p.segment;
    if (p.vehicle?.bodyType && !input.bodyType) input.bodyType = p.vehicle.bodyType;
    const panes = (p.measurements?.groups || []).flatMap((g: any) =>
      (g.panes || []).filter((x: any) => x.selected !== false).map((x: any) => ({ label: `${g.name} · ${x.label}`, zone: x.zone, width: Number(x.width), height: Number(x.height), unit: x.unit, qty: Number(x.qty) || 1 })),
    );
    if (panes.length && !input.panes?.length) input.panes = panes;
    if (!data.glassType && p.property?.glazing) input.glassType = /low-?e/i.test(p.property.glazing) ? 'low_e' : /double/i.test(p.property.glazing) ? 'double_glazed' : /tint/i.test(p.property.glazing) ? 'single_tinted' : 'single_clear';
    if (!data.orientation && p.property?.orientation) input.orientation = p.property.orientation;
    if (!data.storeId) data.storeId = String(p.storeId || '');
  }

  const films = (await Film.find({ active: { $ne: false } }).lean<any[]>()).map((f) => ({ ...f, _id: String(f._id) })) as unknown as FilmLite[];
  const rolls = await Roll.find({ archived: { $ne: true }, ...(isId(data.storeId) ? { storeId: data.storeId } : {}) }).lean<any[]>();
  input.stock = rolls.map((r) => ({ filmId: String(r.filmId), widthMm: r.widthMm, remainingM2: r.remainingM2, shade: r.shade }));
  return runAdvisor(films, input);
});
