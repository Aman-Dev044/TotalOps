'use client';

import { useTheme } from '@/components/providers';

/**
 * Validated chart palettes (dataviz validator: lightness band, chroma, CVD ΔE ≥ 8, normal-vision ≥ 15).
 * Light and dark are separate steps of the same hues — never an automatic flip.
 * Segment hues fall below 3:1 contrast on the light surface, so charts using them must keep visible labels/legends.
 */
const LIGHT = {
  segment: { automotive: '#6366f1', residential: '#10b981', commercial: '#f59e0b' },
  series: ['#5b5bf7', '#1baf7a', '#eb6834', '#e87ba4'],
  grid: '#e7e9ef',
  axis: '#6b7280',
  surface: '#ffffff',
};
const DARK = {
  segment: { automotive: '#7c7ff5', residential: '#12a173', commercial: '#c98500' },
  series: ['#7c7ff5', '#199e70', '#d95926', '#d55181'],
  grid: '#262a35',
  axis: '#9aa1ad',
  surface: '#16181f',
};

export function useChartColors() {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}

export const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: '1px solid hsl(var(--line))', background: 'hsl(var(--card))', color: 'hsl(var(--fg))', boxShadow: '0 10px 30px -12px rgb(0 0 0 / .3)', fontSize: 12 },
  labelStyle: { color: 'hsl(var(--muted-fg))', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: 'hsl(var(--fg))' },
  cursor: { stroke: 'hsl(var(--muted-fg))', strokeOpacity: 0.35, strokeWidth: 1 },
};
