import { describe, it, expect } from 'vitest'
import {
  compareValues,
  cycleSort,
  filterSort,
  paginate,
  pageCount,
  getPageRange,
  type DataViewColumn,
} from './data-view'

interface Row {
  name: string
  age: number
}
const cols: DataViewColumn<Row>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'age', getValue: (r) => r.age },
]
const rows: Row[] = [
  { name: 'Charlie', age: 30 },
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 35 },
]

describe('compareValues', () => {
  it('compares numbers numerically and strings by locale, nulls first', () => {
    expect(compareValues(1, 2)).toBeLessThan(0)
    expect(compareValues('b', 'a')).toBeGreaterThan(0)
    expect(compareValues(null, 1)).toBeLessThan(0)
    expect(compareValues(null, null)).toBe(0)
  })
})

describe('cycleSort', () => {
  it('cycles none → asc → desc → none', () => {
    expect(cycleSort(null, 'age')).toEqual({ key: 'age', direction: 'asc' })
    expect(cycleSort({ key: 'age', direction: 'asc' }, 'age')).toEqual({
      key: 'age',
      direction: 'desc',
    })
    expect(cycleSort({ key: 'age', direction: 'desc' }, 'age')).toBeNull()
    expect(cycleSort({ key: 'age', direction: 'desc' }, 'name')).toEqual({
      key: 'name',
      direction: 'asc',
    })
  })
})

describe('filterSort', () => {
  it('filters by case-insensitive substring', () => {
    const out = filterSort(rows, cols, { filters: { name: 'b' }, sort: null })
    expect(out.map((r) => r.name).sort()).toEqual(['Bob'])
  })
  it('sorts asc/desc using the column accessor', () => {
    expect(
      filterSort(rows, cols, { filters: {}, sort: { key: 'age', direction: 'asc' } }).map(
        (r) => r.age,
      ),
    ).toEqual([25, 30, 35])
    expect(
      filterSort(rows, cols, { filters: {}, sort: { key: 'age', direction: 'desc' } }).map(
        (r) => r.age,
      ),
    ).toEqual([35, 30, 25])
  })
  it('returns a copy, never the original array', () => {
    const out = filterSort(rows, cols, { filters: {}, sort: null })
    expect(out).not.toBe(rows)
    expect(out).toHaveLength(3)
  })
})

describe('paginate / pageCount', () => {
  it('slices pages', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4])
    expect(pageCount(5, 2)).toBe(3)
    expect(pageCount(0, 10)).toBe(1)
  })
})

describe('getPageRange', () => {
  it('returns all pages when small', () => {
    expect(getPageRange(1, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('inserts ellipsis around the current page in a large set', () => {
    const r = getPageRange(10, 20)
    expect(r[0]).toBe(1)
    expect(r[r.length - 1]).toBe(20)
    expect(r).toContain('ellipsis')
    expect(r).toContain(10)
  })
  it('no left ellipsis near the start', () => {
    const r = getPageRange(2, 20)
    expect(r.slice(0, 3)).toEqual([1, 2, 3])
  })
})
