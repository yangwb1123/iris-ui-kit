import { describe, expect, it, vi } from 'vitest'
import { computeGridSpanPlan, resolveGridSpan } from './grid-span'

describe('@iris-ui-kit/core grid cell spans', () => {
  it('resolves one span and marks covered cells in the same pass', () => {
    const occupied = new Set<string>()
    const method = vi.fn(() => ({ rowspan: 2, colspan: 3 }))

    expect(resolveGridSpan(occupied, 1, 2, method)).toEqual({ rowspan: 2, colspan: 3 })
    expect(resolveGridSpan(occupied, 1, 3, method)).toBeNull()
    expect(method).toHaveBeenCalledTimes(1)
    expect(occupied).toEqual(new Set(['2:2', '1:3', '1:4']))
  })

  it('keeps null/undefined span results as a one-cell placement', () => {
    const occupied = new Set<string>()
    expect(resolveGridSpan(occupied, 0, 0, () => null)).toEqual({ rowspan: 1, colspan: 1 })
    expect(resolveGridSpan(occupied, 0, 1, () => undefined)).toEqual({ rowspan: 1, colspan: 1 })
    expect(occupied.size).toBe(0)
  })

  it('fails closed for non-finite or non-spanning dimensions', () => {
    const occupied = new Set<string>()
    expect(
      resolveGridSpan(occupied, 0, 0, () => ({
        rowspan: Number.POSITIVE_INFINITY,
        colspan: Number.NaN,
      })),
    ).toEqual({ rowspan: 1, colspan: 1 })
    expect(occupied.size).toBe(0)
  })

  it('normalizes fractional spans to CSS-grid integers', () => {
    const occupied = new Set<string>()
    expect(resolveGridSpan(occupied, 0, 0, () => ({ rowspan: 2.9, colspan: 3.9 }))).toEqual({
      rowspan: 2,
      colspan: 3,
    })
    expect(occupied).toEqual(new Set(['1:0', '0:1', '0:2']))
  })

  it('builds a row-major plan without invoking the callback for covered cells', () => {
    const calls: string[] = []
    const plan = computeGridSpanPlan(2, 3, ({ rowIndex, columnIndex }) => {
      calls.push(`${rowIndex}:${columnIndex}`)
      return rowIndex === 0 && columnIndex === 0 ? { rowspan: 2, colspan: 2 } : undefined
    })

    expect(calls).toEqual(['0:0', '0:2', '1:1', '1:2'])
    expect(plan.spans.get('0:0')).toEqual({ rowspan: 2, colspan: 2 })
    expect(plan.occupied).toEqual(new Set(['1:0', '0:1']))
  })
})
