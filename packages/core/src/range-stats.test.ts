import { describe, expect, it } from 'vitest'
import { rangeStats } from './range-stats'
import type { RangeStatsRange } from './range-stats'

interface Row {
  name: string
  age: number
  note: string | null
}

const rows: Row[] = [
  { name: 'Charlie', age: 25, note: 'a' },
  { name: 'Alice', age: 32, note: null },
  { name: 'Bob', age: 28, note: 'b' },
  { name: 'Dana', age: 40, note: null },
]

const columns = [
  { key: 'name', getValue: (r: Row) => r.name },
  { key: 'age', getValue: (r: Row) => r.age },
  { key: 'note', getValue: (r: Row) => r.note },
]

function range(start: RangeStatsRange['start'], end: RangeStatsRange['end']): RangeStatsRange {
  return { start, end }
}

describe('@iris-ui-kit/core rangeStats (batch AJ, iris 独有)', () => {
  it('numeric column: count/sum/avg/min/max over the rectangle', () => {
    // age rows 0..2 → 25 + 32 + 28 = 85, avg 28.333…, min 25, max 32
    const stats = rangeStats(rows, columns, range({ row: 0, col: 1 }, { row: 2, col: 1 }))
    expect(stats.age).toEqual({ count: 3, sum: 85, avg: 85 / 3, min: 25, max: 32 })
  })

  it('non-numeric column: count only, numeric ops null (never 0/NaN)', () => {
    const stats = rangeStats(rows, columns, range({ row: 0, col: 0 }, { row: 2, col: 0 }))
    expect(stats.name).toEqual({ count: 3, sum: null, avg: null, min: null, max: null })
  })

  it('null cells are not counted (aggregate count semantics)', () => {
    // note rows 0..2: 'a', null, 'b' → count 2 (null excluded)
    const stats = rangeStats(rows, columns, range({ row: 0, col: 2 }, { row: 2, col: 2 }))
    expect(stats.note!.count).toBe(2)
    expect(stats.note!.sum).toBeNull()
  })

  it('non-finite / non-numeric raw values are ignored for numeric ops, still counted', () => {
    const mixed = [{ key: 'v', getValue: (r: { v: unknown }) => r.v }]
    const mixedRows = [{ v: 'abc' }, { v: 7 }, { v: Number.NaN }, { v: null }]
    const stats = rangeStats(mixedRows, mixed, range({ row: 0, col: 0 }, { row: 3, col: 0 }))
    // 'abc' and NaN are non-null (counted) but not finite (excluded from ops).
    expect(stats.v).toEqual({ count: 3, sum: 7, avg: 7, min: 7, max: 7 })
  })

  it('column span slices the rectangle (multi-column range)', () => {
    // rows 1..2 × cols 0..1: name {Alice, Bob}, age {32, 28}
    const stats = rangeStats(rows, columns, range({ row: 1, col: 0 }, { row: 2, col: 1 }))
    expect(stats.name!.count).toBe(2)
    expect(stats.age).toEqual({ count: 2, sum: 60, avg: 30, min: 28, max: 32 })
  })

  it('empty range (out of bounds) → {}', () => {
    expect(rangeStats(rows, columns, range({ row: 10, col: 10 }, { row: 11, col: 11 }))).toEqual({})
  })

  it('clamps out-of-bounds rows/cols to what exists', () => {
    const stats = rangeStats(rows, columns, range({ row: -2, col: -1 }, { row: 10, col: 5 }))
    // Clamped to rows 0..3 × cols 0..2 — the full data rectangle.
    expect(stats.age).toEqual({ count: 4, sum: 125, avg: 31.25, min: 25, max: 40 })
    expect(stats.name!.count).toBe(4)
  })

  it('values are read through the column getter (key indirection is adapter-side)', () => {
    // A column whose getter reads a DIFFERENT field than its key — the bridge
    // maps dataIndex ?? key into key before calling, so core sees { key, getValue }.
    const viaGetter = [{ key: 'display', getValue: (r: Row) => r.age * 2 }]
    const stats = rangeStats(rows, viaGetter, range({ row: 0, col: 0 }, { row: 1, col: 0 }))
    expect(stats.display).toEqual({ count: 2, sum: 114, avg: 57, min: 50, max: 64 })
  })

  it('a single-cell range computes one cell', () => {
    const stats = rangeStats(rows, columns, range({ row: 2, col: 1 }, { row: 2, col: 1 }))
    expect(stats.age).toEqual({ count: 1, sum: 28, avg: 28, min: 28, max: 28 })
  })
})
