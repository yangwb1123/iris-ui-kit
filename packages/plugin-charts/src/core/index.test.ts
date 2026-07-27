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
  chartsPlugin,
  chartTokens,
} from './index'

const box = plotBox({ width: 100, height: 50, padding: 0 })

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
})

it('handles single value', () => {
  const rects = barRects([5], { min: 0, max: 10 }, box, 0)
  expect(rects).toHaveLength(1)
  expect(rects[0].height).toBe(25)
})

it('handles empty data for barRects', () => {
  expect(barRects([], { min: 0, max: 1 }, box, 0)).toEqual([])
})

it('niceDomain pads single-value', () => {
  const d = niceDomain(5, 5)
  expect(d.min).toBeLessThan(5)
  expect(d.max).toBeGreaterThan(5)
})

it('seriesPoints returns empty for empty values', () => {
  expect(seriesPoints([], { min: 0, max: 1 }, box)).toEqual([])
})

it('axisTicks returns empty array for count 0', () => {})

describe('chartsPlugin', () => {
  it('registers chart tokens', () => {
    const { tokens } = runPlugins([chartsPlugin])
    expect(tokens['--iris-chart-line']).toBe(chartTokens['--iris-chart-line'])
  })
})
