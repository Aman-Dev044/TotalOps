import { NextRequest } from 'next/server';
import { Settings } from '@/lib/models';
import { bad, body, handler } from '@/lib/http';
import { LEGAL_RULES } from '@/lib/engine/legal';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => Settings.findOne({ key: 'workspace' }).lean());

/** Merges top-level sections (business, defaults, measurementProfiles, roles, region). */
export const PATCH = handler(async (req: NextRequest) => {
  const data = await body<any>(req);
  const set: Record<string, unknown> = {};
  if (data.region !== undefined) {
    if (!LEGAL_RULES.some((r) => r.code === data.region)) throw bad('Unknown legal region');
    set.region = data.region;
  }
  if (data.business) {
    const tax = Number(data.business.taxRate);
    if (data.business.taxRate !== undefined && !(tax >= 0 && tax <= 100)) throw bad('Tax must be between 0 and 100%');
    if (data.business.name !== undefined && !String(data.business.name).trim()) throw bad('Business name is required');
    for (const [k, v] of Object.entries(data.business)) set[`business.${k}`] = v;
  }
  if (data.defaults) for (const [k, v] of Object.entries(data.defaults)) set[`defaults.${k}`] = v;
  if (data.measurementProfiles) set.measurementProfiles = data.measurementProfiles;
  if (data.roles) {
    if (!Array.isArray(data.roles)) throw bad('Roles must be a list');
    const names = data.roles.map((r: any) => String(r.name || '').trim().toLowerCase());
    if (names.some((n: string) => !n)) throw bad('Give this role a name before saving.');
    if (new Set(names).size !== names.length) throw bad('Role names must be unique.');
    set.roles = data.roles;
  }
  return Settings.findOneAndUpdate({ key: 'workspace' }, { $set: set }, { new: true, upsert: true }).lean();
});

export const PUT = PATCH;
