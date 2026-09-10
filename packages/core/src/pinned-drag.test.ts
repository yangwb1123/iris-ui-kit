import { describe, expect, it } from 'vitest'
import {
  firstRightPinnedIndex,
  leftPinnedCount,
  computePinnedCountPlan,
  pinnedBoundaryIndex,
  pinnedCountFromBudget,
  pinnedCountFromDelta,
} from './pinned-drag'

type Column = { key: string; pinned?: 'left' | 'right' }

describe('@iris-ui-kit/core pinned drag math', () => {
  it('finds the right block and its left boundary through the resolver', () => {
    const columns: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'b' },
      { key: 'c', pinned: 'left' },
      { key: 'd', pinned: 'right' },
      { key: 'e' },
    ]
    const pinOf = (column: Column): 'left' | 'right' | null => column.pinned ?? null
    const cap = firstRightPinnedIndex(columns, pinOf)
    expect(cap).toBe(3)
    expect(pinnedBoundaryIndex(columns, pinOf, cap)).toBe(2)
    expect(pinnedBoundaryIndex(columns, pinOf, 2)).toBe(0)
    expect(pinnedBoundaryIndex(columns, pinOf, 1)).toBe(0)
    expect(pinnedBoundaryIndex(columns, pinOf, 0)).toBe(-1)
  })

  it('counts a consecutive static left-pinned prefix', () => {
    const columns: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'b', pinned: 'left' },
      { key: 'c' },
    ]
    expect(leftPinnedCount(columns, columns.length)).toBe(2)
  })

  it('uses the effective resolver for controlled pin maps', () => {
    const columns: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'b', pinned: 'left' },
      { key: 'c' },
    ]
    const pinOf = (column: Column): 'left' | 'right' | null =>
      column.key === 'a' ? null : column.key === 'b' ? 'left' : null
    expect(leftPinnedCount(columns, columns.length, pinOf)).toBe(0)
  })

  it('returns the widest prefix within the drag budget', () => {
    const columns: Column[] = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
    const widths = { a: 80, b: 120, c: 100 }
    expect(
      pinnedCountFromBudget(columns, (column) => widths[column.key as keyof typeof widths], 200, 3),
    ).toBe(2)
    expect(
      pinnedCountFromBudget(columns, (column) => widths[column.key as keyof typeof widths], 70, 3),
    ).toBe(0)
  })

  it('starts delta resolution at the consecutive prefix in a gapped pin state', () => {
    const columns: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'b' },
      { key: 'c', pinned: 'left' },
      { key: 'd', pinned: 'right' },
    ]
    const pinOf = (column: Column): 'left' | 'right' | null => column.pinned ?? null
    const widthOf = (column: Column): number => ({ a: 80, b: 120, c: 100, d: 90 })[column.key]!
    expect(pinnedCountFromDelta(columns, widthOf, 0, 3, pinOf)).toBe(1)
    expect(pinnedCountFromDelta(columns, widthOf, Number.NaN, 3, pinOf)).toBe(1)
    expect(pinnedCountFromDelta(columns, widthOf, 120, 3, pinOf)).toBe(2)
    expect(pinnedCountFromDelta(columns, widthOf, -80, 3, pinOf)).toBe(0)
    expect(pinnedCountFromDelta(columns, widthOf, 10_000, 3, pinOf)).toBe(3)
  })

  it('returns only effective pin changes and clamps the requested count', () => {
    const columns: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'b' },
      { key: 'c', pinned: 'left' },
      { key: 'd', pinned: 'right' },
    ]
    const pinOf = (column: Column): 'left' | 'right' | null => column.pinned ?? null
    const plan = computePinnedCountPlan(columns, pinOf, 99, 3)
    expect(plan).toMatchObject({ cap: 3, current: 1, count: 3 })
    expect(plan.updates.map(({ index, pinned }) => [index, pinned])).toEqual([[1, 'left']])
    expect(
      computePinnedCountPlan(columns, pinOf, 2, 3).updates.map(({ index, pinned }) => [
        index,
        pinned,
      ]),
    ).toEqual([
      [1, 'left'],
      [2, null],
    ])
    expect(computePinnedCountPlan(columns, pinOf, 1, 3).updates).toEqual([])
    expect(computePinnedCountPlan(columns, pinOf, Number.NaN, 3).count).toBe(1)
    expect(plan.updates[0]?.column).toBe(columns[1])
  })

  it('normalizes malformed caps and keeps plans on whole column counts', () => {
    const columns: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'b', pinned: 'left' },
      { key: 'c' },
    ]
    const pinOf = (column: Column): 'left' | 'right' | null => column.pinned ?? null
    const widthOf = (): number => 100

    expect(leftPinnedCount(columns, -1)).toBe(0)
    expect(leftPinnedCount(columns, Number.NaN)).toBe(0)
    expect(pinnedBoundaryIndex(columns, pinOf, Number.NaN)).toBe(-1)
    expect(pinnedBoundaryIndex(columns, pinOf, Number.POSITIVE_INFINITY)).toBe(1)
    expect(pinnedCountFromBudget(columns, widthOf, 300, -1)).toBe(0)
    expect(pinnedCountFromBudget(columns, widthOf, 300, Number.NaN)).toBe(0)
    expect(pinnedCountFromBudget(columns, widthOf, 300, Number.POSITIVE_INFINITY)).toBe(3)

    const plan = computePinnedCountPlan(columns, pinOf, 2.9, 2.9)
    expect(plan).toMatchObject({ cap: 2, current: 2, count: 2 })
    expect(plan.updates).toEqual([])
    expect(computePinnedCountPlan(columns, pinOf, 99, Number.NaN)).toMatchObject({
      cap: 0,
      current: 0,
      count: 0,
    })
    expect(computePinnedCountPlan(columns, pinOf, -2, 3).count).toBe(0)
  })

  it('keeps gapped zero-delta and malformed-width resolutions fail-closed', () => {
    const columns: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'b' },
      { key: 'c', pinned: 'left' },
    ]
    const pinOf = (column: Column): 'left' | 'right' | null => column.pinned ?? null
    const zeroGapWidth = (column: Column): number =>
      ({ a: 80, b: 0, c: 100 })[column.key] ?? Number.NaN
    expect(pinnedCountFromDelta(columns, zeroGapWidth, 0, 3, pinOf)).toBe(1)

    const invalidCurrentWidth = (column: Column): number => (column.key === 'a' ? Number.NaN : 100)
    expect(pinnedCountFromDelta(columns, invalidCurrentWidth, 0, 3, pinOf)).toBe(1)
    expect(pinnedCountFromDelta(columns, invalidCurrentWidth, 100, 3, pinOf)).toBe(1)

    const invalidGapWidth = (column: Column): number =>
      ({ a: 80, b: -1, c: 100 })[column.key] ?? 100
    expect(pinnedCountFromDelta(columns, invalidGapWidth, 100, 3, pinOf)).toBe(1)
    expect(pinnedCountFromBudget(columns, invalidGapWidth, 100, 3)).toBe(1)
  })

  it('does not address sparse columns or emit a partial plan', () => {
    const source: Column[] = [
      { key: 'a', pinned: 'left' },
      { key: 'c', pinned: 'left' },
    ]
    const sparse = [source[0], undefined, source[1]] as unknown as Column[]
    const pinOf = (column: Column): 'left' | 'right' | null => column.pinned ?? null
    const widthOf = (): number => 100

    expect(leftPinnedCount(sparse, 3, pinOf)).toBe(1)
    expect(pinnedBoundaryIndex(sparse, pinOf, 3)).toBe(2)
    expect(pinnedCountFromBudget(sparse, widthOf, 300, 3)).toBe(1)
    expect(pinnedCountFromDelta(sparse, widthOf, 100, 3, pinOf)).toBe(1)

    const plan = computePinnedCountPlan(sparse, pinOf, 2, 3)
    expect(plan).toMatchObject({ cap: 3, current: 1, count: 1 })
    expect(plan.updates).toEqual([])
  })
})
