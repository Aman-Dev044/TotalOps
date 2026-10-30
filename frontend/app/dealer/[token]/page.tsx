'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { CarFront, CheckCircle2, Clock, Hourglass, KeyRound, Phone, RefreshCw, ShieldCheck, Sun, Wrench, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, fmtTime, num, timeAgo, vehicleLabel } from '@/lib/format';
import { LogoMark } from '@/components/logo';
import { cn } from '@/components/ui';

type Vehicle = {
  id: string; fleetId: string; time: string; start: string; bay: string; store: string; vehicle: { year?: string; make?: string; model?: string; color?: string; rego?: string };
  stockPo: string; shopStatus: string; status: string; tech: string[]; coverage: string; totalAreaM2: number; notes: string;
  film: { brand: string; name: string; category: string; vlt?: number; tser?: number; irr?: number; uvr?: number; warrantyYears?: number } | null;
  panes: { label: string; width: number; height: number; unit: string; qty: number; areaM2: number }[];
};
type Portal = { dealer: { name: string; contactName?: string }; store: { name: string; phone?: string } | null; date: string; syncedAt: string; counts: { total: number; inBay: number; queued: number; ready: number }; vehicles: Vehicle[] };

const STATUS: Record<string, { label: string; cls: string; group: 'queued' | 'bay' | 'ready' }> = {
  booked: { label: 'Booked', cls: 'bg-slate-500/20 text-slate-200', group: 'queued' },
  arrived: { label: 'Arrived', cls: 'bg-sky-500/20 text-sky-300', group: 'queued' },
  in_bay: { label: 'In Bay', cls: 'bg-indigo-500/25 text-indigo-200', group: 'bay' },
  installing: { label: 'Installing', cls: 'bg-amber-500/20 text-amber-300', group: 'bay' },
  ready: { label: 'Ready for Pickup', cls: 'bg-emerald-500/20 text-emerald-300', group: 'ready' },
  collected: { label: 'Collected', cls: 'bg-slate-500/20 text-slate-400', group: 'ready' },
};

type Tab = 'all' | 'bay' | 'queued' | 'ready';

export default function DealerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading, mutate, isValidating } = useSWR<Portal>(token ? `/public/dealer/${token}` : null, (p: string) => api.get<Portal>(p, { auth: false }), { refreshInterval: 20_000 });
  const [tab, setTab] = useState<Tab>('all');
  const [open, setOpen] = useState<Vehicle | null>(null);

  const list = useMemo(() => (data?.vehicles || []).filter((v) => tab === 'all' || STATUS[v.shopStatus]?.group === tab), [data, tab]);

  if (error) {
    return (
      <Shell>
        <div className="mx-auto mt-24 max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-indigo-300" />
          <p className="mt-3 font-display text-xl font-bold">Link unavailable</p>
          <p className="mt-1 text-sm text-white/60">{errorMessage(error)} Contact the shop desk for a fresh link.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoMark size={42} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300">TotalOps live dealer portal</p>
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{data?.dealer.name || 'Loading…'}</h1>
            <p className="text-sm text-white/60">Real-time shop schedule & vehicle progress{data ? ` · ${fmtDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>
            Live auto-sync active
          </span>
          <button type="button" onClick={() => mutate()} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15">
            <RefreshCw className={cn('h-3.5 w-3.5', isValidating && 'animate-spin')} /> Refresh
          </button>
          {data?.store?.phone ? (
            <a href={`tel:${data.store.phone}`} className="flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-400">
              <Phone className="h-3.5 w-3.5" /> Call shop desk
            </a>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={CarFront} label="Total vehicles today" value={data?.counts.total} tone="from-indigo-500/30" />
        <Kpi icon={Wrench} label="In tint bay now" value={data?.counts.inBay} tone="from-amber-500/30" />
        <Kpi icon={Hourglass} label="Queued / arrived" value={data?.counts.queued} tone="from-sky-500/30" />
        <Kpi icon={CheckCircle2} label="Ready for pickup" value={data?.counts.ready} tone="from-emerald-500/30" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-2xl bg-white/5 p-1">
          {([['all', `All vehicles (${data?.counts.total ?? 0})`], ['ready', `Ready (${data?.counts.ready ?? 0})`], ['bay', `In bay (${data?.counts.inBay ?? 0})`], ['queued', `Queued (${data?.counts.queued ?? 0})`]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn('relative rounded-xl px-3 py-1.5 text-xs font-semibold sm:text-sm', tab === k ? 'text-white' : 'text-white/55 hover:text-white')}>
              {tab === k ? <motion.span layoutId="dealer-tab" className="absolute inset-0 rounded-xl bg-indigo-500" /> : null}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-white/50">Last synced: {data ? timeAgo(data.syncedAt) : '—'}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && !data ? [0, 1, 2].map((k) => <div key={k} className="h-48 animate-pulse rounded-3xl bg-white/5" />) : null}
        <AnimatePresence>
          {list.map((v, k) => (
            <motion.button
              type="button"
              key={v.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: k * 0.04 }}
              whileHover={{ y: -3 }}
              onClick={() => setOpen(v)}
              className="group rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 text-left transition hover:border-indigo-400/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">{vehicleLabel(v.vehicle) || v.fleetId}</p>
                  <p className="text-xs text-white/55">Color: {v.vehicle.color || '—'} · Stock/PO: {v.stockPo || '—'} · Rego: {v.vehicle.rego || '—'}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold', STATUS[v.shopStatus]?.cls)}>{STATUS[v.shopStatus]?.label || v.shopStatus}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-white/70"><Clock className="h-3.5 w-3.5" />{fmtTime(v.start)} · {v.bay || 'Bay TBC'}</span>
                <span className="flex items-center gap-1.5 text-white/70"><Wrench className="h-3.5 w-3.5" />Tech: {v.tech.join(', ') || 'TBC'}</span>
                <span className="col-span-2 flex items-center gap-1.5 text-white/70"><Sun className="h-3.5 w-3.5" />{v.film ? `${v.film.brand} ${v.film.name} · ${v.film.vlt ?? '—'}% shade · heat & UV block` : 'Film TBC'}</span>
              </div>
              <p className="mt-4 text-xs font-semibold text-indigo-300 group-hover:underline">View details & measurements →</p>
            </motion.button>
          ))}
        </AnimatePresence>
        {data && list.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-white/15 p-10 text-center">
            <CarFront className="mx-auto h-8 w-8 text-white/40" />
            <p className="mt-2 font-semibold">No vehicles matching this filter</p>
            <p className="text-sm text-white/50">Switch tabs or check back once vehicles are checked in.</p>
          </div>
        ) : null}
      </div>

      <AnimatePresence>{open ? <DetailModal v={open} store={data?.store} onClose={() => setOpen(null)} /> : null}</AnimatePresence>

      <p className="mt-10 text-center text-xs text-white/35">Read-only live view · {data?.store?.name ? `${data.store.name} store · ` : ''}Powered by TotalOps</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-[#090b13] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/15 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof CarFront; label: string; value?: number; tone: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br to-transparent p-4', tone)}>
      <Icon className="h-5 w-5 text-white/70" />
      <p className="mt-3 font-display text-3xl font-extrabold">{value ?? '—'}</p>
      <p className="text-xs text-white/60">{label}</p>
    </motion.div>
  );
}

function DetailModal({ v, store, onClose }: { v: Vehicle; store?: { name: string; phone?: string } | null; onClose: () => void }) {
  const ready = v.shopStatus === 'ready' || v.shopStatus === 'collected';
  const inBay = v.shopStatus === 'in_bay' || v.shopStatus === 'installing';
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 32 }} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#11141f] p-6 sm:rounded-3xl">
        <button type="button" aria-label="Close details" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20"><X className="h-4 w-4" /></button>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300">Fleet ID {v.fleetId}</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">{vehicleLabel(v.vehicle)}</h2>
        <span className={cn('mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold', STATUS[v.shopStatus]?.cls)}>{STATUS[v.shopStatus]?.label}</span>

        <Section title="Vehicle & workshop logistics">
          <Grid items={[['Stock / PO number', v.stockPo || '—'], ['Vehicle colour', v.vehicle.color || '—'], ['Registration', v.vehicle.rego || '—'], ['Service location', v.store], ['Shop bay station', v.bay || 'TBC'], ['Scheduled window', v.time], ['Lead installer', v.tech[0] || 'TBC'], ['Coverage scope', v.coverage]]} />
        </Section>

        <Section title="Film package & warranty">
          {v.film ? (
            <Grid
              items={[
                ['Film brand', v.film.brand],
                ['Product line', v.film.name],
                ['Visible light transmittance (VLT)', `${v.film.vlt ?? '—'}% shade`],
                ['Solar heat rejection (TSER)', v.film.tser ? `${v.film.tser}%` : '—'],
                ['Infrared rejection', v.film.irr ? `Up to ${v.film.irr}%` : '—'],
                ['UV protection', `${v.film.uvr ?? 99}% UV block`],
                ['Warranty', v.film.warrantyYears && v.film.warrantyYears >= 20 ? 'Lifetime manufacturer warranty' : `${v.film.warrantyYears ?? '—'} year manufacturer warranty`],
              ]}
            />
          ) : <p className="text-sm text-white/60">Film package to be confirmed.</p>}
        </Section>

        <Section title="Glass measurements & pane coverage">
          {v.panes.length ? (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-white/5 text-left text-[11px] uppercase tracking-wide text-white/50">
                  <tr><th className="px-3 py-2">Glass pane</th><th className="px-3 py-2">Dimensions</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Film applied</th><th className="px-3 py-2 text-right">Area (m²)</th></tr>
                </thead>
                <tbody>
                  {v.panes.map((p, k) => (
                    <tr key={k} className="border-t border-white/5">
                      <td className="px-3 py-2">{p.label}</td>
                      <td className="px-3 py-2 text-white/70">{p.width} × {p.height} {p.unit}</td>
                      <td className="px-3 py-2">{p.qty}</td>
                      <td className="px-3 py-2 text-white/70">{v.film ? `${v.film.name} ${v.film.vlt ?? ''}%` : '—'}</td>
                      <td className="px-3 py-2 text-right">{num(p.areaM2, 2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/10 bg-white/5 font-semibold"><td className="px-3 py-2" colSpan={4}>Total glass covered</td><td className="px-3 py-2 text-right">{num(v.totalAreaM2, 2)} m²</td></tr>
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-white/60">Measurements pending.</p>}
        </Section>

        <Section title="Dealership pickup & handover">
          <div className={cn('rounded-2xl p-4 text-sm', ready ? 'bg-emerald-500/15 text-emerald-200' : inBay ? 'bg-amber-500/15 text-amber-200' : 'bg-sky-500/15 text-sky-200')}>
            {ready ? (
              <p className="flex gap-2"><KeyRound className="h-4 w-4 shrink-0" />Vehicle tinting and inspection complete. Keys are labelled and stored at the front desk. Ready for collection.</p>
            ) : inBay ? (
              <p className="flex gap-2"><Wrench className="h-4 w-4 shrink-0" />Vehicle is currently on the tint rack — shrinking and application underway. Scheduled window {v.time}.</p>
            ) : (
              <p className="flex gap-2"><Hourglass className="h-4 w-4 shrink-0" />Vehicle is checked into the queue. Tint technician allocated.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-white/55">Post-tint care: remind the customer to keep power windows rolled up for 48 hours while the adhesive cures.</p>
          {v.notes ? <p className="mt-2 text-xs text-white/55">Shop notes: {v.notes}</p> : null}
          {store?.phone ? <a href={`tel:${store.phone}`} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400"><Phone className="h-4 w-4" /> Call desk</a> : null}
        </Section>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/50">{title}</p>
      {children}
    </div>
  );
}

function Grid({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-white/5 px-3 py-2">
          <p className="text-[11px] text-white/45">{k}</p>
          <p className="text-sm font-semibold">{v}</p>
        </div>
      ))}
    </div>
  );
}
