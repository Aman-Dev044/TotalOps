import type { ScheduleItem } from '@/lib/types';

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Assigns side-by-side columns to overlapping events. Returns { item, col, cols }. */
export function layoutDay(items: ScheduleItem[]) {
  const sorted = [...items].sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(b.end) - toMin(a.end));
  const out: { item: ScheduleItem; col: number; cols: number }[] = [];
  let cluster: { item: ScheduleItem; col: number; cols: number }[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];
  const flush = () => {
    const n = colEnds.length || 1;
    for (const c of cluster) c.cols = n;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const item of sorted) {
    const s = toMin(item.start);
    const e = Math.max(s + 15, toMin(item.end));
    if (cluster.length && s >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let col = colEnds.findIndex((end) => end <= s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(e);
    } else colEnds[col] = e;
    cluster.push({ item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return out;
}

export function mondayOf(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function itemColor(i: ScheduleItem) {
  return i.installer?.color || i.store?.color || '#6366f1';
}
