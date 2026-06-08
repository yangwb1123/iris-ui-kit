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

  it('applies typed filterRules (operators) in addition to substring filters', () => {
    expect(
      filterSort(rows, cols, {
        filters: {},
        sort: null,
        filterRules: [{ key: 'age', operator: 'gte', value: 30 }],
      })
        .map((r) => r.age)
        .sort((a, b) => a - b),
    ).toEqual([30, 35])
    expect(
      filterSort(rows, cols, {
        filters: {},
        sort: null,
        filterRules: [{ key: 'name', operator: 'in', value: ['Alice', 'Bob'] }],
      })
        .map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Bob'])
    expect(
      filterSort(rows, cols, {
        filters: {},
        sort: null,
        filterRules: [{ key: 'age', operator: 'between', value: [26, 31] }],
      }).map((r) => r.age),
    ).toEqual([30])
  })

  it('substring filter AND filterRule must both match', () => {
    const out = filterSort(rows, cols, {
      filters: { name: 'a' }, // Charlie, Alice
      sort: null,
      filterRules: [{ key: 'age', operator: 'lt', value: 28 }], // Alice(25)
    })
    expect(out.map((r) => r.name)).toEqual(['Alice'])
  })

  it('multiSort breaks ties on the next column', () => {
    const data = [
      { team: 'a', score: 2 },
      { team: 'a', score: 1 },
      { team: 'b', score: 5 },
    ]
    const c = [
      { key: 'team', getValue: (r: (typeof data)[number]) => r.team },
      { key: 'score', getValue: (r: (typeof data)[number]) => r.score },
    ]
    const out = filterSort(data, c, {
      filters: {},
      sort: null,
      multiSort: [
        { key: 'team', direction: 'asc' },
        { key: 'score', direction: 'desc' },
      ],
    })
    expect(out).toEqual([
      { team: 'a', score: 2 },
      { team: 'a', score: 1 },
      { team: 'b', score: 5 },
    ])
  })

  it('single `sort` takes precedence over multiSort', () => {
    const out = filterSort(rows, cols, {
      filters: {},
      sort: { key: 'age', direction: 'asc' },
      multiSort: [{ key: 'name', direction: 'asc' }],
    })
    expect(out.map((r) => r.age)).toEqual([25, 30, 35])
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
    expect(getPageRange(3, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('inserts side-tagged ellipses around the current page', () => {
    expect(getPageRange(10, 20)).toEqual([1, 'ellipsis-left', 9, 10, 11, 'ellipsis-right', 20])
  })
  it('only a right ellipsis near the start', () => {
    expect(getPageRange(1, 20)).toEqual([1, 2, 'ellipsis-right', 20])
  })
  it('only a left ellipsis near the end', () => {
    expect(getPageRange(20, 20)).toEqual([1, 'ellipsis-left', 19, 20])
  })
  it('edge cases', () => {
    expect(getPageRange(1, 0)).toEqual([])
    expect(getPageRange(1, 1)).toEqual([1])
  })
})
