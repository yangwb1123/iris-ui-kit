import { createPlugin } from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-charts` — zero-dependency, token-themed SVG charts for Iris
 * UI. This `core` entry is framework-agnostic: pure geometry (scales, axis
 * ticks, line/area paths, bar rects) that the four thin SVG renderers consume,
 * plus the {@link chartsPlugin} (registers `--iris-chart-*` theme tokens). No
 * charting library — everything is computed here and drawn as plain SVG, so the
 * bundle stays tiny and the chart inherits the active theme via CSS variables.
 */

export interface ChartDimensions {
  width: number
  height: number
  /** Inner padding (px) reserved for axes/labels. */
  padding?: number | { top: number; right: number; bottom: number; left: number }
}

interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

function resolveInsets(padding: ChartDimensions['padding']): Insets {
  if (padding == null) return { top: 8, right: 8, bottom: 8, left: 8 }
  if (typeof padding === 'number')
    return { top: padding, right: padding, bottom: padding, left: padding }
  return padding
}

/** The drawable inner box after subtracting padding. */
export interface PlotBox {
  x: number
  y: number
  width: number
  height: number
}

export function plotBox(dim: ChartDimensions): PlotBox {
  const ins = resolveInsets(dim.padding)
  return {
    x: ins.left,
    y: ins.top,
    width: Math.max(0, dim.width - ins.left - ins.right),
    height: Math.max(0, dim.height - ins.top - ins.bottom),
  }
}

/** A min/max domain. When the data is flat, the range is padded to avoid /0. */
export interface Domain {
  min: number
  max: number
}

export function dataDomain(values: readonly number[]): Domain {
  if (values.length === 0) return { min: 0, max: 1 }
  let min = values[0]!
  let max = values[0]!
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) {
    // Flat series: open a symmetric range so points sit on the mid-line.
    const pad = Math.abs(min) || 1
    return { min: min - pad, max: max + pad }
  }
  return { min, max }
}

/**
 * A "nice" rounded domain (1/2/5 × 10ⁿ step) covering `[min, max]` — the
 * standard axis-rounding so ticks land on human-friendly values.
 */
export function niceDomain(min: number, max: number, tickCount = 5): Domain {
  if (min === max) {
    const pad = Math.abs(min) || 1
    min -= pad
    max += pad
  }
  const span = niceNum(max - min, false)
  const step = niceNum(span / Math.max(1, tickCount - 1), true)
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step }
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range || 1))
  const frac = (range || 1) / Math.pow(10, exp)
  let nice: number
  if (round) {
    if (frac < 1.5) nice = 1
    else if (frac < 3) nice = 2
    else if (frac < 7) nice = 5
    else nice = 10
  } else {
    if (frac <= 1) nice = 1
    else if (frac <= 2) nice = 2
    else if (frac <= 5) nice = 5
    else nice = 10
  }
  return nice * Math.pow(10, exp)
}

/** Evenly-spaced tick values across `[domain.min, domain.max]`. */
export function axisTicks(domain: Domain, count = 5): number[] {
  if (count < 2) return [domain.min, domain.max]
  const ticks: number[] = []
  const step = (domain.max - domain.min) / (count - 1)
  for (let i = 0; i < count; i += 1) ticks.push(domain.min + step * i)
  return ticks
}

/** Map a value in `domain` to a Y pixel within `box` (inverted — 0 at bottom). */
export function scaleY(value: number, domain: Domain, box: PlotBox): number {
  const span = domain.max - domain.min || 1
  const t = (value - domain.min) / span
  return box.y + box.height - t * box.height
}

/** Map a 0-based index of `count` points to an X pixel within `box`. */
export function scaleX(index: number, count: number, box: PlotBox): number {
  if (count <= 1) return box.x + box.width / 2
  return box.x + (index / (count - 1)) * box.width
}

export interface Point {
  x: number
  y: number
}

/** Project a numeric series to `{x,y}` pixel points within `box`. */
export function seriesPoints(values: readonly number[], domain: Domain, box: PlotBox): Point[] {
  return values.map((v, i) => ({ x: scaleX(i, values.length, box), y: scaleY(v, domain, box) }))
}

/** An SVG `path` `d` for a polyline through the points. */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ')
}

/**
 * An SVG `path` `d` for a filled area between the line and the baseline
 * (`box` bottom), for area charts.
 */
export function areaPath(points: readonly Point[], box: PlotBox): string {
  if (points.length === 0) return ''
  const baseline = box.y + box.height
  const top = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ')
  const first = points[0]!
  const last = points[points.length - 1]!
  return `${top} L${round(last.x)} ${round(baseline)} L${round(first.x)} ${round(baseline)} Z`
}

export interface BarRect {
  x: number
  y: number
  width: number
  height: number
  value: number
}

/**
 * Bar rectangles for a series, one per value, evenly distributed across `box`
 * with `gap` (0..1) fractional spacing between bars. Negative values draw
 * downward from the zero line when the domain spans zero.
 */
export function barRects(
  values: readonly number[],
  domain: Domain,
  box: PlotBox,
  gap = 0.2,
): BarRect[] {
  const n = values.length
  if (n === 0) return []
  const slot = box.width / n
  const barWidth = slot * (1 - gap)
  const zeroY = scaleY(Math.max(domain.min, Math.min(0, domain.max)), domain, box)
  return values.map((value, i) => {
    const valueY = scaleY(value, domain, box)
    const x = box.x + slot * i + (slot - barWidth) / 2
    const y = Math.min(valueY, zeroY)
    const height = Math.abs(valueY - zeroY)
    return { x: round(x), y: round(y), width: round(barWidth), height: round(height), value }
  })
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** CSS custom properties the charts read; overridable by the host theme. */
export const chartTokens: Record<string, string> = {
  '--iris-chart-line': 'var(--iris-color-primary, #3b82f6)',
  '--iris-chart-area': 'var(--iris-color-primary-soft, rgba(59,130,246,0.15))',
  '--iris-chart-bar': 'var(--iris-color-primary, #3b82f6)',
  '--iris-chart-axis': 'var(--iris-color-border, #e5e7eb)',
  '--iris-chart-text': 'var(--iris-color-fg-muted, #6b7280)',
  '--iris-chart-grid': 'var(--iris-color-border-subtle, #f1f5f9)',
}

/**
 * The charts plugin. Pass to `<IrisProvider plugins={[chartsPlugin]}>`. Registers
 * the chart theme tokens (charts are otherwise stateless, so no store).
 */
export const chartsPlugin = createPlugin({
  name: 'charts',
  install(registry) {
    registry.registerTokens(chartTokens)
  },
})
