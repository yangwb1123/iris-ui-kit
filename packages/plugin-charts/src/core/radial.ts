import { plotBox } from './cartesian'
import { clamp, finiteOr, formattedNumber, round } from './internal'
import { chartLegendItems, sliceTooltipItems } from './series'
import type {
  ChartArc,
  ChartDimensions,
  ChartSlice,
  DonutGeometry,
  DonutGeometryOptions,
  PieArcOptions,
} from './model'

interface PolarPoint {
  x: number
  y: number
}

function polarPoint(cx: number, cy: number, radius: number, angle: number): PolarPoint {
  return {
    x: round(cx + radius * Math.cos(angle)),
    y: round(cy + radius * Math.sin(angle)),
  }
}

/** Safe SVG path for a pie wedge or annular donut arc. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  if (![cx, cy, radius, innerRadius, startAngle, endAngle].every(Number.isFinite)) return ''
  radius = Math.max(0, radius)
  innerRadius = clamp(innerRadius, 0, radius)
  const tau = Math.PI * 2
  const delta = clamp(endAngle - startAngle, 0, tau)
  if (radius === 0 || delta <= Number.EPSILON) return ''
  const outerStart = polarPoint(cx, cy, radius, startAngle)

  if (delta >= tau - 1e-7) {
    const middleAngle = startAngle + Math.PI
    const outerMiddle = polarPoint(cx, cy, radius, middleAngle)
    const outer = `M${outerStart.x} ${outerStart.y} A${round(radius)} ${round(radius)} 0 1 1 ${outerMiddle.x} ${outerMiddle.y} A${round(radius)} ${round(radius)} 0 1 1 ${outerStart.x} ${outerStart.y}`
    if (innerRadius === 0) {
      return `M${round(cx)} ${round(cy)} L${outerStart.x} ${outerStart.y} ${outer.slice(outer.indexOf('A'))} Z`
    }
    const innerStart = polarPoint(cx, cy, innerRadius, startAngle)
    const innerMiddle = polarPoint(cx, cy, innerRadius, middleAngle)
    return `${outer} L${innerStart.x} ${innerStart.y} A${round(innerRadius)} ${round(innerRadius)} 0 1 0 ${innerMiddle.x} ${innerMiddle.y} A${round(innerRadius)} ${round(innerRadius)} 0 1 0 ${innerStart.x} ${innerStart.y} Z`
  }

  const outerEnd = polarPoint(cx, cy, radius, endAngle)
  const largeArc = delta > Math.PI ? 1 : 0
  if (innerRadius === 0) {
    return `M${round(cx)} ${round(cy)} L${outerStart.x} ${outerStart.y} A${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} Z`
  }
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle)
  const innerEnd = polarPoint(cx, cy, innerRadius, endAngle)
  return `M${outerStart.x} ${outerStart.y} A${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L${innerEnd.x} ${innerEnd.y} A${round(innerRadius)} ${round(innerRadius)} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`
}

/** Pure pie/donut arc geometry; unsafe and non-positive slices are omitted. */
export function pieArcs(slices: readonly ChartSlice[], options: PieArcOptions): ChartArc[] {
  const tooltips = sliceTooltipItems(slices)
  const total = tooltips.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return []
  const start = finiteOr(options.startAngle ?? -Math.PI / 2, -Math.PI / 2)
  let cursor = start
  return tooltips.map((tooltip) => {
    const startAngle = cursor
    const endAngle = cursor + (tooltip.value / total) * Math.PI * 2
    cursor = endAngle
    return {
      id: tooltip.id,
      label: tooltip.label,
      colorToken: tooltip.colorToken,
      color: tooltip.color,
      value: tooltip.value,
      percentage: tooltip.percentage ?? 0,
      startAngle,
      endAngle,
      path: arcPath(
        options.cx,
        options.cy,
        options.radius,
        options.innerRadius ?? 0,
        startAngle,
        endAngle,
      ),
      tooltip,
    }
  })
}

/** Complete renderer-neutral pie/donut geometry within a chart plot box. */
export function donutGeometry(
  slices: readonly ChartSlice[],
  dimensions: ChartDimensions,
  options: DonutGeometryOptions = {},
): DonutGeometry {
  const box = plotBox(dimensions)
  const radius = Math.max(0, Math.min(box.width, box.height) / 2)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const innerRadius = radius * clamp(options.innerRadiusRatio ?? 0.6, 0, 0.95)
  const arcs = pieArcs(slices, {
    cx,
    cy,
    radius,
    innerRadius,
    startAngle: options.startAngle,
  })
  const total = arcs.reduce((sum, arc) => sum + arc.value, 0)
  return {
    cx,
    cy,
    radius,
    innerRadius,
    total,
    arcs,
    legend: chartLegendItems(arcs),
    tooltips: arcs.map((arc) => arc.tooltip),
    description: `${arcs.length} slices with a total of ${formattedNumber(total) || '0'}.`,
  }
}
