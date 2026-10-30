'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, CalendarClock, Check, CheckCircle2, Clock, Mail, Phone, Ruler, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { API_URL, api, errorMessage } from '@/lib/api';
import { fmtDate, fmtDateTime, money } from '@/lib/format';
import { Button, Checkbox, Input, Spinner, cn } from '@/components/ui';
import { LogoMark } from '@/components/logo';
import { toggleOption, validateSelection } from '@/components/projects/proposal-math';

type PublicOption = { id: string; title: string; filmLabel?: string; group: string; recommended: boolean; detail?: string; comparisonPrice: number; lines: { name: string; coverage?: string; qty: number; unitPrice: number }[]; totals: { subtotal: number; discount: number; tax: number; total: number } };
type Snapshot = {
  business: { name: string; phone?: string; email?: string; address?: string; logoUrl?: string };
  store: { name: string; phone?: string; address?: string } | null;
  project: { number: string; title: string; segment: string; vehicle?: any; property?: any };
  customerFirstName: string; intro?: string; footer?: string; terms?: string; taxRate: number; validUntil?: string; expired: boolean;
  deposit?: { mode: string; value: number }; status: string; approvedBy: string; approvedAt: string | null; selectedOptionIds: string[]; recommendedSelection: string[];
  afterApprovalMessage?: string; nextStepLabel?: string; nextStepUrl?: string; scope: { name: string; panes: number; areaM2: number }[]; options: PublicOption[];
};

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .get<Snapshot>(`/public/review/${token}`, { auth: false })
      .then((d) => {
        setData(d);
        setIds(d.status === 'approved' ? d.selectedOptionIds : d.recommendedSelection);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [token]);

  const totals = useMemo(() => {
    if (!data) return { total: 0, subtotal: 0, tax: 0, discount: 0, deposit: 0 };
    const chosen = data.options.filter((o) => ids.includes(o.id));
    const t = chosen.reduce((a, o) => ({ subtotal: a.subtotal + o.totals.subtotal, discount: a.discount + o.totals.discount, tax: a.tax + o.totals.tax, total: a.total + o.totals.total }), { subtotal: 0, discount: 0, tax: 0, total: 0 });
    const dep = data.deposit;
    const deposit = dep?.mode === 'percent' ? (t.total * dep.value) / 100 : dep?.mode === 'fixed' ? Math.min(t.total, dep.value) : 0;
    return { ...t, deposit };
  }, [data, ids]);

  const approve = async () => {
    if (!data) return;
    setSubmitError('');
    const err = validateSelection(data.options as any, ids);
    if (err) return setSubmitError(err);
    if (!name.trim() || !ack) return setSubmitError('Enter your name and acknowledge this confirmation.');
    setBusy(true);
    try {
      const d = await api.post<Snapshot>(`/public/review/${token}`, { name: name.trim(), optionIds: ids, acknowledge: true }, { auth: false });
      setData(d);
      setIds(d.selectedOptionIds);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Shell>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card mx-auto mt-16 max-w-md p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-warning" />
          <p className="mt-3 font-display text-xl font-bold">Let’s get you the right proposal.</p>
          <p className="mt-1 text-sm text-muted-fg">{error}</p>
          <p className="mt-3 text-xs text-muted-fg">Contact the team who shared this link. No choices have been changed.</p>
        </motion.div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center text-sm text-muted-fg"><div className="flex flex-col items-center gap-3"><Spinner className="h-8 w-8" />Preparing your proposal…</div></div>
      </Shell>
    );
  }

  const approved = data.status === 'approved';
  const groups = Array.from(new Set(data.options.map((o) => o.group).filter(Boolean)));
  const v = data.project.vehicle || {};
  const subject = data.project.segment === 'automotive' ? [v.year, v.make, v.model].filter(Boolean).join(' ') : data.project.property?.address;
  const logo = data.business.logoUrl ? `${API_URL}${data.business.logoUrl}` : '';

  return (
    <Shell>
      {/* Hero */}
      <div className="relative overflow-hidden bg-[#0b0b1a] text-white">
        <div className="bg-grid absolute inset-0 opacity-30" />
        <motion.div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-indigo-600/40 blur-3xl" animate={{ x: [0, 30, 0] }} transition={{ duration: 12, repeat: Infinity }} />
        <motion.div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-fuchsia-600/30 blur-3xl" animate={{ y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity }} />
        <div className="relative mx-auto max-w-4xl px-5 py-10 sm:py-14">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="Business logo" className="h-10 w-10 rounded-xl bg-white object-contain p-1" /> : <LogoMark size={40} />}
            <div>
              <p className="font-display text-lg font-bold">{data.business.name}</p>
              <p className="text-xs text-white/60">{data.store ? `${data.store.name} store` : data.business.address}</p>
            </div>
          </div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 font-display text-3xl font-extrabold leading-tight sm:text-5xl">
            Your project.<br />
            <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">Your choices.</span>
          </motion.h1>
          <p className="mt-3 text-sm text-white/70">
            {data.project.title}{subject ? ` · ${subject}` : ''} · Ref {data.project.number}
            {data.validUntil ? ` · Valid until ${fmtDate(data.validUntil, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
        <AnimatePresence>
          {approved ? (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 overflow-hidden rounded-3xl border border-success/30 bg-success/10 p-6 text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-white shadow-lg">
                <Check className="h-8 w-8" />
              </motion.span>
              <p className="mt-4 font-display text-2xl font-extrabold">Your chosen work is confirmed</p>
              <p className="mt-1 text-sm text-muted-fg">Approved by {data.approvedBy}{data.approvedAt ? ` · ${fmtDateTime(data.approvedAt)}` : ''}</p>
              {data.afterApprovalMessage ? <p className="mx-auto mt-3 max-w-lg text-sm">{data.afterApprovalMessage}</p> : null}
              {data.nextStepLabel && data.nextStepUrl && /^https?:\/\//.test(data.nextStepUrl) ? (
                <a href={data.nextStepUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-success px-5 py-2.5 text-sm font-semibold text-white">{data.nextStepLabel}<ArrowRight className="h-4 w-4" /></a>
              ) : null}
            </motion.div>
          ) : data.expired ? (
            <div className="mb-8 rounded-2xl border border-warning/30 bg-warning/10 p-5 text-sm text-warning"><Clock className="mr-2 inline h-4 w-4" />This offer has expired. Please contact the team for a current version.</div>
          ) : null}
        </AnimatePresence>

        {data.intro ? <p className="mb-6 whitespace-pre-wrap text-[15px] leading-relaxed">{data.intro}</p> : null}

        {data.scope.length ? (
          <div className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Ruler className="h-5 w-5 text-primary" />The work we’ve discussed</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.scope.map((s) => (
                <div key={s.name} className="card p-3">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-fg">{s.panes} panes · {s.areaM2} m²</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <h2 className="mb-1 font-display text-lg font-bold">{approved ? 'Your approved options' : 'Choose what works for you'}</h2>
        {!approved ? <p className="mb-4 text-sm text-muted-fg">Independent work areas can be combined. For alternatives, choose one option in each named group.</p> : null}

        <div className="space-y-6">
          {[...groups.map((g) => ({ key: g, label: g, list: data.options.filter((o) => o.group === g) })), { key: '__add', label: '', list: data.options.filter((o) => !o.group) }]
            .filter((x) => x.list.length)
            .map((sec) => (
              <div key={sec.key}>
                {sec.label ? <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Pick one · {sec.label}</p> : groups.length ? <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-fg">Optional extras</p> : null}
                <div className={cn('grid gap-3', sec.label && sec.list.length > 1 ? 'sm:grid-cols-2' : '')}>
                  {sec.list.map((o, i) => {
                    const on = ids.includes(o.id);
                    return (
                      <motion.button
                        key={o.id}
                        type="button"
                        disabled={approved || data.expired}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={approved ? undefined : { y: -2 }}
                        onClick={() => setIds((x) => toggleOption(data.options as any, x, o.id))}
                        className={cn('relative flex h-full flex-col rounded-2xl border-2 bg-card p-5 text-left transition', on ? 'border-primary shadow-glow' : 'border-line hover:border-primary/40', (approved || data.expired) && !on && 'opacity-50')}
                      >
                        {o.recommended ? <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-fuchsia-500 px-2.5 py-0.5 text-[11px] font-bold text-white"><Star className="h-3 w-3" />Recommended</span> : null}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            {o.filmLabel ? <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{o.filmLabel}</p> : null}
                            <p className="font-display text-lg font-bold leading-snug">{o.title}</p>
                          </div>
                          <span className={cn('grid h-6 w-6 shrink-0 place-items-center border-2', o.group ? 'rounded-full' : 'rounded-lg', on ? 'border-primary bg-primary text-white' : 'border-line')}>{on ? <Check className="h-4 w-4" /> : null}</span>
                        </div>
                        {o.detail ? <p className="mt-2 text-sm text-muted-fg">{o.detail}</p> : null}
                        <ul className="mt-3 space-y-1 text-sm">
                          {o.lines.map((l, k) => (
                            <li key={k} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{l.name}{l.coverage ? <span className="text-muted-fg"> · {l.coverage}</span> : null}</span></li>
                          ))}
                        </ul>
                        <div className="mt-auto flex items-end justify-between pt-4">
                          <span className="text-xs text-muted-fg">{on ? (approved ? 'Included' : 'Included · tap to remove') : 'Tap to include'}</span>
                          <span className="text-right">
                            {o.comparisonPrice > o.totals.total ? <span className="block text-xs text-muted-fg line-through">{money(o.comparisonPrice)}</span> : null}
                            <span className="font-display text-2xl font-extrabold">{money(o.totals.total)}</span>
                          </span>
                        </div>
                        {o.comparisonPrice > o.totals.total ? <span className="mt-1 self-end text-[11px] font-semibold text-success">Option saving: {money(o.comparisonPrice - o.totals.total)}</span> : null}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

        {/* Summary */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-bg/90 px-4 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:rounded-3xl sm:border sm:bg-card sm:p-6 sm:shadow-lift">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="text-sm">
              <p className="font-display text-base font-bold">{approved ? 'Confirmation summary' : 'Your selection'}</p>
              <p className="text-muted-fg">Subtotal {money(totals.subtotal)}{totals.discount ? ` · Discount −${money(totals.discount)}` : ''} · Tax ({data.taxRate}%) {money(totals.tax)}</p>
              {totals.deposit ? <p className="text-muted-fg">Deposit after confirmation <b className="text-fg">{money(totals.deposit)}</b></p> : null}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-fg">Total</p>
              <motion.p key={totals.total} initial={{ scale: 0.95, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-3xl font-extrabold">{money(totals.total)}</motion.p>
            </div>
          </div>
          {!approved && !data.expired ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" aria-label="Your name" />
                <Checkbox checked={ack} onChange={setAck} label={<span className="text-xs text-muted-fg">I confirm these choices. This does not charge a deposit — the team will contact me to arrange the next step.</span>} />
              </div>
              <Button size="lg" loading={busy} icon={ShieldCheck} onClick={approve} disabled={!ids.length}>Approve selected options</Button>
            </div>
          ) : null}
          {submitError ? <p className="mt-2 text-sm font-medium text-danger">{submitError}</p> : null}
        </div>

        {data.footer ? <p className="mt-8 whitespace-pre-wrap text-sm text-muted-fg">{data.footer}</p> : null}
        {data.terms ? (
          <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-xs text-muted-fg">
            <p className="mb-1 font-semibold text-fg">Terms, deposit and warranty</p>
            {data.terms}
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted-fg">
          <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Ask a question</span>
          <span className="flex flex-wrap gap-4">
            {data.store?.phone || data.business.phone ? <a href={`tel:${data.store?.phone || data.business.phone}`} className="flex items-center gap-1.5 hover:text-fg"><Phone className="h-4 w-4" />{data.store?.phone || data.business.phone}</a> : null}
            {data.business.email ? <a href={`mailto:${data.business.email}`} className="flex items-center gap-1.5 hover:text-fg"><Mail className="h-4 w-4" />{data.business.email}</a> : null}
            {data.validUntil ? <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />Valid until {fmtDate(data.validUntil)}</span> : null}
          </span>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bg">{children}</div>;
}
