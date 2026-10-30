'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Briefcase, Contact, CornerDownLeft, Layers, Plus, Search, Users } from 'lucide-react';
import { ALL_NAV } from './nav';
import { useApi, useDebounced } from '@/lib/hooks';
import { Badge, Kbd, cn } from '../ui';

type Result = { key: string; label: string; sub?: string; icon: any; href: string; group: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const dq = useDebounced(q, 200);
  const { data } = useApi<any>(open && dq.trim().length >= 2 ? `/search?q=${encodeURIComponent(dq.trim())}` : null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const s = q.trim().toLowerCase();
    const pages = ALL_NAV.filter((n) => !s || n.label.toLowerCase().includes(s) || (n.keywords || '').includes(s)).map((n) => ({ key: n.href, label: n.label, icon: n.icon, href: n.href, group: 'Go to' }));
    const actions: Result[] = [
      { key: 'new-project', label: 'New lead / project', icon: Plus, href: '/projects?new=1', group: 'Actions' },
      { key: 'new-contact', label: 'Add contact', icon: Plus, href: '/customers?new=1', group: 'Actions' },
      { key: 'visualize', label: 'Open 3D tint visualizer', icon: Plus, href: '/visualizer', group: 'Actions' },
    ].filter((a) => !s || a.label.toLowerCase().includes(s));
    const found: Result[] = [];
    if (data) {
      for (const p of data.projects || []) found.push({ key: `p${p._id}`, label: `${p.number} · ${p.title}`, sub: `${p.contactName || ''} · ${p.stageLabel}`, icon: Briefcase, href: `/projects/${p._id}`, group: 'Projects' });
      for (const c of data.contacts || []) found.push({ key: `c${c._id}`, label: c.name, sub: [c.phone, c.email].filter(Boolean).join(' · '), icon: Contact, href: `/customers?contact=${c._id}`, group: 'Customers' });
      for (const t of data.staff || []) found.push({ key: `s${t._id}`, label: t.name, sub: t.title, icon: Users, href: `/team?member=${t._id}`, group: 'Team' });
      for (const f of data.films || []) found.push({ key: `f${f._id}`, label: `${f.brand} ${f.name}`, sub: f.category, icon: Layers, href: `/films?film=${f._id}`, group: 'Films' });
    }
    return [...found, ...actions, ...pages].slice(0, 30);
  }, [q, data]);

  useEffect(() => setIdx(0), [results.length]);

  const go = (r?: Result) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: -12, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-card shadow-lift">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-5 w-5 text-muted-fg" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
                  if (e.key === 'Enter') { e.preventDefault(); go(results[idx]); }
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="Search projects, customers, vehicles, rego, team, films… or jump to a page"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-fg"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 ? <p className="px-3 py-8 text-center text-sm text-muted-fg">No results for “{q}”.</p> : null}
              {results.map((r, i) => {
                const showGroup = i === 0 || results[i - 1].group !== r.group;
                const Icon = r.icon;
                return (
                  <div key={r.key}>
                    {showGroup ? <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-fg">{r.group}</p> : null}
                    <button
                      type="button"
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => go(r)}
                      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', i === idx ? 'bg-primary/10 text-fg' : 'hover:bg-muted')}
                    >
                      <span className={cn('grid h-8 w-8 place-items-center rounded-lg', i === idx ? 'bg-primary text-white' : 'bg-muted text-muted-fg')}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.label}</span>
                        {r.sub ? <span className="block truncate text-xs text-muted-fg">{r.sub}</span> : null}
                      </span>
                      {i === idx ? <CornerDownLeft className="h-4 w-4 text-muted-fg" /> : <ArrowRight className="h-4 w-4 text-transparent" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-line bg-muted/40 px-4 py-2 text-xs text-muted-fg">
              <span className="flex items-center gap-2">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate <Kbd>Enter</Kbd> open
              </span>
              <Badge tone="primary">TotalOps search</Badge>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
