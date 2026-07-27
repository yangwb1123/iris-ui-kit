import { describe, it, expect } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import {
  plotBox,
  dataDomain,
  niceDomain,
  axisTicks,
  scaleX,
  scaleY,
  seriesPoints,
  linePath,
  areaPath,
  barRects,
  safeChartColorToken,
  chartColor,
  chartLegendItems,
  seriesTooltipItems,
  chartTooltipLabel,
  multiSeriesDomain,
  projectMultiSeries,
  multiLineGeometry,
  multiBarDomain,
  groupedBarRects,
  stackedBarRects,
  multiBarGeometry,
  arcPath,
  pieArcs,
  donutGeometry,
  chartsPlugin,
  chartTokens,
  type ChartSeries,
  type ChartSlice,
} from './index'

const box = plotBox({ width: 100, height: 50, padding: 0 })
const series: ChartSeries[] = [
  {
    id: 'revenue',
    label: 'Revenue',
    colorToken: '--iris-chart-series-1',
    values: [10, Number.NaN, 30],
  },
  {
    id: 'cost',
    label: 'Cost',
    colorToken: '--iris-chart-series-2',
    values: [5, 20, Number.POSITIVE_INFINITY],
  },
]
const categories = ['Jan', 'Feb', 'Mar']
const slices: ChartSlice[] = [
  { id: 'direct', label: 'Direct', colorToken: '--iris-chart-series-1', value: 60 },
  { id: 'search', label: 'Search', colorToken: '--iris-chart-series-2', value: 40 },
]

describe('plotBox', () => {
  it('subtracts uniform + per-side padding', () => {
    expect(plotBox({ width: 100, height: 50, padding: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 80,
      height: 30,
    })
    expect(
      plotBox({ width: 100, height: 50, padding: { top: 5, right: 0, bottom: 5, left: 20 } }),
    ).toEqual({
      x: 20,
      y: 5,
      width: 80,
      height: 40,
    })
  })
  it('clamps negative inner size to 0', () => {
    expect(plotBox({ width: 10, height: 10, padding: 20 }).width).toBe(0)
  })
})

describe('dataDomain', () => {
  it('returns min/max', () => {
    expect(dataDomain([3, 1, 4, 1, 5])).toEqual({ min: 1, max: 5 })
  })
  it('pads a flat series so it does not collapse', () => {
    const d = dataDomain([7, 7, 7])
    expect(d.min).toBeLessThan(7)
    expect(d.max).toBeGreaterThan(7)
  })
  it('handles empty input', () => {
    expect(dataDomain([])).toEqual({ min: 0, max: 1 })
  })
  it('ignores non-finite values and safely falls back when none remain', () => {
    expect(dataDomain([Number.NaN, 2, Number.POSITIVE_INFINITY, -3])).toEqual({
      min: -3,
      max: 2,
    })
    expect(dataDomain([Number.NaN, Number.NEGATIVE_INFINITY])).toEqual({ min: 0, max: 1 })
  })
})

describe('niceDomain', () => {
  it('rounds to human-friendly bounds covering the data', () => {
    const d = niceDomain(2, 97)
    expect(d.min).toBeLessThanOrEqual(2)
    expect(d.max).toBeGreaterThanOrEqual(97)
    expect(d.min % 1).toBe(0)
  })
})

describe('axisTicks', () => {
  it('returns evenly spaced ticks including both ends', () => {
    expect(axisTicks({ min: 0, max: 100 }, 5)).toEqual([0, 25, 50, 75, 100])
  })
  it('preserves the two-endpoint fallback for counts below two', () => {
    expect(axisTicks({ min: 0, max: 100 }, 1)).toEqual([0, 100])
  })
})

describe('scaleX / scaleY', () => {
  it('maps index across the width', () => {
    expect(scaleX(0, 5, box)).toBe(0)
    expect(scaleX(4, 5, box)).toBe(100)
    expect(scaleX(2, 5, box)).toBe(50)
  })
  it('centers a single point', () => {
    expect(scaleX(0, 1, box)).toBe(50)
  })
  it('inverts Y (0 at bottom, max at top)', () => {
    const domain = { min: 0, max: 10 }
    expect(scaleY(0, domain, box)).toBe(50) // bottom
    expect(scaleY(10, domain, box)).toBe(0) // top
    expect(scaleY(5, domain, box)).toBe(25)
  })
})

describe('linePath / areaPath', () => {
  it('linePath emits M then L commands', () => {
    const pts = seriesPoints([0, 10], { min: 0, max: 10 }, box)
    expect(linePath(pts)).toBe('M0 50 L100 0')
  })
  it('areaPath closes back to the baseline', () => {
    const pts = seriesPoints([0, 10], { min: 0, max: 10 }, box)
    const d = areaPath(pts, box)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).toContain('L100 50') // down to baseline
  })
  it('empty series → empty path', () => {
    expect(linePath([])).toBe('')
    expect(areaPath([], box)).toBe('')
  })
})

describe('barRects', () => {
  it('lays out one rect per value with gap spacing', () => {
    const rects = barRects([0, 10], { min: 0, max: 10 }, box, 0)
    expect(rects).toHaveLength(2)
    expect(rects[1].height).toBe(50) // full height for the max value
    expect(rects[0].height).toBe(0) // zero value
  })
  it('draws negative values downward from the zero line', () => {
    const rects = barRects([-5, 5], { min: -5, max: 5 }, box, 0)
    // both bars have positive height; the negative one sits below the zero line
    expect(rects[0].height).toBeGreaterThan(0)
    expect(rects[0].y).toBeGreaterThanOrEqual(rects[1].y)
  })
  it('omits non-finite bars without producing unsafe SVG numbers', () => {
    const rects = barRects([1, Number.NaN, 2], { min: 0, max: 2 }, box)
    expect(rects).toHaveLength(2)
    expect(JSON.stringify(rects)).not.toContain('NaN')
  })
})

describe('multi-series model + projection', () => {
  it('normalizes safe token references for legend and tooltip data', () => {
    expect(safeChartColorToken('--brand-series')).toBe('--brand-series')
    expect(safeChartColorToken('red;stroke:black', 1)).toBe('--iris-chart-series-2')
    expect(chartColor('url(javascript:bad)', 2)).toBe('var(--iris-chart-series-3)')

    const legend = chartLegendItems(series)
    expect(legend.map((item) => item.label)).toEqual(['Revenue', 'Cost'])
    expect(legend[0]?.color).toBe('var(--iris-chart-series-1)')

    const tooltips = seriesTooltipItems(series, categories)
    expect(tooltips).toHaveLength(4)
    expect(tooltips[1]).toMatchObject({
      seriesId: 'revenue',
      categoryIndex: 2,
      categoryLabel: 'Mar',
      value: 30,
    })
    expect(chartTooltipLabel(tooltips[0]!)).toBe('Revenue, Jan: 10')
  })

  it('uses one finite domain and leaves path gaps at invalid values', () => {
    expect(multiSeriesDomain(series)).toEqual({ min: 5, max: 30 })
    const projected = projectMultiSeries(series, { min: 0, max: 30 }, box, categories)
    expect(projected[0]?.points).toHaveLength(2)
    expect(projected[0]?.path.match(/M/g)).toHaveLength(2)
    expect(projected[1]?.path).not.toContain('Infinity')
    expect(projected[1]?.path).not.toContain('NaN')
  })

  it('mirrors category projection for RTL without changing data order', () => {
    const ltr = projectMultiSeries(series, { min: 0, max: 30 }, box, categories, 'ltr')
    const rtl = projectMultiSeries(series, { min: 0, max: 30 }, box, categories, 'rtl')
    expect(ltr[0]?.points[0]?.categoryLabel).toBe('Jan')
    expect(rtl[0]?.points[0]?.categoryLabel).toBe('Jan')
    expect(ltr[0]?.points[0]?.x).toBe(0)
    expect(rtl[0]?.points[0]?.x).toBe(100)
  })

  it('returns a complete empty-safe renderer model', () => {
    const geometry = multiLineGeometry([], { width: Number.NaN, height: -1 })
    expect(geometry.domain).toEqual({ min: 0, max: 1 })
    expect(geometry.box.width).toBe(0)
    expect(geometry.series).toEqual([])
    expect(geometry.description).toBe('0 series across 0 categories.')
  })
})

describe('grouped + stacked bar geometry', () => {
  const bars: ChartSeries[] = [
    {
      id: 'a',
      label: 'A',
      colorToken: '--iris-chart-series-1',
      values: [3, -2],
    },
    {
      id: 'b',
      label: 'B',
      colorToken: '--iris-chart-series-2',
      values: [4, -5],
    },
  ]

  it('computes grouped and signed stacked domains', () => {
    expect(multiBarDomain(bars, 'grouped')).toEqual({ min: -5, max: 4 })
    expect(multiBarDomain(bars, 'stacked')).toEqual({ min: -7, max: 7 })
  })

  it('places grouped bars side-by-side within each category', () => {
    const rects = groupedBarRects(bars, { min: -7, max: 7 }, box, {
      categories: ['One', 'Two'],
      categoryGap: 0,
      seriesGap: 0,
    })
    expect(rects).toHaveLength(4)
    const firstCategory = rects.filter((rect) => rect.categoryIndex === 0)
    expect(firstCategory[0]?.x).not.toBe(firstCategory[1]?.x)
    expect(firstCategory.every((rect) => rect.width === 25)).toBe(true)
  })

  it('stacks positive and negative values from independent zero accumulators', () => {
    const rects = stackedBarRects(bars, { min: -7, max: 7 }, box, {
      categories: ['One', 'Two'],
      categoryGap: 0,
    })
    const positive = rects.filter((rect) => rect.categoryIndex === 0)
    const negative = rects.filter((rect) => rect.categoryIndex === 1)
    expect(positive.map((rect) => [rect.startValue, rect.endValue])).toEqual([
      [0, 3],
      [3, 7],
    ])
    expect(negative.map((rect) => [rect.startValue, rect.endValue])).toEqual([
      [0, -2],
      [-2, -7],
    ])
  })

  it('builds grouped/stacked models and drops unsafe values', () => {
    const geometry = multiBarGeometry(
      [
        ...bars,
        {
          id: 'bad',
          label: 'Bad',
          colorToken: 'not-a-token',
          values: [Number.NaN, Number.POSITIVE_INFINITY],
        },
      ],
      { width: 100, height: 50, padding: 0 },
      { layout: 'grouped', nice: false },
    )
    expect(geometry.layout).toBe('grouped')
    expect(geometry.rects).toHaveLength(4)
    expect(JSON.stringify(geometry.rects)).not.toMatch(/NaN|Infinity/)
  })
})

describe('pie + donut geometry', () => {
  it('creates pie and annular paths, including a safe full circle', () => {
    const pie = pieArcs(
      [{ id: 'all', label: 'All', colorToken: '--iris-chart-series-1', value: 1 }],
      { cx: 50, cy: 50, radius: 40 },
    )
    expect(pie).toHaveLength(1)
    expect(pie[0]?.path).toMatch(/^M/)
    expect(pie[0]?.path).toMatch(/Z$/)
    expect(pie[0]?.path).not.toMatch(/NaN|Infinity/)

    const donut = arcPath(50, 50, 40, 20, 0, Math.PI)
    expect(donut).toContain('A40 40')
    expect(donut).toContain('A20 20')
  })

  it('computes percentages and ignores empty/non-positive/non-finite slices', () => {
    const geometry = donutGeometry(
      [
        ...slices,
        { id: 'zero', label: 'Zero', colorToken: '--iris-chart-series-3', value: 0 },
        { id: 'bad', label: 'Bad', colorToken: '--iris-chart-series-4', value: Number.NaN },
        { id: 'negative', label: 'Negative', colorToken: '--iris-chart-series-5', value: -5 },
      ],
      { width: 120, height: 100, padding: 10 },
    )
    expect(geometry.total).toBe(100)
    expect(geometry.arcs).toHaveLength(2)
    expect(geometry.arcs.map((arc) => arc.percentage)).toEqual([0.6, 0.4])
    expect(chartTooltipLabel(geometry.arcs[0]!.tooltip)).toBe('Direct: 60 (60%)')
    expect(geometry.radius).toBe(40)
    expect(geometry.innerRadius).toBe(24)
  })

  it('returns no arcs or invalid paths for empty/unsafe geometry', () => {
    expect(donutGeometry([], { width: 100, height: 100 }).arcs).toEqual([])
    expect(
      pieArcs([{ id: 'bad', label: 'Bad', colorToken: '--iris-chart-series-1', value: Infinity }], {
        cx: 0,
        cy: 0,
        radius: 10,
      }),
    ).toEqual([])
    expect(arcPath(Number.NaN, 0, 10, 5, 0, Math.PI)).toBe('')
  })
})

describe('chartsPlugin', () => {
  it('registers chart tokens', () => {
    const { tokens } = runPlugins([chartsPlugin])
    expect(tokens['--iris-chart-line']).toBe(chartTokens['--iris-chart-line'])
    expect(tokens['--iris-chart-series-6']).toBe('var(--iris-info)')
  })
})
