import type { OfferOption, Proposal } from '@/lib/types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Mirrors backend lib/project.ts so totals shown in the builder match what the server stores. */
export function optionTotals(o: OfferOption, taxRate = 0) {
  const subtotal = round2((o.lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0));
  const discount = Math.min(subtotal, Math.max(0, Number(o.discount) || 0));
  const taxable = subtotal - discount;
  const tax = round2((taxable * (Number(taxRate) || 0)) / 100);
  return { subtotal, discount: round2(discount), tax, total: round2(taxable + tax) };
}

export function defaultSelection(options: OfferOption[]) {
  const picked: string[] = [];
  const groups = new Map<string, OfferOption[]>();
  for (const o of options || []) {
    const g = (o.group || '').trim();
    if (!g) picked.push(o.id);
    else groups.set(g, [...(groups.get(g) || []), o]);
  }
  for (const list of groups.values()) picked.push((list.find((o) => o.recommended) || list[0]).id);
  return picked;
}

export function validateSelection(options: OfferOption[], ids: string[]) {
  if (!ids.length) return 'Choose at least one offer option.';
  const byId = new Map(options.map((o) => [o.id, o]));
  const seen = new Set<string>();
  for (const id of ids) {
    const o = byId.get(id);
    if (!o) return 'Choose valid offer options.';
    const g = (o.group || '').trim();
    if (g) {
      if (seen.has(g)) return 'Choose only one option from each alternative group.';
      seen.add(g);
    }
  }
  return null;
}

export function selectionTotals(options: OfferOption[], taxRate: number, ids: string[], deposit?: Proposal['deposit']) {
  const chosen = options.filter((o) => ids.includes(o.id));
  const sum = chosen.reduce(
    (acc, o) => {
      const t = optionTotals(o, taxRate);
      return { subtotal: acc.subtotal + t.subtotal, discount: acc.discount + t.discount, tax: acc.tax + t.tax, total: acc.total + t.total };
    },
    { subtotal: 0, discount: 0, tax: 0, total: 0 },
  );
  const dep = deposit || { mode: 'none', value: 0 };
  const depositAmt = dep.mode === 'percent' ? (sum.total * (Number(dep.value) || 0)) / 100 : dep.mode === 'fixed' ? Math.min(sum.total, Number(dep.value) || 0) : 0;
  return { subtotal: round2(sum.subtotal), discount: round2(sum.discount), tax: round2(sum.tax), total: round2(sum.total), deposit: round2(depositAmt) };
}

/** Toggle an option in a selection respecting alternative groups (choose one per group). */
export function toggleOption(options: OfferOption[], ids: string[], id: string) {
  const o = options.find((x) => x.id === id);
  if (!o) return ids;
  const g = (o.group || '').trim();
  if (!g) return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  const others = options.filter((x) => (x.group || '').trim() === g).map((x) => x.id);
  return [...ids.filter((x) => !others.includes(x)), id];
}
