import { clamp, finiteOr, nonNegative, round, type Insets } from './internal'
import type { BarRect, ChartDimensions, Domain, PlotBox, Point } from './model'

function resolveInsets(padding: ChartDimensions['padding']): Insets {
  if (padding == null) return { top: 8, right: 8, bottom: 8, left: 8 }
  if (typeof padding === 'number') {
    const value = nonNegative(padding)
    return { top: value, right: value, bottom: value, left: value }
  }
  return {
    top: nonNegative(padding.top),
    right: nonNegative(padding.right),
    bottom: nonNegative(padding.bottom),
    left: nonNegative(padding.left),
  }
}

/** The drawable inner box after subtracting padding. */
export function plotBox(dimensions: ChartDimensions): PlotBox {
  const insets = resolveInsets(dimensions.padding)
  const width = nonNegative(dimensions.width)
  const height = nonNegative(dimensions.height)
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  }
}

/** Find a finite min/max domain and pad flat data to avoid division by zero. */
export function dataDomain(values: readonly number[]): Domain {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0) return { min: 0, max: 1 }
  let min = finiteValues[0]!
  let max = finiteValues[0]!
  for (const value of finiteValues) {
    if (value < min) min = value
    if (value > max) max = value
  }
  if (min === max) {
    const padding = Math.abs(min) || 1
    return { min: min - padding, max: max + padding }
  }
  return { min, max }
}

function niceNum(range: number, shouldRound: boolean): number {
  const exponent = Math.floor(Math.log10(range || 1))
  const fraction = (range || 1) / Math.pow(10, exponent)
  let nice: number
  if (shouldRound) {
    if (fraction < 1.5) nice = 1
    else if (fraction < 3) nice = 2
    else if (fraction < 7) nice = 5
    else nice = 10
  } else {
    if (fraction <= 1) nice = 1
    else if (fraction <= 2) nice = 2
    else if (fraction <= 5) nice = 5
    else nice = 10
  }
  return nice * Math.pow(10, exponent)
}

/** Rounded 1/2/5 × 10ⁿ domain covering `[min, max]`. */
export function niceDomain(min: number, max: number, tickCount = 5): Domain {
  min = finiteOr(min, 0)
  max = finiteOr(max, 1)
  if (min > max) [min, max] = [max, min]
  if (min === max) {
    const padding = Math.abs(min) || 1
    min -= padding
    max += padding
  }
  const span = niceNum(max - min, false)
  const step = niceNum(span / Math.max(1, finiteOr(tickCount, 5) - 1), true)
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step }
}

/** Evenly-spaced tick values across `[domain.min, domain.max]`. */
export function axisTicks(domain: Domain, count = 5): number[] {
  const safeDomain =
    Number.isFinite(domain.min) && Number.isFinite(domain.max) ? domain : { min: 0, max: 1 }
  count = Math.max(0, Math.floor(finiteOr(count, 5)))
  if (count < 2) return [safeDomain.min, safeDomain.max]
  const ticks: number[] = []
  const step = (safeDomain.max - safeDomain.min) / (count - 1)
  for (let index = 0; index < count; index += 1) {
    ticks.push(safeDomain.min + step * index)
  }
  return ticks
}

/** Map a value to an inverted Y pixel within `box`. */
export function scaleY(value: number, domain: Domain, box: PlotBox): number {
  const min = finiteOr(domain.min, 0)
  const max = finiteOr(domain.max, 1)
  const span = max - min || 1
  const ratio = (finiteOr(value, min) - min) / span
  return box.y + box.height - ratio * box.height
}

/** Map a point index to an X pixel within `box`. */
export function scaleX(index: number, count: number, box: PlotBox): number {
  index = finiteOr(index, 0)
  count = Math.max(0, Math.floor(finiteOr(count, 0)))
  if (count <= 1) return box.x + box.width / 2
  return box.x + (index / (count - 1)) * box.width
}

/** Project a numeric series to pixel points within `box`. */
export function seriesPoints(values: readonly number[], domain: Domain, box: PlotBox): Point[] {
  return values.flatMap((value, index) =>
    Number.isFinite(value)
      ? [{ x: scaleX(index, values.length, box), y: scaleY(value, domain, box) }]
      : [],
  )
}

/** An SVG `path` `d` for a polyline through the points. */
export function linePath(points: readonly Point[]): string {
  const finitePoints = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  )
  if (finitePoints.length === 0) return ''
  return finitePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ')
}

/** An SVG area path closed against the plot baseline. */
export function areaPath(points: readonly Point[], box: PlotBox): string {
  const finitePoints = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  )
  if (finitePoints.length === 0) return ''
  const baseline = box.y + box.height
  const top = finitePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ')
  const first = finitePoints[0]!
  const last = finitePoints[finitePoints.length - 1]!
  return `${top} L${round(last.x)} ${round(baseline)} L${round(first.x)} ${round(baseline)} Z`
}

/**
 * Bar rectangles for one series. Negative values draw downward from the zero
 * line when the domain spans zero.
 */
export function barRects(
  values: readonly number[],
  domain: Domain,
  box: PlotBox,
  gap = 0.2,
): BarRect[] {
  const count = values.length
  if (count === 0) return []
  const slot = box.width / count
  const width = slot * (1 - clamp(gap, 0, 0.95))
  const zeroY = scaleY(Math.max(domain.min, Math.min(0, domain.max)), domain, box)
  return values.flatMap((value, index) => {
    if (!Number.isFinite(value)) return []
    const valueY = scaleY(value, domain, box)
    const x = box.x + slot * index + (slot - width) / 2
    return [
      {
        x: round(x),
        y: round(Math.min(valueY, zeroY)),
        width: round(width),
        height: round(Math.abs(valueY - zeroY)),
        value,
      },
    ]
  })
}
