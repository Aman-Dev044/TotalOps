'use client';

import { use, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Phone, Send, ShieldCheck } from 'lucide-react';
import { API_URL, api, errorMessage } from '@/lib/api';
import { LogoMark } from '@/components/logo';

type PublicForm = { name: string; heading?: string; intro?: string; fields: string[]; segment: string; business: { name: string; phone?: string; logoUrl?: string } };

const PLACEHOLDER: Record<string, string> = {
  Name: 'Your full name',
  Company: 'Business name',
  Email: 'you@example.com',
  Phone: '04xx xxx xxx',
  Vehicle: 'e.g. 2024 Toyota Hilux SR5',
  Address: 'Street, suburb',
  Scope: 'What would you like tinted? Heat, privacy, glare…',
  Message: 'Anything else we should know?',
};
const LONG = ['Scope', 'Message'];

export default function PublicLeadForm({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [data, setData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honey, setHoney] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    api
      .get<PublicForm>(`/public/forms/${encodeURIComponent(slug)}`, { auth: false })
      .then(setForm)
      .catch((e) => setLoadErr(errorMessage(e)));
  }, [slug]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.Name?.trim()) e.Name = 'Please enter your name';
    if (form?.fields.includes('Email') && data.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.Email)) e.Email = 'Please enter a valid email address';
    if (!data.Email?.trim() && !data.Phone?.trim()) {
      if (form?.fields.includes('Email')) e.Email = e.Email || 'Enter an email or phone number';
      if (form?.fields.includes('Phone')) e.Phone = 'Enter a phone number or email';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitErr('');
    if (!validate()) return;
    setBusy(true);
    try {
      const r = await api.post<{ message?: string }>(`/public/forms/${encodeURIComponent(slug)}`, { ...data, website: honey }, { auth: false });
      setDone(r?.message || 'Thanks! We have received your enquiry and will be in touch shortly.');
    } catch (e) {
      setSubmitErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) {
    return (
      <Shell>
        <div className="text-center">
          <p className="font-display text-2xl font-extrabold">Form unavailable</p>
          <p className="mt-2 text-sm text-muted-fg">{loadErr}</p>
        </div>
      </Shell>
    );
  }
  if (!form) {
    return (
      <Shell>
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-3">
        {form.business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_URL}${form.business.logoUrl}`} alt={form.business.name} className="h-10 w-10 rounded-xl object-contain" />
        ) : (
          <LogoMark size={40} />
        )}
        <div>
          <p className="font-display text-base font-bold">{form.business.name}</p>
          {form.business.phone ? (
            <a href={`tel:${form.business.phone}`} className="flex items-center gap-1 text-xs text-muted-fg hover:text-primary">
              <Phone className="h-3 w-3" /> {form.business.phone}
            </a>
          ) : null}
        </div>
      </div>
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-9 w-9" />
            </motion.span>
            <p className="mt-4 font-display text-2xl font-extrabold">You&apos;re all set!</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-fg">{done}</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} noValidate>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">{form.heading || form.name}</h1>
            {form.intro ? <p className="mt-2 text-sm text-muted-fg">{form.intro}</p> : null}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {form.fields.map((f, i) => (
                <motion.label key={f} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className={`block ${LONG.includes(f) || f === 'Address' ? 'sm:col-span-2' : ''}`}>
                  <span className="label">
                    {f}
                    {f === 'Name' ? <span className="text-danger"> *</span> : null}
                  </span>
                  {LONG.includes(f) ? (
                    <textarea rows={3} className="input" placeholder={PLACEHOLDER[f]} value={data[f] || ''} onChange={(e) => setData({ ...data, [f]: e.target.value })} maxLength={2000} />
                  ) : (
                    <input
                      className="input h-11"
                      type={f === 'Email' ? 'email' : f === 'Phone' ? 'tel' : 'text'}
                      autoComplete={f === 'Name' ? 'name' : f === 'Email' ? 'email' : f === 'Phone' ? 'tel' : f === 'Address' ? 'street-address' : f === 'Company' ? 'organization' : 'off'}
                      placeholder={PLACEHOLDER[f]}
                      value={data[f] || ''}
                      onChange={(e) => setData({ ...data, [f]: e.target.value })}
                      maxLength={300}
                    />
                  )}
                  {errors[f] ? <span className="mt-1 block text-xs text-danger">{errors[f]}</span> : null}
                </motion.label>
              ))}
              {/* Honeypot — hidden from people, filled by bots */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
            </div>
            {submitErr ? <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{submitErr}</p> : null}
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={busy} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-fuchsia-500 font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send enquiry
            </motion.button>
            <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-muted-fg">
              <ShieldCheck className="h-3 w-3" /> Your details are only used to respond to this enquiry.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-4 py-10 sm:py-16">
      <motion.div className="pointer-events-none absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-3xl" animate={{ x: [0, 40, 0], y: [0, 30, 0] }} transition={{ duration: 14, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/15 blur-3xl" animate={{ x: [0, -30, 0] }} transition={{ duration: 16, repeat: Infinity }} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="card relative mx-auto max-w-xl p-6 sm:p-8">
        {children}
      </motion.div>
      <p className="relative mt-6 text-center text-[11px] text-muted-fg">Powered by TotalOps</p>
    </div>
  );
}
