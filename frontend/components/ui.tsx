'use client';

import React, { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useInView } from 'framer-motion';
import clsx, { type ClassValue } from 'clsx';
import { Loader2, Search, X, type LucideIcon } from 'lucide-react';
import { initials, type Tone } from '@/lib/format';

export const cn = (...v: ClassValue[]) => clsx(v);

/* ------------------------------------------------------------------ Button */
type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'style'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success' | 'accent';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
};
const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-primary-fg shadow-sm shadow-primary/30 hover:brightness-110',
  secondary: 'bg-muted text-fg hover:bg-muted/70 border border-line',
  ghost: 'text-fg hover:bg-muted',
  danger: 'bg-danger text-white hover:brightness-110 shadow-sm shadow-danger/30',
  outline: 'border border-line bg-card text-fg hover:bg-muted',
  success: 'bg-success text-white hover:brightness-110 shadow-sm shadow-success/30',
  accent: 'bg-accent text-black/90 hover:brightness-105 shadow-sm shadow-accent/30',
};
const SIZES = { xs: 'h-7 px-2 text-xs gap-1 rounded-lg', sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg', md: 'h-10 px-4 text-sm gap-2 rounded-xl', lg: 'h-12 px-5 text-sm gap-2 rounded-xl', icon: 'h-9 w-9 rounded-xl' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className={size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="h-4 w-4" /> : null}
    </motion.button>
  );
});

/* ------------------------------------------------------------------ Inputs */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn('input', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn('input', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn('input cursor-pointer', className)} {...p}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, className, required }: { label?: React.ReactNode; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn('block', className)}>
      {label ? (
        <span className="label">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted-fg">{hint}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; disabled?: boolean; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const k = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm disabled:opacity-50">
      <span className={cn('relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors', w, checked ? 'bg-primary' : 'bg-muted-fg/30')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className={cn('rounded-full bg-white shadow', k, checked ? 'ml-auto' : '')} />
      </span>
      {label ? <span className="text-left">{label}</span> : null}
    </button>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; className?: string }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 cursor-pointer rounded border-line accent-[hsl(var(--primary))]" />
      {label}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
      <input autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-9 pr-8" />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-fg hover:bg-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Surfaces */
export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: LucideIcon; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold leading-tight">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-fg">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-fg',
  primary: 'bg-primary/12 text-primary bg-primary/10',
  success: 'bg-success/12 text-success bg-success/10',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  accent: 'bg-accent/15 text-amber-700 dark:text-accent',
};
export function Badge({ tone = 'neutral', children, dot, className, title }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('chip', TONES[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function Avatar({ name, color, size = 32, className }: { name?: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-card', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36), background: color || 'linear-gradient(135deg,#6366f1,#a855f7)' }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, max = 100, tone = 'primary', className, height = 8 }: { value: number; max?: number; tone?: Tone; className?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  const bg = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', neutral: 'bg-muted-fg', accent: 'bg-accent' }[tone];
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-muted', className)} style={{ height }}>
      <motion.div className={cn('h-full rounded-full', bg)} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-muted', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5" />
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-fg">
        <Spinner className="h-7 w-7" />
        {label}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div className="card mx-auto my-10 max-w-lg p-6 text-center">
      <p className="font-display text-lg font-bold">Could not load this view</p>
      <p className="mt-1 text-sm text-muted-fg">{msg}</p>
      {onRetry ? (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon ? (
        <span className="relative mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
      ) : null}
      <p className="font-display text-base font-bold">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-fg">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ Page header */
export function PageHeader({ title, subtitle, icon: Icon, actions, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: LucideIcon; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-glow">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p> : null}
          <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-fg">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ Animated numbers */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), duration = 0.9 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(prev.current, value || 0, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    prev.current = value || 0;
    return () => controls.stop();
  }, [value, inView, format, duration]);
  return <span ref={ref}>{format(0)}</span>;
}

export function StatCard({ label, value, format, icon: Icon, tone = 'primary', sub, delta, onClick, index = 0 }: { label: string; value: number; format?: (n: number) => string; icon?: LucideIcon; tone?: Tone; sub?: React.ReactNode; delta?: number | null; onClick?: () => void; index?: number }) {
  const ring = { primary: 'from-primary/20 text-primary', success: 'from-success/20 text-success', warning: 'from-warning/25 text-warning', danger: 'from-danger/20 text-danger', info: 'from-info/20 text-info', neutral: 'from-muted text-muted-fg', accent: 'from-accent/25 text-amber-600 dark:text-accent' }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={cn('card group relative overflow-hidden p-5', onClick && 'cursor-pointer')}
    >
      <div className={cn('pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition group-hover:opacity-100', ring)} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">{label}</p>
        {Icon ? (
          <span className={cn('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br to-transparent', ring)}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
      <p className="relative mt-2 font-display text-[26px] font-extrabold tracking-tight">
        <CountUp value={value} format={format} />
      </p>
      <div className="relative mt-1 flex items-center gap-2 text-xs text-muted-fg">
        {delta !== undefined && delta !== null && Number.isFinite(delta) ? (
          <span className={cn('font-semibold', delta >= 0 ? 'text-success' : 'text-danger')}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}%
          </span>
        ) : null}
        {sub}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ Tabs */
export function Tabs<T extends string>({ tabs, value, onChange, className, layoutId = 'tabs' }: { tabs: { key: T; label: React.ReactNode; icon?: LucideIcon; count?: number }[]; value: T; onChange: (v: T) => void; className?: string; layoutId?: string }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl bg-muted p-1', className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        const Icon = t.icon;
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} className={cn('relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', active ? 'text-fg' : 'text-muted-fg hover:text-fg')}>
            {active ? <motion.span layoutId={layoutId} className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} /> : null}
            <span className="relative flex items-center gap-1.5">
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {t.label}
              {t.count !== undefined ? <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-primary/15 text-primary' : 'bg-card text-muted-fg')}>{t.count}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Overlays */
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', icon: Icon }: { open: boolean; onClose: () => void; title?: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; icon?: LucideIcon }) {
  useEscape(open, onClose);
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[96vw]' }[size];
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-lift sm:rounded-2xl', w)}
          >
            {title ? (
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex items-start gap-3">
                  {Icon ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                  ) : null}
                  <div>
                    <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
                    {description ? <p className="mt-0.5 text-sm text-muted-fg">{description}</p> : null}
                  </div>
                </div>
                <button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-lg p-1.5 text-muted-fg hover:bg-muted hover:text-fg">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-muted/30 px-5 py-3">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560, side = 'right' }: { open: boolean; onClose: () => void; title?: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; width?: number; side?: 'left' | 'right' }) {
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[65]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className={cn('absolute top-0 flex h-full w-full flex-col border-line bg-card shadow-lift', side === 'right' ? 'right-0 border-l' : 'left-0 border-r')}
            style={{ maxWidth: width }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                {title ? <h2 className="truncate font-display text-lg font-bold">{title}</h2> : null}
                {subtitle ? <p className="text-sm text-muted-fg">{subtitle}</p> : null}
              </div>
              <button type="button" aria-label="Close panel" onClick={onClose} className="rounded-lg p-1.5 text-muted-fg hover:bg-muted hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
            {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Dropdown menu */
export function Menu({ trigger, children, align = 'right', width = 220 }: { trigger: (open: boolean) => React.ReactNode; children: React.ReactNode | ((close: () => void) => React.ReactNode); align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    window.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('keydown', k);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative inline-block">
      <span onClick={() => setOpen((o) => !o)}>{trigger(open)}</span>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn('absolute z-50 mt-2 overflow-hidden rounded-xl border border-line bg-card p-1 shadow-lift', align === 'right' ? 'right-0' : 'left-0')}
            style={{ width }}
          >
            {typeof children === 'function' ? children(close) : children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, danger, disabled }: { icon?: LucideIcon; children: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-muted disabled:opacity-50', danger ? 'text-danger' : 'text-fg')}>
      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Confirm dialog (promise based, no window.confirm) */
type ConfirmOpts = { title: string; description?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => done(false)}
        size="sm"
        title={state?.title}
        description={state?.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => done(false)}>
              {state?.cancelLabel || 'Cancel'}
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => done(true)} autoFocus>
              {state?.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      />
    </ConfirmCtx.Provider>
  );
}

/* ------------------------------------------------------------------ Misc */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-fg">{children}</kbd>;
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-4 border-line" />;
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-fg">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Staggered fade-in wrapper for lists/grids. */
export function Stagger({ children, className, delay = 0.04 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: delay } } }}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className, ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] } } }} {...(rest as any)}>
      {children}
    </motion.div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: { key: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return <Tabs tabs={options} value={value} onChange={onChange} layoutId={`seg-${options.map((o) => o.key).join('')}`} className={size === 'sm' ? 'p-0.5 text-xs' : ''} />;
}
