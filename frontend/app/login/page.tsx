'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, CarFront, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers';
import { Button, Field, Input } from '@/components/ui';
import { Logo } from '@/components/logo';
import { errorMessage } from '@/lib/api';

const FEATURES = [
  { icon: Wand2, title: '3D tint visualizer', text: 'Upload a photo — AI rebuilds the car in 3D so customers see their exact shade.' },
  { icon: Sparkles, title: 'Smart film advisor', text: 'Legal shades, best film, roll width, cut plan and price — calculated instantly.' },
  { icon: CarFront, title: 'Shop floor to invoice', text: 'Bookings, bays, dealer portal, proposals, payments and automations in one place.' },
];

function LoginForm() {
  const { login, admin, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') && params.get('next')!.startsWith('/') && !params.get('next')!.startsWith('//') ? params.get('next')! : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready && admin) router.replace(next);
  }, [ready, admin, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back!');
      router.replace(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-bg lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#0b0b1a] p-12 text-white lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <motion.div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/40 blur-3xl" animate={{ x: [0, 40, 0], y: [0, 30, 0] }} transition={{ duration: 14, repeat: Infinity }} />
        <motion.div className="absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/30 blur-3xl" animate={{ x: [0, -30, 0], y: [0, -40, 0] }} transition={{ duration: 16, repeat: Infinity }} />
        <motion.div className="absolute right-24 top-1/3 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 9, repeat: Infinity }} />
        <div className="relative">
          <Logo className="[&_span]:text-white" />
        </div>
        <div className="relative mt-auto max-w-lg">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">
            Window tinting operating system
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-3 font-display text-5xl font-extrabold leading-[1.05]">
            Run every tint job from <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">first enquiry to five stars.</span>
          </motion.h1>
          <div className="mt-10 space-y-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.12 }} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-white/65">{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative mt-10 text-xs text-white/40">© {new Date().getFullYear()} TotalOps · Automotive · Residential · Commercial</p>
      </div>

      {/* Form */}
      <div className="relative flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }} className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Administrator access
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight">Sign in to TotalOps</h2>
            <p className="mt-1.5 text-sm text-muted-fg">Only workspace administrators can sign in. Team members are managed inside the CRM.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourbusiness.com" className="h-12 pl-10" autoFocus />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
                <Input type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-12 pl-10 pr-11" />
                <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-fg hover:bg-muted">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {error ? (
              <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                {error}
              </motion.p>
            ) : null}
            <Button type="submit" size="lg" loading={busy} iconRight={ArrowRight} className="w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-fg">Protected by rate limiting · Sessions expire after 7 days</p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
