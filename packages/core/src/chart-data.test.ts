import { describe, expect, it } from 'vitest'
import { buildChartData, chartDomain } from './chart-data'

interface Row extends Record<string, unknown> {
  id: number
  v: number | string | null | undefined
}

const rows: Row[] = [
  { id: 1, v: 3 },
  { id: 2, v: 7 },
  { id: 3, v: 5 },
  { id: 4, v: 9 },
  { id: 5, v: 1 },
]

describe('@iris-ui-kit/core buildChartData (batch AR, iris 独有)', () => {
  it('builds points in source order with the finite min/max domain', () => {
    const data = buildChartData(rows, 'v')
    expect(data.points).toEqual([3, 7, 5, 9, 1])
    expect(data.min).toBe(1)
    expect(data.max).toBe(9)
  })

  it('empty rows → empty points and the {0,1} fallback domain', () => {
    const data = buildChartData<Row>([], 'v')
    expect(data.points).toEqual([])
    expect(data.min).toBe(0)
    expect(data.max).toBe(1)
  })

  it('null / undefined values become gaps (null points), excluded from the domain', () => {
    const data = buildChartData<Row>(
      [
        { id: 1, v: 4 },
        { id: 2, v: null },
        { id: 3, v: undefined },
        { id: 4, v: 6 },
      ],
      'v',
    )
    expect(data.points).toEqual([4, null, null, 6])
    expect(data.min).toBe(4)
    expect(data.max).toBe(6)
  })

  it('all-null rows → all-gap points and the {0,1} fallback domain', () => {
    const data = buildChartData<Row>(
      [
        { id: 1, v: null },
        { id: 2, v: undefined },
      ],
      'v',
    )
    expect(data.points).toEqual([null, null])
    expect(data.min).toBe(0)
    expect(data.max).toBe(1)
  })

  it('non-finite values (NaN / Infinity) are dropped → gaps, excluded from the domain', () => {
    const data = buildChartData<Row>(
      [
        { id: 1, v: Number.NaN },
        { id: 2, v: 2 },
        { id: 3, v: Number.POSITIVE_INFINITY },
        { id: 4, v: -3 },
      ],
      'v',
    )
    expect(data.points).toEqual([null, 2, null, -3])
    expect(data.min).toBe(-3)
    expect(data.max).toBe(2)
  })

  it('negative values chart below zero — the domain spans the negatives', () => {
    const data = buildChartData<Row>(
      [
        { id: 1, v: -10 },
        { id: 2, v: -4 },
        { id: 3, v: -8 },
      ],
      'v',
    )
    expect(data.points).toEqual([-10, -4, -8])
    expect(data.min).toBe(-10)
    expect(data.max).toBe(-4)
  })

  it('a single value is padded so min < max (never a zero span)', () => {
    const data = buildChartData<Row>([{ id: 1, v: 5 }], 'v')
    expect(data.points).toEqual([5])
    expect(data.min).toBeLessThan(data.max)
    expect(data.min).toBe(5 - (Math.abs(5) || 1))
    expect(data.max).toBe(5 + (Math.abs(5) || 1))
  })

  it('a flat series is padded by |value| (zero flat pads by 1)', () => {
    const flat = buildChartData<Row>(
      [
        { id: 1, v: 7 },
        { id: 2, v: 7 },
        { id: 3, v: 7 },
      ],
      'v',
    )
    expect(flat.points).toEqual([7, 7, 7])
    expect(flat.min).toBe(0)
    expect(flat.max).toBe(14)
    const zeroFlat = buildChartData<Row>(
      [
        { id: 1, v: 0 },
        { id: 2, v: 0 },
      ],
      'v',
    )
    expect(zeroFlat.min).toBe(-1)
    expect(zeroFlat.max).toBe(1)
  })

  it('numeric strings chart as numbers (Number coercion)', () => {
    const data = buildChartData<Row>(
      [
        { id: 1, v: '3' },
        { id: 2, v: '9' },
      ],
      'v',
    )
    expect(data.points).toEqual([3, 9])
    expect(data.min).toBe(3)
    expect(data.max).toBe(9)
  })

  it('scaling bounds: (v − min)/(max − min) stays within [0, 1] for all finite points', () => {
    const data = buildChartData(rows, 'v')
    const span = data.max - data.min
    expect(span).toBeGreaterThan(0)
    for (const p of data.points) {
      if (p === null) continue
      const t = (p - data.min) / span
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1)
    }
  })
})

describe('@iris-ui-kit/core chartDomain (batch BI, iris 独有)', () => {
  it('spans the finite values of a mixed series (gaps excluded)', () => {
    expect(chartDomain([3, null, 7, null, 5])).toEqual({ min: 3, max: 7 })
  })

  it('empty series → the {0,1} fallback domain', () => {
    expect(chartDomain([])).toEqual({ min: 0, max: 1 })
  })

  it('all-gap series → the {0,1} fallback domain', () => {
    expect(chartDomain([null, null])).toEqual({ min: 0, max: 1 })
  })

  it('a single value is padded so min < max (never a zero span)', () => {
    const d = chartDomain([5])
    expect(d.min).toBe(5 - (Math.abs(5) || 1))
    expect(d.max).toBe(5 + (Math.abs(5) || 1))
  })

  it('a flat series is padded by |value| (zero flat pads by 1)', () => {
    expect(chartDomain([7, 7, 7])).toEqual({ min: 0, max: 14 })
    expect(chartDomain([0, 0])).toEqual({ min: -1, max: 1 })
    expect(chartDomain([-4, -4])).toEqual({ min: -8, max: 0 })
  })

  it('NaN/Infinity never poison the domain (finite-only)', () => {
    expect(chartDomain([Number.NaN, 5])).toEqual({ min: 0, max: 10 })
    expect(chartDomain([Infinity, -3, -3])).toEqual({ min: -6, max: 0 })
    expect(chartDomain([Number.NaN, Number.POSITIVE_INFINITY])).toEqual({ min: 0, max: 1 })
  })
})
