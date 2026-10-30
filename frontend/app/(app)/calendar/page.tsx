'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useApi, useLocalState, useMeta, useStaff } from '@/lib/hooks';
import { useStoreScope } from '@/components/providers';
import { addDays, fmtDate, fmtTime, parseDate, todayStr } from '@/lib/format';
import type { ScheduleItem } from '@/lib/types';
import { Button, Card, ErrorState, PageHeader, Segmented, Select, Skeleton, cn } from '@/components/ui';
import { AppointmentModal, apptTypeLabel, type AppointmentDraft } from '@/components/schedule/appointment-modal';
import { VisitDrawer } from '@/components/schedule/visit-drawer';
import { fromMin, itemColor, layoutDay, mondayOf, toMin } from '@/components/schedule/layout';

type View = 'month' | 'week' | 'day';
const START_H = 7;
const END_H = 18;
const HOUR_PX = 56;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthRange(date: string) {
  const [y, m] = date.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const from = mondayOf(first);
  return { from, to: addDays(from, 41) };
}

export default function CalendarPage() {
  const [view, setView] = useLocalState<View>('calendar.view', 'week');
  const [cursor, setCursor] = useState(todayStr());
  const [installerId, setInstallerId] = useState('');
  const [type, setType] = useState('');
  const { storeId } = useStoreScope();
  const { data: staff } = useStaff();
  const { data: meta } = useMeta();
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);
  const [selected, setSelected] = useState<ScheduleItem | null>(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: cursor };
    if (view === 'week') {
      const from = mondayOf(cursor);
      return { from, to: addDays(from, 6) };
    }
    return monthRange(cursor);
  }, [view, cursor]);

  const qs = new URLSearchParams({ from: range.from, to: range.to });
  if (storeId) qs.set('storeId', storeId);
  if (installerId) qs.set('installerId', installerId);
  if (type) qs.set('type', type);
  const { data, error, isLoading, mutate } = useApi<ScheduleItem[]>(`/schedule?${qs.toString()}`, { refreshInterval: 60_000 });

  const step = (dir: number) => {
    if (view === 'day') setCursor(addDays(cursor, dir));
    else if (view === 'week') setCursor(addDays(cursor, dir * 7));
    else {
      const d = parseDate(cursor);
      d.setMonth(d.getMonth() + dir, 1);
      setCursor(todayStr(d));
    }
  };

  const title =
    view === 'month'
      ? parseDate(cursor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${fmtDate(range.from, { day: 'numeric', month: 'short' })} – ${fmtDate(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : fmtDate(cursor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const byDate = useMemo(() => {
    const m = new Map<string, ScheduleItem[]>();
    for (const i of data || []) m.set(i.date, [...(m.get(i.date) || []), i]);
    return m;
  }, [data]);

  const book = (date: string, start = '09:00') => setDraft({ date, start, end: fromMin(Math.min(toMin(start) + 120, 23 * 60)), storeId: storeId || undefined, installerId: installerId || undefined });
  const days = view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, k) => addDays(range.from, k));
  const installers = (staff || []).filter((s) => s.role === 'installer' && (!storeId || String(s.storeId) === storeId));

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        eyebrow="Field schedule"
        title="Calendar"
        subtitle="Book and coordinate visits against live projects."
        actions={<Button icon={Plus} onClick={() => book(view === 'day' ? cursor : todayStr())}>Book appointment</Button>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(todayStr())}>
            Today
          </Button>
          <Button size="icon" variant="ghost" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select className="h-9 w-44" value={installerId} onChange={(e) => setInstallerId(e.target.value)} aria-label="Installer">
            <option value="">All installers</option>
            {installers.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </Select>
          <Select className="h-9 w-40" value={type} onChange={(e) => setType(e.target.value)} aria-label="Appointment type">
            <option value="">All types</option>
            {(meta?.appointmentTypes || []).map((t) => (
              <option key={t} value={t}>{apptTypeLabel(t)}</option>
            ))}
          </Select>
          <Segmented size="sm" value={view} onChange={setView} options={[{ key: 'month', label: 'Month' }, { key: 'week', label: 'Week' }, { key: 'day', label: 'Day' }]} />
        </div>
      </Card>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Skeleton className="h-[640px]" />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={`${view}-${range.from}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
            {view === 'month' ? (
              <MonthGrid from={range.from} month={Number(cursor.slice(5, 7))} byDate={byDate} onBook={book} onSelect={setSelected} onDay={(d) => { setCursor(d); setView('day'); }} />
            ) : (
              <TimeGrid days={days} byDate={byDate} onBook={book} onSelect={setSelected} />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <AppointmentModal open={!!draft} initial={draft} onClose={() => setDraft(null)} onSaved={() => mutate()} />
      <VisitDrawer
        item={selected}
        onClose={() => { setSelected(null); mutate(); }}
        onEdit={(i) => { setSelected(null); setDraft({ ...i, projectId: String(i.projectId) }); }}
      />
    </div>
  );
}

function TimeGrid({ days, byDate, onBook, onSelect }: { days: string[]; byDate: Map<string, ScheduleItem[]>; onBook: (d: string, t: string) => void; onSelect: (i: ScheduleItem) => void }) {
  const hours = Array.from({ length: END_H - START_H }, (_, k) => START_H + k);
  const today = todayStr();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length > 1 ? 860 : 0 }}>
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0,1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={d} className={cn('border-l border-line px-2 py-2.5 text-center', d === today && 'bg-primary/5')}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-fg">{fmtDate(d, { weekday: 'short' })}</p>
                <p className={cn('mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full font-display text-base font-bold', d === today && 'bg-primary text-white')}>{Number(d.slice(8))}</p>
              </div>
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0,1fr))` }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="relative border-b border-line/60 pr-2 text-right text-[11px] text-muted-fg" style={{ height: HOUR_PX }}>
                  <span className="relative top-1">{fmtTime(`${String(h).padStart(2, '0')}:00`)}</span>
                </div>
              ))}
            </div>
            {days.map((d) => {
              const items = (byDate.get(d) || []).filter((i) => toMin(i.end) > START_H * 60 && toMin(i.start) < END_H * 60);
              const placed = layoutDay(items);
              return (
                <div
                  key={d}
                  className={cn('relative cursor-copy border-l border-line', d === today && 'bg-primary/[0.03]')}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const mins = START_H * 60 + Math.floor(((y / HOUR_PX) * 60) / 30) * 30;
                    onBook(d, fromMin(Math.min(mins, END_H * 60 - 60)));
                  }}
                >
                  {hours.map((h) => (
                    <div key={h} className="border-b border-line/60" style={{ height: HOUR_PX }}>
                      <div className="h-1/2 border-b border-dashed border-line/40" />
                    </div>
                  ))}
                  {d === today && nowMin > START_H * 60 && nowMin < END_H * 60 ? (
                    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}>
                      <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-danger" />
                      <span className="h-0.5 flex-1 bg-danger" />
                    </div>
                  ) : null}
                  {placed.map(({ item, col, cols }, k) => {
                    const top = ((Math.max(toMin(item.start), START_H * 60) - START_H * 60) / 60) * HOUR_PX;
                    const height = Math.max(26, ((Math.min(toMin(item.end), END_H * 60) - Math.max(toMin(item.start), START_H * 60)) / 60) * HOUR_PX - 3);
                    const color = itemColor(item);
                    const done = item.status === 'completed';
                    return (
                      <motion.button
                        type="button"
                        key={`${item.projectId}-${item._id}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: done ? 0.6 : 1, scale: 1 }}
                        transition={{ delay: k * 0.02 }}
                        whileHover={{ scale: 1.02, zIndex: 20 }}
                        onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                        className="absolute overflow-hidden rounded-lg border-l-[3px] bg-card px-2 py-1 text-left text-[11px] shadow-sm"
                        style={{ top, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)`, borderColor: color, backgroundImage: `linear-gradient(${color}26, ${color}26)` }}
                      >
                        <p className="truncate font-semibold" style={{ color }}>{fmtTime(item.start)} · {apptTypeLabel(item.type)}</p>
                        <p className="truncate font-semibold text-fg">{item.contact?.name || item.projectTitle}</p>
                        {height > 50 ? <p className="truncate text-muted-fg">{item.projectTitle}</p> : null}
                        {height > 70 ? <p className="truncate text-muted-fg">{item.installer?.name || 'Unassigned'}{item.bay ? ` · ${item.bay}` : ''}</p> : null}
                      </motion.button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MonthGrid({ from, month, byDate, onBook, onSelect, onDay }: { from: string; month: number; byDate: Map<string, ScheduleItem[]>; onBook: (d: string) => void; onSelect: (i: ScheduleItem) => void; onDay: (d: string) => void }) {
  const cells = Array.from({ length: 42 }, (_, k) => addDays(from, k));
  const today = todayStr();
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-line bg-muted/40">
            {DOW.map((d) => (
              <p key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-fg">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d) => {
              const items = byDate.get(d) || [];
              const inMonth = Number(d.slice(5, 7)) === month;
              return (
                <div key={d} onClick={() => onBook(d)} className={cn('group min-h-[112px] cursor-copy border-b border-r border-line/70 p-1.5 transition hover:bg-muted/40', !inMonth && 'bg-muted/20 opacity-60')}>
                  <div className="mb-1 flex items-center justify-between">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onDay(d); }} className={cn('grid h-6 w-6 place-items-center rounded-full text-xs font-bold hover:bg-primary/10', d === today && 'bg-primary text-white hover:bg-primary')}>
                      {Number(d.slice(8))}
                    </button>
                    {items.length ? <span className="text-[10px] font-semibold text-muted-fg">{items.length}</span> : <Plus className="h-3.5 w-3.5 text-muted-fg opacity-0 group-hover:opacity-100" />}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((i) => {
                      const color = itemColor(i);
                      return (
                        <button
                          type="button"
                          key={`${i.projectId}-${i._id}`}
                          onClick={(e) => { e.stopPropagation(); onSelect(i); }}
                          className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium hover:brightness-95"
                          style={{ background: `${color}1f` }}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                          <span className="truncate text-fg">{fmtTime(i.start)} {i.contact?.name || i.projectTitle}</span>
                        </button>
                      );
                    })}
                    {items.length > 3 ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onDay(d); }} className="px-1.5 text-[11px] font-semibold text-primary hover:underline">
                        +{items.length - 3} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
