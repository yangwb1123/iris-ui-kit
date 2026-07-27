import { dataDomain, niceDomain, plotBox, scaleX, scaleY } from './cartesian'
import { categoryLabel, finiteOr, formattedNumber, round } from './internal'
import type {
  ChartDataPoint,
  ChartDimensions,
  ChartDirection,
  ChartLegendItem,
  ChartSeries,
  ChartSlice,
  ChartTooltipItem,
  Domain,
  MultiLineGeometry,
  MultiLineGeometryOptions,
  PlotBox,
  Point,
  ProjectedChartSeries,
} from './model'

const FALLBACK_COLOR_TOKENS = [
  '--iris-chart-series-1',
  '--iris-chart-series-2',
  '--iris-chart-series-3',
  '--iris-chart-series-4',
  '--iris-chart-series-5',
  '--iris-chart-series-6',
] as const

const CSS_CUSTOM_PROPERTY = /^--[A-Za-z_][A-Za-z0-9_-]*$/

/** Return a safe CSS custom property name, falling back to an Iris series token. */
export function safeChartColorToken(colorToken: string, index = 0): string {
  if (CSS_CUSTOM_PROPERTY.test(colorToken)) return colorToken
  const safeIndex = Math.abs(Math.floor(finiteOr(index, 0))) % FALLBACK_COLOR_TOKENS.length
  return FALLBACK_COLOR_TOKENS[safeIndex]!
}

export function chartColor(colorToken: string, index = 0): string {
  return `var(${safeChartColorToken(colorToken, index)})`
}

/** Normalize series identities into renderer-ready legend data. */
export function chartLegendItems(
  items: readonly Pick<ChartSeries | ChartSlice, 'id' | 'label' | 'colorToken'>[],
): ChartLegendItem[] {
  return items.map((item, index) => {
    const colorToken = safeChartColorToken(item.colorToken, index)
    return {
      id: item.id,
      label: item.label || item.id,
      colorToken,
      color: chartColor(colorToken, index),
    }
  })
}

/** Finite, per-point tooltip records shared by line and bar renderers. */
export function seriesTooltipItems(
  series: readonly ChartSeries[],
  categories: readonly string[] = [],
): ChartTooltipItem[] {
  return series.flatMap((item, seriesIndex) => {
    const colorToken = safeChartColorToken(item.colorToken, seriesIndex)
    return item.values.flatMap((value, categoryIndex) => {
      if (!Number.isFinite(value)) return []
      return [
        {
          id: `${item.id}:${categoryIndex}`,
          label: item.label || item.id,
          colorToken,
          color: chartColor(colorToken, seriesIndex),
          value,
          formattedValue: formattedNumber(value),
          categoryIndex,
          categoryLabel: categoryLabel(categories, categoryIndex),
          seriesId: item.id,
          seriesLabel: item.label || item.id,
        },
      ]
    })
  })
}

/** Finite, positive tooltip records with percentages for pie/donut slices. */
export function sliceTooltipItems(slices: readonly ChartSlice[]): ChartTooltipItem[] {
  const valid = slices.filter((slice) => Number.isFinite(slice.value) && slice.value > 0)
  const total = valid.reduce((sum, slice) => sum + slice.value, 0)
  return valid.map((slice, index) => {
    const colorToken = safeChartColorToken(slice.colorToken, index)
    return {
      id: slice.id,
      label: slice.label || slice.id,
      colorToken,
      color: chartColor(colorToken, index),
      value: slice.value,
      formattedValue: formattedNumber(slice.value),
      percentage: total > 0 ? slice.value / total : 0,
    }
  })
}

/** Stable accessible/native-tooltip copy assembled from pure tooltip data. */
export function chartTooltipLabel(item: ChartTooltipItem): string {
  const owner = item.seriesLabel ?? item.label
  const category = item.categoryLabel ? `, ${item.categoryLabel}` : ''
  const percentage =
    item.percentage == null ? '' : ` (${round(Math.max(0, item.percentage) * 100)}%)`
  return `${owner}${category}: ${item.formattedValue}${percentage}`
}

/** Maximum category count across category labels and every series. */
export function seriesCategoryCount(
  series: readonly ChartSeries[],
  categories: readonly string[] = [],
): number {
  return Math.max(categories.length, 0, ...series.map((item) => item.values.length))
}

/** One shared finite Y domain for every series. */
export function multiSeriesDomain(series: readonly ChartSeries[]): Domain {
  return dataDomain(series.flatMap((item) => item.values.filter(Number.isFinite)))
}

/** Project a category index, optionally mirrored for RTL reading order. */
export function scaleCategory(
  index: number,
  count: number,
  box: PlotBox,
  direction: ChartDirection = 'ltr',
): number {
  const visualIndex = direction === 'rtl' ? Math.max(0, count - 1 - index) : index
  return scaleX(visualIndex, count, box)
}

interface ProjectionContext {
  count: number
  domain: Domain
  box: PlotBox
  categories: readonly string[]
  direction: ChartDirection
}

function projectSeries(
  item: ChartSeries,
  seriesIndex: number,
  context: ProjectionContext,
): ProjectedChartSeries {
  const colorToken = safeChartColorToken(item.colorToken, seriesIndex)
  const color = chartColor(colorToken, seriesIndex)
  const points: ChartDataPoint[] = []
  const commands: string[] = []
  let startsSegment = true

  item.values.forEach((value, categoryIndex) => {
    if (!Number.isFinite(value)) {
      startsSegment = true
      return
    }
    const point: Point = {
      x: scaleCategory(categoryIndex, context.count, context.box, context.direction),
      y: scaleY(value, context.domain, context.box),
    }
    const tooltip: ChartTooltipItem = {
      id: `${item.id}:${categoryIndex}`,
      label: item.label || item.id,
      colorToken,
      color,
      value,
      formattedValue: formattedNumber(value),
      categoryIndex,
      categoryLabel: categoryLabel(context.categories, categoryIndex),
      seriesId: item.id,
      seriesLabel: item.label || item.id,
    }
    points.push({
      ...point,
      id: tooltip.id,
      seriesId: item.id,
      seriesLabel: item.label || item.id,
      colorToken,
      color,
      value,
      categoryIndex,
      categoryLabel: tooltip.categoryLabel!,
      tooltip,
    })
    commands.push(`${startsSegment ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    startsSegment = false
  })

  return {
    id: item.id,
    label: item.label || item.id,
    colorToken,
    color,
    points,
    path: commands.join(' '),
  }
}

/** Project every finite point against one shared domain/category grid. */
export function projectMultiSeries(
  series: readonly ChartSeries[],
  domain: Domain,
  box: PlotBox,
  categories: readonly string[] = [],
  direction: ChartDirection = 'ltr',
): ProjectedChartSeries[] {
  const context: ProjectionContext = {
    count: seriesCategoryCount(series, categories),
    domain,
    box,
    categories,
    direction,
  }
  return series.map((item, index) => projectSeries(item, index, context))
}

/** Complete renderer-neutral model for an accessible multi-series line chart. */
export function multiLineGeometry(
  series: readonly ChartSeries[],
  dimensions: ChartDimensions,
  options: MultiLineGeometryOptions = {},
): MultiLineGeometry {
  const categories = options.categories ?? []
  const box = plotBox(dimensions)
  const rawDomain = multiSeriesDomain(series)
  const domain = options.nice === false ? rawDomain : niceDomain(rawDomain.min, rawDomain.max)
  const categoryCount = seriesCategoryCount(series, categories)
  const projected = projectMultiSeries(series, domain, box, categories, options.direction)
  const legend = chartLegendItems(series)
  return {
    box,
    domain,
    categoryCount,
    series: projected,
    legend,
    tooltips: projected.flatMap((item) => item.points.map((point) => point.tooltip)),
    description: `${legend.length} series across ${categoryCount} categories.`,
  }
}
