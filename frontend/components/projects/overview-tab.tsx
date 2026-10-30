'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity as ActivityIcon, ArrowRight, Building2, CalendarClock, CarFront, Layers, MapPin, Sparkles, StickyNote } from 'lucide-react';
import { useFilms } from '@/lib/hooks';
import { fmtDate, fmtTime, money, timeAgo, vehicleLabel } from '@/lib/format';
import type { ProjectDetail } from '@/lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Select } from '@/components/ui';
import { ApptStatusBadge } from '@/components/badges';
import type { TabProps } from './use-project-action';

function nextStep(p: ProjectDetail): { text: string; tab: string; cta: string } {
  const install = p.appointments.find((a) => a.type === 'installation' && a.status !== 'cancelled');
  if (p.stage === 'closed') return { text: 'Job closed and paid. Ask the customer for a review while the experience is fresh.', tab: 'messages', cta: 'Message customer' };
  if (p.invoice && p.totals.balance > 0) return { text: `Invoice ${p.invoice.number} has ${money(p.totals.balance)} outstanding. Record the payment to close the job.`, tab: 'quote', cta: 'Record payment' };
  if (p.install.status === 'complete' && !p.invoice) return { text: 'Installation is complete. Create the invoice from the approved options.', tab: 'quote', cta: 'Create invoice' };
  if (p.stage === 'in_progress') return { text: 'Installer is on the job. Mark the installation complete when the film is applied.', tab: 'install', cta: 'Open install' };
  if (install && install.status === 'scheduled') return { text: `Installation booked for ${fmtDate(install.date)} at ${fmtTime(install.start)}. Check in on the day to start the job.`, tab: 'appointments', cta: 'View booking' };
  if (p.proposal?.status === 'approved' && !install) return { text: 'Customer approved the proposal. Book the installation and reserve film.', tab: 'appointments', cta: 'Book installation' };
  if (p.proposal && ['sent', 'viewed'].includes(p.proposal.status)) return { text: `Proposal ${p.proposal.status}. Follow up or record the customer's approval.`, tab: 'quote', cta: 'Open proposal' };
  if (p.proposal?.status === 'draft') return { text: 'Proposal is drafted. Review the options and send it to the customer.', tab: 'quote', cta: 'Review & send' };
  if (!p.totals.panes) return { text: 'Capture the glass measurements — the Smart Advisor can then pick the right film and price it automatically.', tab: 'measurements', cta: 'Measure glass' };
  return { text: 'Measurements are in. Price the job from the measurement sheet or a proposal package.', tab: 'quote', cta: 'Create proposal' };
}

export function OverviewTab({ p, run, busy, goTo }: TabProps & { goTo: (tab: string) => void }) {
  const { data: films } = useFilms();
  const [filmId, setFilmId] = useState(p.filmId || '');
  const [shade, setShade] = useState<number | ''>(p.filmShade ?? '');
  useEffect(() => {
    setFilmId(p.filmId || '');
    setShade(p.filmShade ?? '');
  }, [p.filmId, p.filmShade]);
  const candidates = (films || []).filter((f) => f.active !== false && f.segments.includes(p.segment));
  const film = (films || []).find((f) => f._id === filmId);
  const step = nextStep(p);
  const auto = p.segment === 'automotive';

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-transparent p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-glow">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Your next move</p>
                <p className="mt-0.5 max-w-xl text-sm font-medium">{step.text}</p>
              </div>
            </div>
            <Button iconRight={ArrowRight} onClick={() => goTo(step.tab)}>{step.cta}</Button>
          </div>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader icon={auto ? CarFront : Building2} title={auto ? 'Vehicle & location' : 'Property & location'} subtitle={auto ? 'Vehicle information and where the work will be done.' : 'Property information and where the work will be done.'} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm">
              {auto ? (
                <>
                  <Info label="Vehicle" value={vehicleLabel(p.vehicle) || '—'} />
                  <Info label="Body" value={p.vehicle.bodyType || '—'} />
                  <Info label="Colour" value={p.vehicle.color || '—'} />
                  <Info label="Rego" value={p.vehicle.rego || '—'} />
                  {p.vehicle.stockPo ? <Info label="Stock / PO" value={p.vehicle.stockPo} /> : null}
                  {p.vehicle.vin ? <Info label="VIN" value={p.vehicle.vin} /> : null}
                </>
              ) : (
                <>
                  <Info label="Type" value={p.property.type || '—'} />
                  <Info label="Glazing" value={p.property.glazing || '—'} />
                  <Info label="Orientation" value={p.property.orientation || '—'} />
                  <Info label="Levels" value={String(p.property.levels || '—')} />
                </>
              )}
              <div className="col-span-2 flex items-start gap-2 rounded-xl bg-muted/60 p-3">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-muted-fg">{p.location?.type === 'on_site' ? 'At customer location' : 'In shop'}</p>
                  <p className="font-medium">{p.location?.address || p.property?.address || p.store?.address || '—'}</p>
                </div>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader icon={Layers} title="Coverage & film" subtitle="Select the film product for this job." />
            <div className="space-y-3 p-5">
              <Field label="Film type">
                <Select
                  value={filmId}
                  onChange={(e) => {
                    setFilmId(e.target.value);
                    const f = (films || []).find((x) => x._id === e.target.value);
                    setShade(f?.shades?.[0]?.vlt ?? '');
                  }}
                >
                  <option value="">Choose a film…</option>
                  {candidates.map((f) => <option key={f._id} value={f._id}>{f.brand} {f.name} · {f.category}</option>)}
                </Select>
              </Field>
              {film ? (
                <Field label="Shade (VLT %)">
                  <Select value={shade} onChange={(e) => setShade(Number(e.target.value))}>
                    {film.shades.map((s) => <option key={s.vlt} value={s.vlt}>{s.vlt}% VLT · rejects {s.tser}% solar energy</option>)}
                  </Select>
                </Field>
              ) : null}
              {film ? (
                <div className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <span className="h-10 w-10 shrink-0 rounded-lg border border-line" style={{ background: film.tintColor, opacity: 0.35 + (1 - (Number(shade) || 50) / 100) * 0.65 }} />
                  <div className="text-xs text-muted-fg">
                    <p className="font-semibold text-fg">{film.brand} {film.name}</p>
                    UV {film.uvr}% · IR {film.irr}% · {film.warrantyYears >= 25 ? 'Lifetime' : `${film.warrantyYears}-yr`} warranty
                  </div>
                </div>
              ) : null}
              <Button className="w-full" variant="secondary" loading={busy === 'film.set'} disabled={!filmId || (filmId === p.filmId && shade === p.filmShade)} onClick={() => run('film.set', { filmId, shade: shade === '' ? undefined : shade }, 'Film type saved')}>
                Save film type
              </Button>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader icon={StickyNote} title="Special requirements" subtitle="Access, customer preferences & site notes" />
          <p className="whitespace-pre-wrap p-5 text-sm text-muted-fg">{p.requirements || 'No special requirements recorded. Use Edit to add access notes or customer preferences.'}</p>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader icon={CalendarClock} title="Next appointment" />
          <div className="p-5">
            {p.nextAppointment ? (
              <div>
                <p className="font-display text-lg font-bold capitalize">{p.nextAppointment.type.replace('_', ' ')}</p>
                <p className="text-sm text-muted-fg">{fmtDate(p.nextAppointment.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {fmtTime(p.nextAppointment.start)}–{fmtTime(p.nextAppointment.end)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ApptStatusBadge status={p.nextAppointment.status} />
                  {p.nextAppointment.installer ? <Badge tone="primary">{p.nextAppointment.installer}</Badge> : null}
                  {p.nextAppointment.bay ? <Badge>{p.nextAppointment.bay}</Badge> : null}
                </div>
              </div>
            ) : (
              <EmptyState className="py-4" title="Not booked" description="No upcoming appointments." action={<Button size="sm" onClick={() => goTo('appointments')}>Schedule</Button>} />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader icon={ActivityIcon} title="Recent activity" subtitle={`${p.activity.length} events`} />
          <div className="max-h-[440px] overflow-y-auto p-5">
            {!p.activity.length ? <p className="text-sm text-muted-fg">No activity yet.</p> : null}
            <ol className="relative space-y-4 border-l border-line pl-5">
              {p.activity.map((a, i) => (
                <motion.li key={a._id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                  <p className="text-sm font-semibold">{a.title}</p>
                  {a.text ? <p className="text-xs text-muted-fg">{a.text}</p> : null}
                  <p className="text-[11px] text-muted-fg/80">{timeAgo(a.createdAt)}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-fg">{label}</dt>
      <dd className="mt-0.5 font-medium capitalize">{value}</dd>
    </div>
  );
}
