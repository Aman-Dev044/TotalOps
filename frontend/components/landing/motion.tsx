'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/** Fades/slides children in when they scroll into view. */
export function Reveal({ children, delay = 0, className, y = 24 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

const SHADES = [70, 50, 35, 20, 5];

/** Animated hero illustration: a car whose windows cycle through tint shades with a live legal badge. */
export function HeroCar() {
  const [i, setI] = useState(2);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SHADES.length), 1800);
    return () => clearInterval(t);
  }, []);
  const vlt = SHADES[i];
  const opacity = 1 - (vlt / 100) * 0.92;
  const legal = vlt >= 35;
  return (
    <div className="relative">
      <motion.div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-indigo-600/40 via-fuchsia-500/30 to-amber-400/30 blur-3xl" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 6, repeat: Infinity }} />
      <div className="relative rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between text-xs text-white/70">
          <span className="font-semibold uppercase tracking-widest">3D Tint Visualizer</span>
          <motion.span key={String(legal)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-full px-2.5 py-1 font-bold ${legal ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
            {legal ? 'Legal front sides ✓' : 'Rear only — too dark for fronts'}
          </motion.span>
        </div>
        <svg viewBox="0 0 520 220" className="w-full" role="img" aria-label={`Car preview with ${vlt}% VLT window film`}>
          <defs>
            <linearGradient id="lp-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7c7ff5" />
              <stop offset="1" stopColor="#3b2fb0" />
            </linearGradient>
            <linearGradient id="lp-shine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity=".35" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <ellipse cx="260" cy="200" rx="215" ry="12" fill="#000" opacity=".35" />
          <path d="M40 160 Q38 120 80 112 L150 104 Q190 58 250 54 L340 54 Q392 58 430 100 L470 110 Q492 118 490 150 L488 168 L40 168 Z" fill="url(#lp-body)" />
          <motion.path d="M170 104 Q200 70 250 66 L300 66 L300 104 Z" fill="#0b0c14" animate={{ opacity }} transition={{ duration: 0.8 }} />
          <motion.path d="M310 66 L338 66 Q380 70 412 104 L310 104 Z" fill="#0b0c14" animate={{ opacity }} transition={{ duration: 0.8 }} />
          <path d="M170 104 Q200 70 250 66 L300 66 L300 104 Z M310 66 L338 66 Q380 70 412 104 L310 104 Z" fill="none" stroke="#c7c9ff" strokeOpacity=".5" strokeWidth="2" />
          <rect x="60" y="120" width="400" height="10" rx="5" fill="url(#lp-shine)" />
          <circle cx="130" cy="168" r="30" fill="#111" />
          <circle cx="130" cy="168" r="16" fill="#9aa3ad" />
          <circle cx="400" cy="168" r="30" fill="#111" />
          <circle cx="400" cy="168" r="16" fill="#9aa3ad" />
          <rect x="462" y="128" width="20" height="8" rx="3" fill="#fde68a" />
          <rect x="44" y="130" width="14" height="8" rx="3" fill="#f87171" />
        </svg>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {SHADES.map((s, k) => (
            <button key={s} type="button" onClick={() => setI(k)} className={`rounded-xl border px-2 py-2 text-center text-xs font-bold transition ${k === i ? 'border-white/60 bg-white/15 text-white' : 'border-white/10 text-white/60 hover:bg-white/10'}`}>
              <span className="mx-auto mb-1 block h-4 w-8 rounded" style={{ background: '#0b0c14', opacity: 1 - (s / 100) * 0.92 }} />
              {s}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
