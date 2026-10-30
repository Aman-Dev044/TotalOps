'use client';

import React, { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/components/ui';

export const TEMPLATE_VARS = ['first_name', 'name', 'business', 'store', 'store_phone', 'project', 'number', 'vehicle', 'date', 'time', 'balance', 'link'];

export const SAMPLE_VARS: Record<string, string> = {
  first_name: 'Charlotte',
  name: 'Charlotte Adams',
  business: 'TotalOps Window Tinting',
  store: 'Mandurah',
  store_phone: '08 9581 0001',
  project: 'Ford Ranger · privacy package',
  number: 'PRJ-1002',
  vehicle: '2023 Ford Ranger Wildtrak',
  date: '2026-11-02',
  time: '09:30',
  balance: '$352.00',
  link: 'https://app.totalops.app/review/3f9a…',
};

export function renderSample(text: string, business?: string) {
  return (text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k === 'business' && business ? business : SAMPLE_VARS[k] ?? ''));
}

/** Inserts {{var}} into a textarea/input at the cursor. */
export function insertAtCursor(el: HTMLTextAreaElement | HTMLInputElement | null, value: string, current: string, set: (v: string) => void) {
  if (!el) {
    set(current + value);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + value + current.slice(end);
  set(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + value.length;
    el.setSelectionRange(pos, pos);
  });
}

export function VarChips({ onInsert, className }: { onInsert: (token: string) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {TEMPLATE_VARS.map((v) => (
        <button
          key={v}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(`{{${v}}}`)}
          className="rounded-lg border border-line bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-fg transition hover:border-primary/50 hover:text-primary"
        >
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}

/** Textarea + variable chips that insert at the cursor. */
export function TemplateEditor({ value, onChange, rows = 5, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-2">
      <textarea ref={ref} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="input font-mono text-[13px]" />
      <VarChips onInsert={(t) => insertAtCursor(ref.current, t, value, onChange)} />
    </div>
  );
}

export function ChipsInput({ value, onChange, placeholder = 'Type and press Enter' }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange(Array.from(new Set([...value, ...parts])));
    setDraft('');
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-card px-2 py-1.5 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded hover:bg-primary/20">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-fg/70"
      />
      {draft ? (
        <button type="button" aria-label="Add" onClick={add} className="rounded-md p-1 text-primary hover:bg-primary/10">
          <Plus className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#6366f1'} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-xl border border-line bg-card p-1" />
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono" maxLength={7} />
    </div>
  );
}

export function MultiToggle<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o.key) : [...value, o.key])}
            className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold transition', on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-line text-muted-fg hover:bg-muted')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabIntro({ title, text, actions }: { title: string; text?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight">{title}</h2>
        {text ? <p className="mt-0.5 max-w-2xl text-sm text-muted-fg">{text}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export const CURRENCIES = [
  { code: 'AUD', label: 'AUD — Australian dollar' },
  { code: 'NZD', label: 'NZD — New Zealand dollar' },
  { code: 'INR', label: 'INR — Indian rupee' },
  { code: 'USD', label: 'USD — US dollar' },
  { code: 'GBP', label: 'GBP — British pound' },
  { code: 'AED', label: 'AED — UAE dirham' },
];
