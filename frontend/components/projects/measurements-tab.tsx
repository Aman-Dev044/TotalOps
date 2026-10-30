'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { CarFront, ClipboardCheck, Copy, Download, Mic, Plus, Ruler, Save, Scissors, Sparkles, Trash2 } from 'lucide-react';
import { useFilms, useMeta, useSettings } from '@/lib/hooks';
import { paneArea, uid } from '@/lib/format';
import type { Measurements, Pane, PaneGroup, Zone } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Modal, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import type { TabProps } from './use-project-action';
import { VoiceModal } from './voice-modal';
import { CutPreview } from './cut-preview';
import { AdvisorDrawer } from './advisor-drawer';
import type { ParsedPane } from './voice-parser';

const ZONES: { key: Zone; label: string }[] = [
  { key: 'frontSides', label: 'Front sides' },
  { key: 'rearSides', label: 'Rear sides' },
  { key: 'rearWindscreen', label: 'Rear windscreen' },
  { key: 'windscreen', label: 'Windscreen strip' },
  { key: 'sunroof', label: 'Sunroof' },
];
const WINDOW_TYPES = ['Fixed', 'Slider', 'Door', 'Sidelight', 'Louvres', 'Awning', 'Casement', 'Vehicle'];
const CHECKLIST = [
  ['glass', 'Glass inspected for scratches, chips and seal condition'],
  ['edges', 'Edge clearance and gaskets confirmed'],
  ['access', 'Safe access confirmed (ladders, lift, parking)'],
  ['compat', 'Film compatibility checked against manufacturer guidance'],
  ['photos', 'Before photos taken'],
] as const;

export function MeasurementsTab({ p, run, busy }: TabProps) {
  const confirm = useConfirm();
  const { data: meta } = useMeta();
  const { data: films } = useFilms();
  const { data: settings } = useSettings();
  const profile = settings?.measurementProfiles?.[p.segment];
  const defaultUnit = profile?.unit || 'mm';
  const auto = p.segment === 'automotive';
  const [m, setM] = useState<Measurements>({ groups: [] });
  const [dirty, setDirty] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState('');

  useEffect(() => {
    setM(JSON.parse(JSON.stringify(p.measurements || { groups: [] })));
    setDirty(false);
  }, [p.measurements]);

  const update = (fn: (draft: Measurements) => void) => {
    setM((prev) => {
      const next: Measurements = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const segFilms = (films || []).filter((f) => f.segments.includes(p.segment));
  const allPanes = useMemo(() => m.groups.flatMap((g) => g.panes.map((pn) => ({ ...pn, group: g.name }))), [m]);
  const selected = allPanes.filter((x) => x.selected !== false);
  const totalArea = selected.reduce((s, x) => s + paneArea(x), 0);
  const paneCount = selected.reduce((s, x) => s + (Number(x.qty) || 1), 0);
  const rollWidths = useMemo(() => {
    const ids = new Set(selected.map((x) => x.filmId || p.filmId).filter(Boolean));
    const ws = (films || []).filter((f) => ids.has(f._id)).flatMap((f) => f.rollWidths);
    return Array.from(new Set(ws.length ? ws : [1016, 1524, 1830])).sort((a, b) => a - b);
  }, [selected, films, p.filmId]);

  const newPane = (over: Partial<Pane> = {}): Pane => ({ id: uid(), label: 'Window', windowType: auto ? 'Vehicle' : 'Fixed', width: 0, height: 0, unit: defaultUnit, qty: 1, filmId: p.filmId || '', selected: true, ...(auto ? { zone: 'rearSides' as Zone } : {}), ...over });
  const addGroup = (name?: string) => {
    const g: PaneGroup = { id: uid(), name: name || (auto ? 'Vehicle glass' : `Room ${m.groups.length + 1}`), panes: [newPane()] };
    update((d) => d.groups.push(g));
    setActiveGroup(g.id);
    return g;
  };

  const onVoice = (v: ParsedPane) => {
    update((d) => {
      let g = v.room ? d.groups.find((x) => x.name.toLowerCase() === v.room.toLowerCase()) : d.groups.find((x) => x.id === activeGroup) || d.groups[d.groups.length - 1];
      if (!g) {
        g = { id: uid(), name: v.room || (auto ? 'Vehicle glass' : 'Room 1'), panes: [] };
        d.groups.push(g);
      }
      g.panes.push(newPane({ label: v.label, width: v.width, height: v.height, unit: v.unit, qty: v.qty, notes: `Captured via voice: “${v.raw}”` }));
    });
  };

  const save = async () => {
    const ok = await run('measurements.save', { measurements: m }, 'Measurement sheet saved to the project');
    if (ok) setDirty(false);
  };

  const exportCsv = () => {
    const rows = [['Area', 'Pane', 'Type', 'Zone', 'Width', 'Height', 'Unit', 'Qty', 'Area m2', 'Film', 'Included']];
    for (const x of allPanes) rows.push([x.group, x.label, x.windowType || '', x.zone || '', String(x.width), String(x.height), x.unit, String(x.qty), paneArea(x).toFixed(3), films?.find((f) => f._id === x.filmId)?.name || '', x.selected === false ? 'no' : 'yes']);
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.number}-measurements.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={Plus} variant="outline" onClick={() => addGroup()}>{auto ? 'Add area' : 'Add floor / room'}</Button>
            {auto ? <Button icon={CarFront} variant="outline" onClick={() => setTplOpen(true)}>Vehicle template</Button> : null}
            <Button icon={Mic} variant="outline" onClick={() => setVoiceOpen(true)}>Voice measure</Button>
            <Button icon={Sparkles} variant="accent" onClick={() => (dirty ? toast.info('Save the sheet first so the advisor uses your latest panes') : setAdvisorOpen(true))}>Smart recommend</Button>
            <Button icon={Download} variant="ghost" onClick={exportCsv} disabled={!allPanes.length}>Export sheet</Button>
            <div className="ml-auto flex items-center gap-2">
              {dirty ? <Badge tone="warning" dot>Unsaved changes</Badge> : m.measuredAt ? <Badge tone="success" dot>Saved</Badge> : null}
              <Button icon={Save} loading={busy === 'measurements.save'} onClick={save} disabled={!dirty}>Save measurement sheet</Button>
            </div>
          </div>
        </Card>

        {!m.groups.length ? (
          <Card>
            <EmptyState icon={Ruler} title="Start by adding a window, room or vehicle glass area." description={auto ? 'Load a vehicle template to pre-fill typical glass sizes, then adjust on the car.' : 'Add rooms and panes, or use voice measure while holding the tape.'} action={auto ? <Button icon={CarFront} onClick={() => setTplOpen(true)}>Load vehicle template</Button> : <Button icon={Plus} onClick={() => addGroup()}>Add room</Button>} />
          </Card>
        ) : null}

        <AnimatePresence initial={false}>
          {m.groups.map((g, gi) => {
            const gArea = g.panes.filter((x) => x.selected !== false).reduce((s, x) => s + paneArea(x), 0);
            return (
              <motion.div key={g.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className={activeGroup === g.id ? 'ring-2 ring-primary/30' : ''} onClick={() => setActiveGroup(g.id)}>
                  <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                    <Input value={g.name} onChange={(e) => update((d) => { d.groups[gi].name = e.target.value; })} className="h-9 max-w-xs font-semibold" aria-label={profile?.groupLabel || 'Area name'} />
                    <Badge tone="primary">{g.panes.length} panes · {gArea.toFixed(2)} m²</Badge>
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" icon={Plus} onClick={() => update((d) => { d.groups[gi].panes.push(newPane()); })}>Add pane</Button>
                      <Button size="icon" variant="ghost" aria-label="Duplicate group" onClick={() => update((d) => { d.groups.splice(gi + 1, 0, { ...JSON.parse(JSON.stringify(g)), id: uid(), name: `${g.name} (copy)`, panes: g.panes.map((x) => ({ ...x, id: uid() })) }); })}><Copy className="h-4 w-4" /></Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remove area"
                        onClick={async () => {
                          if (await confirm({ title: `Remove “${g.name}”?`, description: 'All panes in this area are removed from the sheet (saved after you click Save).', confirmLabel: 'Remove', danger: true })) update((d) => { d.groups.splice(gi, 1); });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table-base text-xs">
                      <thead>
                        <tr>
                          <th className="w-8">Inc</th>
                          <th>Pane description</th>
                          <th>{auto ? 'Zone' : 'Window type'}</th>
                          <th>Width</th>
                          <th>Height</th>
                          <th>Unit</th>
                          <th>Qty</th>
                          <th>Film</th>
                          <th className="text-right">Area</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {g.panes.map((pn, pi) => {
                          const set = (patch: Partial<Pane>) => update((d) => { Object.assign(d.groups[gi].panes[pi], patch); });
                          const bad = pn.selected !== false && (!(Number(pn.width) > 0) || !(Number(pn.height) > 0));
                          return (
                            <tr key={pn.id} className={pn.selected === false ? 'opacity-50' : ''}>
                              <td><Checkbox checked={pn.selected !== false} onChange={(v) => set({ selected: v })} /></td>
                              <td><Input value={pn.label} onChange={(e) => set({ label: e.target.value })} className="h-8 min-w-[150px] text-xs" /></td>
                              <td>
                                {auto ? (
                                  <Select value={pn.zone || 'rearSides'} onChange={(e) => set({ zone: e.target.value as Zone })} className="h-8 min-w-[120px] text-xs">
                                    {ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
                                  </Select>
                                ) : (
                                  <Select value={pn.windowType || 'Fixed'} onChange={(e) => set({ windowType: e.target.value })} className="h-8 min-w-[100px] text-xs">
                                    {WINDOW_TYPES.map((t) => <option key={t}>{t}</option>)}
                                  </Select>
                                )}
                              </td>
                              <td><Input type="number" min={0} value={pn.width || ''} onChange={(e) => set({ width: Number(e.target.value) })} className={`h-8 w-20 text-xs ${bad ? 'border-danger' : ''}`} /></td>
                              <td><Input type="number" min={0} value={pn.height || ''} onChange={(e) => set({ height: Number(e.target.value) })} className={`h-8 w-20 text-xs ${bad ? 'border-danger' : ''}`} /></td>
                              <td>
                                <Select value={pn.unit} onChange={(e) => set({ unit: e.target.value })} className="h-8 w-16 text-xs">
                                  {(meta?.units || ['mm', 'cm', 'm', 'in', 'ft']).map((u) => <option key={u}>{u}</option>)}
                                </Select>
                              </td>
                              <td><Input type="number" min={1} step={1} value={pn.qty} onChange={(e) => set({ qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className="h-8 w-14 text-xs" /></td>
                              <td>
                                <Select value={pn.filmId || ''} onChange={(e) => set({ filmId: e.target.value })} className="h-8 min-w-[130px] text-xs">
                                  <option value="">Project film</option>
                                  {segFilms.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                                </Select>
                              </td>
                              <td className="text-right font-semibold tabular-nums">{paneArea(pn).toFixed(2)} m²</td>
                              <td className="whitespace-nowrap">
                                <button type="button" aria-label="Duplicate pane" onClick={() => update((d) => { d.groups[gi].panes.splice(pi + 1, 0, { ...pn, id: uid() }); })} className="rounded-md p-1.5 text-muted-fg hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
                                <button type="button" aria-label="Remove pane" onClick={() => update((d) => { d.groups[gi].panes.splice(pi, 1); })} className="rounded-md p-1.5 text-muted-fg hover:bg-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!g.panes.length ? <p className="p-4 text-center text-xs text-muted-fg">No panes in {g.name} yet. Use “Add pane”.</p> : null}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <p className="label">Total selected glass area</p>
          <p className="font-display text-4xl font-extrabold">{totalArea.toFixed(2)} <span className="text-lg text-muted-fg">m²</span></p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Panes in scope</p><p className="font-display text-lg font-bold">{paneCount}</p></div>
            <div className="rounded-xl bg-muted/70 p-2"><p className="text-muted-fg">Sheet status</p><p className="font-display text-sm font-bold">{m.verified ? 'Verified' : paneCount ? 'Ready for quoting' : 'Not measured'}</p></div>
          </div>
        </Card>
        <Card>
          <CardHeader icon={ClipboardCheck} title="Installer checklist" subtitle="Confirm before marking this sheet verified." />
          <div className="space-y-2.5 p-5">
            {CHECKLIST.map(([key, label]) => (
              <Checkbox key={key} checked={!!m.checklist?.[key]} onChange={(v) => update((d) => { d.checklist = { ...(d.checklist || {}), [key]: v }; })} label={<span className="text-sm">{label}</span>} />
            ))}
            <div className="border-t border-line pt-3">
              <Switch checked={!!m.verified} onChange={(v) => update((d) => { d.verified = v; })} label={<span className="text-sm font-semibold">Verified by installer</span>} />
            </div>
            <Field label="Photos & notes"><Textarea value={m.notes || ''} onChange={(e) => update((d) => { d.notes = e.target.value; })} rows={3} placeholder="Glass condition, defects, access…" /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader icon={Scissors} title="Cut planning preview" subtitle={`Roll widths: ${rollWidths.join(', ')} mm`} />
          <div className="p-5"><CutPreview panes={allPanes} widths={rollWidths} /></div>
        </Card>
      </div>

      <VoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} onAdd={onVoice} defaultUnit={defaultUnit} />
      <AdvisorDrawer open={advisorOpen} onClose={() => setAdvisorOpen(false)} projectId={p._id} run={run} />
      <TemplateModal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        initialBody={p.vehicle.bodyType || 'suv'}
        bodyTypes={meta?.bodyTypes || []}
        optional={meta?.optionalPanes || []}
        onApply={(body, extras, replace) => {
          const bt = meta?.bodyTypes.find((b) => b.key === body);
          if (!bt) return;
          const panes = [...bt.panes, ...(meta?.optionalPanes || []).filter((o) => extras.includes(o.key))].map((x) => newPane({ label: x.label, zone: x.zone, windowType: 'Vehicle', width: x.width, height: x.height, unit: 'mm', qty: x.qty }));
          update((d) => {
            if (replace) d.groups = [];
            d.groups.push({ id: uid(), name: `${bt.label} glass`, panes });
          });
          setTplOpen(false);
          toast.success(`${bt.label} template loaded — verify sizes on the vehicle`);
        }}
      />
    </div>
  );
}

function TemplateModal({ open, onClose, initialBody, bodyTypes, optional, onApply }: { open: boolean; onClose: () => void; initialBody: string; bodyTypes: { key: string; label: string; examples: string; panes: any[] }[]; optional: { key: string; label: string }[]; onApply: (body: string, extras: string[], replace: boolean) => void }) {
  const [body, setBody] = useState(initialBody);
  const [extras, setExtras] = useState<string[]>([]);
  const [replace, setReplace] = useState(true);
  useEffect(() => {
    if (open) setBody(initialBody);
  }, [open, initialBody]);
  const bt = bodyTypes.find((b) => b.key === body);
  return (
    <Modal open={open} onClose={onClose} icon={CarFront} title="Vehicle template" description="Pre-fill typical glass sizes for the body style." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onApply(body, extras, replace)}>Load template</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {bodyTypes.map((b) => (
            <button key={b.key} type="button" onClick={() => setBody(b.key)} className={`rounded-xl border p-3 text-left text-sm transition ${body === b.key ? 'border-primary bg-primary/10' : 'border-line hover:bg-muted'}`}>
              <p className="font-semibold">{b.label}</p>
              <p className="text-[11px] text-muted-fg">{b.panes.length} panes</p>
            </button>
          ))}
        </div>
        {bt ? <p className="text-xs text-muted-fg">e.g. {bt.examples}</p> : null}
        <div className="flex flex-wrap gap-4">
          {optional.map((o) => <Checkbox key={o.key} checked={extras.includes(o.key)} onChange={(v) => setExtras((x) => (v ? [...x, o.key] : x.filter((k) => k !== o.key)))} label={o.label} />)}
        </div>
        <Switch checked={replace} onChange={setReplace} label="Replace existing areas" />
      </div>
    </Modal>
  );
}
