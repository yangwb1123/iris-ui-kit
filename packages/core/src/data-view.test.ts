import { describe, it, expect, vi } from 'vitest'
import {
  compareValues,
  cycleSort,
  filterSort,
  createMemoizedFilterSort,
  debounce,
  aggregate,
  summarize,
  groupRows,
  flattenTree,
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

describe('createMemoizedFilterSort', () => {
  it('returns the cached result when rows/columns/query are identical references', () => {
    const memo = createMemoizedFilterSort<Row>()
    const query = { filters: {}, sort: { key: 'age', direction: 'asc' as const } }
    const first = memo(rows, cols, query)
    const second = memo(rows, cols, query)
    expect(second).toBe(first) // same reference → no recompute
    expect(first.map((r) => r.age)).toEqual([25, 30, 35])
  })

  it('recomputes when any input reference changes', () => {
    const memo = createMemoizedFilterSort<Row>()
    const q1 = { filters: {}, sort: null }
    const a = memo(rows, cols, q1)
    const b = memo(rows, cols, { filters: {}, sort: null }) // new query object
    expect(b).not.toBe(a)
  })

  it('each instance has its own cache (no cross-table eviction)', () => {
    const m1 = createMemoizedFilterSort<Row>()
    const m2 = createMemoizedFilterSort<Row>()
    const q = { filters: {}, sort: null }
    const r1 = m1(rows, cols, q)
    m2(rows, cols, q)
    expect(m1(rows, cols, q)).toBe(r1) // m2 did not disturb m1's cache
  })
})

describe('debounce', () => {
  it('invokes once after the wait with the latest args', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('a')
    d('b')
    d('c')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
    vi.useRealTimers()
  })

  it('cancel() drops a pending call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('x')
    d.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('aggregate', () => {
  const data = [{ n: 10 }, { n: 20 }, { n: 30 }, { n: null }]
  const get = (r: { n: number | null }) => r.n
  it('computes sum/avg/min/max over finite values', () => {
    expect(aggregate(data, get, 'sum')).toBe(60)
    expect(aggregate(data, get, 'avg')).toBe(20)
    expect(aggregate(data, get, 'min')).toBe(10)
    expect(aggregate(data, get, 'max')).toBe(30)
  })
  it('count counts non-null values', () => {
    expect(aggregate(data, get, 'count')).toBe(3)
  })
  it('empty input → 0 for sum/avg/count, NaN for min/max', () => {
    expect(aggregate([], get, 'sum')).toBe(0)
    expect(aggregate([], get, 'avg')).toBe(0)
    expect(aggregate([], get, 'count')).toBe(0)
    expect(aggregate([], get, 'min')).toBeNaN()
    expect(aggregate([], get, 'max')).toBeNaN()
  })
})

describe('summarize', () => {
  it('produces a per-column summary record, skipping unknown keys', () => {
    const out = summarize(rows, cols, [
      { key: 'age', op: 'sum' },
      { key: 'age', op: 'avg' }, // later spec for the same key overwrites
      { key: 'missing', op: 'sum' },
    ])
    expect(out).toEqual({ age: 30 }) // avg of 30/25/35 = 30; 'missing' skipped
  })
})

describe('groupRows', () => {
  it('groups by a key function preserving first-seen order', () => {
    const data = [
      { team: 'b', v: 1 },
      { team: 'a', v: 2 },
      { team: 'b', v: 3 },
    ]
    const groups = groupRows(data, (r) => r.team)
    expect(groups.map((g) => g.key)).toEqual(['b', 'a'])
    expect(groups[0].rows).toHaveLength(2)
    expect(groups[1].rows).toEqual([{ team: 'a', v: 2 }])
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

describe('flattenTree', () => {
  interface Node {
    id: string
    children?: Node[]
  }
  const tree: Node[] = [
    { id: 'a', children: [{ id: 'a1' }, { id: 'a2', children: [{ id: 'a2x' }] }] },
    { id: 'b' },
  ]
  const opts = (expanded: Set<string>) => ({
    getKey: (n: Node) => n.id,
    getChildren: (n: Node) => n.children,
    isExpanded: (k: string) => expanded.has(k),
  })

  it('all-collapsed yields only the roots, with hasChildren flags', () => {
    const out = flattenTree(tree, opts(new Set()))
    expect(out.map((r) => r.key)).toEqual(['a', 'b'])
    expect(out[0]).toMatchObject({ depth: 0, hasChildren: true, expanded: false })
    expect(out[1]).toMatchObject({ depth: 0, hasChildren: false, expanded: false })
  })

  it('expanding a branch reveals its children at depth+1 (pre-order)', () => {
    const out = flattenTree(tree, opts(new Set(['a'])))
    expect(out.map((r) => r.key)).toEqual(['a', 'a1', 'a2', 'b'])
    expect(out.find((r) => r.key === 'a1')!.depth).toBe(1)
    expect(out.find((r) => r.key === 'a2')).toMatchObject({ depth: 1, hasChildren: true })
  })

  it('expands transitively only along expanded keys', () => {
    const out = flattenTree(tree, opts(new Set(['a', 'a2'])))
    expect(out.map((r) => r.key)).toEqual(['a', 'a1', 'a2', 'a2x', 'b'])
    expect(out.find((r) => r.key === 'a2x')!.depth).toBe(2)
  })

  it('terminates and de-dupes on a cyclic / repeated-key tree', () => {
    const a: Node = { id: 'a' }
    const b: Node = { id: 'b', children: [a] }
    a.children = [b] // a → b → a cycle
    const out = flattenTree([a], { ...opts(new Set(['a', 'b'])) })
    expect(out.map((r) => r.key)).toEqual(['a', 'b']) // each emitted once, no loop
  })
})
