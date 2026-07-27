import { dataDomain, niceDomain, plotBox, scaleY } from './cartesian'
import { categoryLabel, clamp, formattedNumber, round } from './internal'
import { chartColor, chartLegendItems, safeChartColorToken, seriesCategoryCount } from './series'
import type {
  BarLayout,
  ChartBarRect,
  ChartDimensions,
  ChartSeries,
  ChartTooltipItem,
  Domain,
  MultiBarGeometry,
  MultiBarGeometryOptions,
  PlotBox,
} from './model'

function barTooltip(
  item: ChartSeries,
  seriesIndex: number,
  value: number,
  categoryIndex: number,
  categories: readonly string[],
): ChartTooltipItem {
  const colorToken = safeChartColorToken(item.colorToken, seriesIndex)
  return {
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
  }
}

/** Domain for grouped values or signed positive/negative stacked totals. */
export function multiBarDomain(
  series: readonly ChartSeries[],
  layout: BarLayout = 'stacked',
  categories: readonly string[] = [],
): Domain {
  if (layout === 'grouped') {
    return dataDomain([0, ...series.flatMap((item) => item.values.filter(Number.isFinite))])
  }
  const count = seriesCategoryCount(series, categories)
  const totals: number[] = [0]
  for (let categoryIndex = 0; categoryIndex < count; categoryIndex += 1) {
    let positive = 0
    let negative = 0
    for (const item of series) {
      const value = item.values[categoryIndex]
      if (value == null || !Number.isFinite(value)) continue
      if (value >= 0) positive += value
      else negative += value
    }
    totals.push(positive, negative)
  }
  return dataDomain(totals)
}

/** Grouped bar rectangles: one side-by-side bar per finite value. */
export function groupedBarRects(
  series: readonly ChartSeries[],
  domain: Domain,
  box: PlotBox,
  options: Omit<MultiBarGeometryOptions, 'layout' | 'nice'> = {},
): ChartBarRect[] {
  const categories = options.categories ?? []
  const count = seriesCategoryCount(series, categories)
  if (count === 0 || series.length === 0) return []
  const categorySlot = box.width / count
  const categoryWidth = categorySlot * (1 - clamp(options.categoryGap ?? 0.2, 0, 0.95))
  const seriesSlot = categoryWidth / series.length
  const width = seriesSlot * (1 - clamp(options.seriesGap ?? 0.08, 0, 0.95))
  const zero = Math.max(domain.min, Math.min(0, domain.max))
  const zeroY = scaleY(zero, domain, box)
  const rects: ChartBarRect[] = []

  series.forEach((item, seriesIndex) => {
    item.values.forEach((value, categoryIndex) => {
      if (!Number.isFinite(value)) return
      const visualCategory = options.direction === 'rtl' ? count - 1 - categoryIndex : categoryIndex
      const visualSeries =
        options.direction === 'rtl' ? series.length - 1 - seriesIndex : seriesIndex
      const groupX = box.x + visualCategory * categorySlot + (categorySlot - categoryWidth) / 2
      const x = groupX + visualSeries * seriesSlot + (seriesSlot - width) / 2
      const valueY = scaleY(value, domain, box)
      const tooltip = barTooltip(item, seriesIndex, value, categoryIndex, categories)
      rects.push({
        id: tooltip.id,
        seriesId: item.id,
        seriesLabel: item.label || item.id,
        colorToken: tooltip.colorToken,
        color: tooltip.color,
        categoryIndex,
        categoryLabel: tooltip.categoryLabel!,
        x: round(x),
        y: round(Math.min(valueY, zeroY)),
        width: round(width),
        height: round(Math.abs(valueY - zeroY)),
        value,
        startValue: 0,
        endValue: value,
        tooltip,
      })
    })
  })
  return rects
}

/** Stacked bar rectangles with independent positive/negative accumulators. */
export function stackedBarRects(
  series: readonly ChartSeries[],
  domain: Domain,
  box: PlotBox,
  options: Omit<MultiBarGeometryOptions, 'layout' | 'nice' | 'seriesGap'> = {},
): ChartBarRect[] {
  const categories = options.categories ?? []
  const count = seriesCategoryCount(series, categories)
  if (count === 0 || series.length === 0) return []
  const categorySlot = box.width / count
  const width = categorySlot * (1 - clamp(options.categoryGap ?? 0.2, 0, 0.95))
  const positive = Array.from({ length: count }, () => 0)
  const negative = Array.from({ length: count }, () => 0)
  const rects: ChartBarRect[] = []

  series.forEach((item, seriesIndex) => {
    item.values.forEach((value, categoryIndex) => {
      if (!Number.isFinite(value)) return
      const startValue = value >= 0 ? positive[categoryIndex]! : negative[categoryIndex]!
      const endValue = startValue + value
      if (value >= 0) positive[categoryIndex] = endValue
      else negative[categoryIndex] = endValue
      const visualCategory = options.direction === 'rtl' ? count - 1 - categoryIndex : categoryIndex
      const x = box.x + visualCategory * categorySlot + (categorySlot - width) / 2
      const startY = scaleY(startValue, domain, box)
      const endY = scaleY(endValue, domain, box)
      const tooltip = barTooltip(item, seriesIndex, value, categoryIndex, categories)
      rects.push({
        id: tooltip.id,
        seriesId: item.id,
        seriesLabel: item.label || item.id,
        colorToken: tooltip.colorToken,
        color: tooltip.color,
        categoryIndex,
        categoryLabel: tooltip.categoryLabel!,
        x: round(x),
        y: round(Math.min(startY, endY)),
        width: round(width),
        height: round(Math.abs(endY - startY)),
        value,
        startValue,
        endValue,
        tooltip,
      })
    })
  })
  return rects
}

/** Complete grouped/stacked bar geometry over a shared signed domain. */
export function multiBarGeometry(
  series: readonly ChartSeries[],
  dimensions: ChartDimensions,
  options: MultiBarGeometryOptions = {},
): MultiBarGeometry {
  const layout = options.layout ?? 'stacked'
  const categories = options.categories ?? []
  const rawDomain = multiBarDomain(series, layout, categories)
  const domain = options.nice === false ? rawDomain : niceDomain(rawDomain.min, rawDomain.max)
  const box = plotBox(dimensions)
  const rects =
    layout === 'grouped'
      ? groupedBarRects(series, domain, box, options)
      : stackedBarRects(series, domain, box, options)
  const legend = chartLegendItems(series)
  const categoryCount = seriesCategoryCount(series, categories)
  return {
    layout,
    box,
    domain,
    categoryCount,
    rects,
    legend,
    tooltips: rects.map((rect) => rect.tooltip),
    description: `${legend.length} series across ${categoryCount} categories in a ${layout} bar chart.`,
  }
}
