'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Plus, RotateCcw, Volume2, Wand2 } from 'lucide-react';
import { Badge, Button, Modal, Switch, Textarea, cn } from '@/components/ui';
import { parseMeasurement, VOICE_SAMPLES, type ParsedPane } from './voice-parser';

type Props = { open: boolean; onClose: () => void; onAdd: (p: ParsedPane) => void; defaultUnit: string };

function chime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch {
    /* audio unavailable */
  }
}

export function VoiceModal({ open, onClose, onAdd, defaultUnit }: Props) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [parsed, setParsed] = useState<ParsedPane | null>(null);
  const [captured, setCaptured] = useState<ParsedPane[]>([]);
  const [useChime, setUseChime] = useState(true);
  const [readout, setReadout] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const recRef = useRef<any>(null);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  useEffect(() => {
    const SR = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    setSupported(!!SR);
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setText('');
      setInterim('');
      setParsed(null);
      setCaptured([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setParsed(text.trim() ? parseMeasurement(text, defaultUnit) : null);
  }, [text, defaultUnit]);

  const add = (p: ParsedPane) => {
    onAdd(p);
    setCaptured((c) => [p, ...c]);
    setText('');
    if (useChime) chime();
    if (readout && 'speechSynthesis' in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${p.label}, ${p.width} by ${p.height} ${p.unit === 'in' ? 'inches' : p.unit}, added`));
    }
  };

  function stop() {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setListening(false);
    setInterim('');
  }

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setSupported(false);
    const rec = new SR();
    rec.lang = 'en-AU';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        const p = parseMeasurement(finalText, defaultUnit);
        if (p && handsFreeRef.current) add(p);
        else setText(finalText.trim());
      }
    };
    rec.onerror = () => stop();
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" icon={Mic} title="Voice Measurement Assistant" description="Installers can speak naturally while holding a tape measure. Fractions, units, quantities and room names are parsed automatically.">
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-primary/10 to-fuchsia-500/10 p-6">
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={!supported}
            className={cn('relative grid h-20 w-20 place-items-center rounded-full text-white shadow-glow transition disabled:opacity-40', listening ? 'bg-danger' : 'bg-gradient-to-br from-primary to-fuchsia-500')}
            aria-label={listening ? 'Stop listening' : 'Tap to speak measurement'}
          >
            {listening ? <span className="absolute inset-0 animate-pulse-ring rounded-full bg-danger" /> : null}
            {listening ? <MicOff className="relative h-8 w-8" /> : <Mic className="relative h-8 w-8" />}
          </button>
          <p className="text-sm font-semibold">{!supported ? 'Live browser mic dictation is not supported here — type or tap a sample below.' : listening ? 'Listening… (tap to stop)' : 'Tap to speak measurement'}</p>
          {interim ? <p className="text-sm italic text-muted-fg">“{interim}”</p> : null}
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <Switch size="sm" checked={useChime} onChange={setUseChime} label="Chime feedback" />
            <Switch size="sm" checked={readout} onChange={setReadout} label="Spoken readout" />
            <Switch size="sm" checked={handsFree} onChange={setHandsFree} label="Hands-free continuous" />
          </div>
        </div>

        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Or type/paste dictation here (e.g. Master bed, left window, 34 and a half by 60 inches)…" />

        <AnimatePresence mode="wait">
          {text.trim() ? (
            parsed ? (
              <motion.div key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-success/40 bg-success/5 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success"><Wand2 className="h-3.5 w-3.5" /> Identified measurement</p>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-muted-fg">Room / zone</p><p className="font-semibold">{parsed.room || 'Current area'}</p></div>
                  <div><p className="text-xs text-muted-fg">Window / glass</p><p className="font-semibold">{parsed.label}</p></div>
                  <div><p className="text-xs text-muted-fg">Dimensions</p><p className="font-semibold">{parsed.width} × {parsed.height} {parsed.unit}</p></div>
                  <div><p className="text-xs text-muted-fg">Qty</p><p className="font-semibold">{parsed.qty}</p></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon={Plus} onClick={() => add(parsed)}>Add pane now</Button>
                  <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setText('')}>Cancel / retry</Button>
                </div>
              </motion.div>
            ) : (
              <motion.p key="bad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
                Could not identify dimensions. Say e.g. “Window 1, 36 by 60 inches”.
              </motion.p>
            )
          ) : null}
        </AnimatePresence>

        <div>
          <p className="label">Instant voice samples · tap to simulate speaking</p>
          <div className="flex flex-wrap gap-2">
            {VOICE_SAMPLES.map((s) => (
              <button key={s} type="button" onClick={() => setText(s)} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs hover:border-primary/40 hover:bg-primary/5">
                <Volume2 className="h-3 w-3 text-primary" />
                {s}
              </button>
            ))}
          </div>
        </div>

        {captured.length ? (
          <div>
            <p className="label">Captured this session ({captured.length})</p>
            <div className="space-y-1">
              {captured.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
                  <span>{c.room ? `${c.room} · ` : ''}{c.label}</span>
                  <Badge tone="success">{c.width} × {c.height} {c.unit}{c.qty > 1 ? ` × ${c.qty}` : ''}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
