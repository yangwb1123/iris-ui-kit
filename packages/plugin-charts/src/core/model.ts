export interface ChartDimensions {
  width: number
  height: number
  /** Inner padding (px) reserved for axes/labels. */
  padding?: number | { top: number; right: number; bottom: number; left: number }
}

/** The drawable inner box after subtracting padding. */
export interface PlotBox {
  x: number
  y: number
  width: number
  height: number
}

/** A min/max domain. */
export interface Domain {
  min: number
  max: number
}

export interface Point {
  x: number
  y: number
}

export interface BarRect {
  x: number
  y: number
  width: number
  height: number
  value: number
}

/** Logical direction used when projecting category positions. */
export type ChartDirection = 'ltr' | 'rtl'

/**
 * Framework-agnostic multi-series input. `colorToken` is a CSS custom-property
 * name (for example `--iris-chart-series-1`), never raw CSS.
 */
export interface ChartSeries {
  id: string
  label: string
  colorToken: string
  values: readonly number[]
}

/** One pie/donut slice. Non-positive and non-finite values are ignored. */
export interface ChartSlice {
  id: string
  label: string
  colorToken: string
  value: number
}

export interface ChartLegendItem {
  id: string
  label: string
  colorToken: string
  /** Safe `var(--token)` expression ready for a renderer's fill/stroke. */
  color: string
}

export interface ChartTooltipItem extends ChartLegendItem {
  value: number
  formattedValue: string
  categoryIndex?: number
  categoryLabel?: string
  seriesId?: string
  seriesLabel?: string
  percentage?: number
}

export interface ChartDataPoint extends Point {
  id: string
  seriesId: string
  seriesLabel: string
  colorToken: string
  color: string
  value: number
  categoryIndex: number
  categoryLabel: string
  tooltip: ChartTooltipItem
}

export interface ProjectedChartSeries extends ChartLegendItem {
  points: ChartDataPoint[]
  /** Gap-aware SVG path: non-finite source values break, rather than join, a line. */
  path: string
}

export interface MultiLineGeometryOptions {
  nice?: boolean
  categories?: readonly string[]
  direction?: ChartDirection
}

export interface MultiLineGeometry {
  box: PlotBox
  domain: Domain
  categoryCount: number
  series: ProjectedChartSeries[]
  legend: ChartLegendItem[]
  tooltips: ChartTooltipItem[]
  description: string
}

export type BarLayout = 'grouped' | 'stacked'

export interface MultiBarGeometryOptions {
  layout?: BarLayout
  nice?: boolean
  categories?: readonly string[]
  direction?: ChartDirection
  /** Fractional space between category groups (0..0.95). */
  categoryGap?: number
  /** Fractional space between grouped series bars (0..0.95). */
  seriesGap?: number
}

export interface ChartBarRect extends BarRect {
  id: string
  seriesId: string
  seriesLabel: string
  colorToken: string
  color: string
  categoryIndex: number
  categoryLabel: string
  startValue: number
  endValue: number
  tooltip: ChartTooltipItem
}

export interface MultiBarGeometry {
  layout: BarLayout
  box: PlotBox
  domain: Domain
  categoryCount: number
  rects: ChartBarRect[]
  legend: ChartLegendItem[]
  tooltips: ChartTooltipItem[]
  description: string
}

export interface PieArcOptions {
  cx: number
  cy: number
  radius: number
  innerRadius?: number
  /** Radians; defaults to -π/2 so the first slice starts at 12 o'clock. */
  startAngle?: number
}

export interface ChartArc extends ChartLegendItem {
  value: number
  percentage: number
  startAngle: number
  endAngle: number
  path: string
  tooltip: ChartTooltipItem
}

export interface DonutGeometryOptions {
  /** 0 produces a pie; values are clamped to 0..0.95. Default 0.6. */
  innerRadiusRatio?: number
  startAngle?: number
}

export interface DonutGeometry {
  cx: number
  cy: number
  radius: number
  innerRadius: number
  total: number
  arcs: ChartArc[]
  legend: ChartLegendItem[]
  tooltips: ChartTooltipItem[]
  description: string
}
