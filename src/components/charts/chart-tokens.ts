/**
 * Chart color roles.
 *
 * The hex values live in `src/app/globals.css` as CSS custom properties with a
 * light set and a *separately chosen* dark set (not an automatic flip), so SVG
 * marks pick up the right step when the theme changes without a re-render.
 *
 * Palette: validated categorical slots 1–2 (blue / orange).
 *   light  #2a78d6  #eb6834
 *   dark   #3987e5  #d95926
 * Worst adjacent CVD ΔE 24.7 light / 26.8 dark; normal-vision ΔE 33.6 / 31.8;
 * both clear 3:1 against their surface.
 */
export const CHART = {
  /** Slot 1 — revenue / primary magnitude. */
  series1: 'var(--chart-1)',
  /** Slot 2 — expenses / the contrasting series. */
  series2: 'var(--chart-2)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  surface: 'var(--chart-surface)',
  textPrimary: 'var(--chart-text)',
  textMuted: 'var(--chart-text-muted)',
  positive: 'var(--chart-positive)',
  negative: 'var(--chart-negative)',
} as const

/** Recharts axis/tick styling shared by every chart so they read as one system. */
export const axisProps = {
  stroke: CHART.axis,
  tickLine: false,
  axisLine: false,
  tick: { fill: CHART.textMuted, fontSize: 11 },
} as const

export const gridProps = {
  stroke: CHART.grid,
  strokeDasharray: '3 3',
  vertical: false,
} as const
