'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Leaf, ShieldCheck, Sparkles, ThermometerSun, XCircle } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { Badge, Button, Drawer, Progress, Spinner } from '@/components/ui';
import type { RunFn } from './use-project-action';

export function AdvisorDrawer({ open, onClose, projectId, run }: { open: boolean; onClose: () => void; projectId: string; run: RunFn }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    api
      .post('/advisor', { projectId })
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const apply = async (r: any) => {
    const shade = r.zoneShades?.rearSides ?? r.zoneShades?.rearWindscreen ?? r.shade?.vlt;
    const ok = await run('film.set', { filmId: r.film._id, shade }, `${r.film.brand} ${r.film.name} applied`);
    if (ok) onClose();
  };

  const best = data?.best;
  return (
    <Drawer open={open} onClose={onClose} width={620} title="Smart film recommendation" subtitle="Uses the saved measurement sheet, legal limits, glass type and stock on hand.">
      {loading ? (
        <div className="grid h-60 place-items-center"><Spinner className="h-8 w-8" /></div>
      ) : error ? (
        <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>
      ) : best ? (
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-fuchsia-500/10 to-transparent p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="primary"><Sparkles className="h-3 w-3" /> Best match</Badge>
                <p className="mt-2 font-display text-xl font-extrabold">{best.film.brand} {best.film.name}</p>
                <p className="text-sm capitalize text-muted-fg">{best.film.category} · {best.film.warrantyYears >= 25 ? 'lifetime' : `${best.film.warrantyYears}-year`} warranty</p>
              </div>
              <div className="text-right">
                <p className="font-display text-4xl font-extrabold text-primary">{best.score}</p>
                <p className="text-xs text-muted-fg">match score</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{data.summary}</p>
            <Button className="mt-4" icon={CheckCircle2} onClick={() => apply(best)}>Apply this film</Button>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['VLT', `${best.perf.vlt}%`],
              ['Solar rejected', `${best.perf.tser}%`],
              ['IR rejected', `${best.perf.irr}%`],
              ['UV blocked', `${best.perf.uvr}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-3 text-center">
                <p className="text-[11px] text-muted-fg">{k}</p>
                <p className="font-display text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="label">Why this film</p>
            <ul className="space-y-1.5 text-sm">
              {best.reasons.map((r: string) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{r}</li>)}
              {best.warnings.map((w: string) => <li key={w} className="flex gap-2 text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</li>)}
            </ul>
          </div>

          {best.compliance?.length ? (
            <div>
              <p className="label flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Legal shades · {data.legal?.name}</p>
              <div className="overflow-hidden rounded-xl border border-line">
                {best.compliance.map((c: any) => (
                  <div key={c.zone} className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-0">
                    <span className="font-medium">{c.label}</span>
                    <span className="flex items-center gap-2 text-xs">
                      {c.filmVlt != null ? <Badge tone="primary">{c.filmVlt}% film</Badge> : <Badge>No film</Badge>}
                      <span className={c.ok ? 'text-success' : 'text-danger'}>{c.ok ? <CheckCircle2 className="inline h-3.5 w-3.5" /> : <XCircle className="inline h-3.5 w-3.5" />} {c.message}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="label">Per-pane sizing</p>
            <div className="max-h-60 overflow-y-auto rounded-xl border border-line">
              <table className="table-base text-xs">
                <thead><tr><th>Pane</th><th>Size</th><th>Cut</th><th>Roll</th><th>VLT</th></tr></thead>
                <tbody>
                  {data.panes.map((pn: any, i: number) => (
                    <tr key={i}>
                      <td>{pn.label}{pn.qty > 1 ? ` ×${pn.qty}` : ''}</td>
                      <td>{pn.widthMm}×{pn.heightMm}</td>
                      <td>{pn.cutSize}</td>
                      <td className={pn.fits ? '' : 'text-danger'}>{pn.rollWidth}{pn.fits ? '' : ` (${pn.drops} drops)`}</td>
                      <td>{pn.recommendedVlt != null ? `${pn.recommendedVlt}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4 text-sm">
              <p className="label">Pricing & margin</p>
              <p>Suggested price <b>{money(best.pricing.sell)}</b></p>
              <p className="text-muted-fg">Material {money(best.pricing.costMaterial)} · Labour {money(best.pricing.costLabour)} ({best.pricing.labourHours} h)</p>
              <div className="mt-2 flex items-center gap-2"><Progress value={best.pricing.marginPct} tone={best.pricing.marginPct > 35 ? 'success' : 'warning'} /><span className="text-xs font-bold">{best.pricing.marginPct}%</span></div>
              <p className="mt-2 text-xs text-muted-fg">{best.pricing.materialM2} m² from {best.pricing.rollWidth} mm roll · {best.pricing.linearM} lm · {best.pricing.wastePct}% waste</p>
              <p className={`mt-1 text-xs font-semibold ${best.stock.enough ? 'text-success' : 'text-danger'}`}>Stock on hand: {best.stock.availableM2} m² {best.stock.enough ? '✓ enough' : '— reorder needed'}</p>
            </div>
            <div className="rounded-xl border border-line p-4 text-sm">
              <p className="label flex items-center gap-1"><ThermometerSun className="h-3.5 w-3.5" /> Comfort & savings</p>
              {data.savings?.cabinTempDropC ? <p>Parked cabin up to <b>{data.savings.cabinTempDropC}°C</b> cooler</p> : null}
              {data.savings?.dollarsYear ? <p>Saves <b>{money(data.savings.dollarsYear, { cents: false })}/yr</b> ({data.savings.kwhYear} kWh)</p> : null}
              {data.savings?.paybackYears ? <p>Payback in <b>{data.savings.paybackYears} years</b></p> : null}
              {data.savings?.co2KgYear ? <p className="flex items-center gap-1 text-success"><Leaf className="h-3.5 w-3.5" />{data.savings.co2KgYear} kg CO₂ avoided / yr</p> : null}
              <p className="text-muted-fg">Heat blocked ≈ {data.savings?.heatBlockedW} W at peak sun</p>
              <p className="mt-1 text-xs">Thermal stress risk: <Badge tone={best.thermal.level === 'high' ? 'danger' : best.thermal.level === 'medium' ? 'warning' : 'success'}>{best.thermal.level}</Badge></p>
            </div>
          </div>

          <div>
            <p className="label">Other options</p>
            <div className="space-y-2">
              {data.ranked.slice(1, 6).map((r: any) => (
                <div key={r.film._id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted font-display font-bold">{r.score}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.film.brand} {r.film.name}</p>
                    <p className="text-xs text-muted-fg">{r.perf.vlt}% VLT · {r.perf.tser}% TSER · {money(r.pricing.sell, { cents: false })}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => apply(r)}>Apply</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : data ? (
        <p className="text-sm text-muted-fg">{data.summary}</p>
      ) : null}
    </Drawer>
  );
}
