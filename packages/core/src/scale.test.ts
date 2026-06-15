import { describe, expect, it } from 'vitest'
import { createDataSource, createSyncClientDataSource } from './data-source'
import type { DataViewColumn } from './data-view'
import { createVirtualizer } from './virtualizer'
import { createSelectionModel } from './selection'

/**
 * Deterministic SCALE guard — exercises the data engine, the virtualizer, and the
 * selection model at 100k rows and asserts CORRECTNESS (not timing, which is
 * runner-variant). It is the non-flaky companion to scale.bench.ts: the benches
 * measure throughput; this proves the hot paths produce correct results at scale
 * and don't blow the stack / hang. A regression that makes the engine O(n^2) or
 * the virtualizer render every row would still pass on shape here — that's what
 * the benches catch — but a correctness break at scale fails the gate.
 */
const N = 100_000

interface Row extends Record<string, unknown> {
  id: number
  name: string
  n: number
}

function makeRows(count: number): Row[] {
  const rows = new Array<Row>(count)
  // n = (i * 7919) % count is a bijection (7919 prime, coprime to count) → a
  // permutation of 0..count-1, so sort results are exactly predictable.
  for (let i = 0; i < count; i++) rows[i] = { id: i, name: `row-${i}`, n: (i * 7919) % count }
  return rows
}

const columns: DataViewColumn<Row>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'n', getValue: (r) => r.n },
]

describe('scale: createDataSource @100k', () => {
  const data = makeRows(N)

  it('sorts 100k rows synchronously and pages correctly', () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 50,
    })
    ds.setSort({ key: 'n', direction: 'asc' })
    const s = ds.getState()
    expect(s.total).toBe(N)
    expect(s.rows).toHaveLength(50)
    // ascending by the permutation column → first page is n = 0..49
    expect(s.rows.map((r) => r.n)).toEqual(Array.from({ length: 50 }, (_, i) => i))
  })

  it('filters 100k rows down to an exact substring match set', () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 10,
    })
    ds.setFilter('name', 'row-99999') // exactly one row matches
    expect(ds.getState().total).toBe(1)
    expect(ds.getState().rows[0]?.id).toBe(99999)
  })
})

describe('scale: createVirtualizer @100k', () => {
  it('renders a bounded window regardless of count', () => {
    const v = createVirtualizer({ count: N, estimateSize: 32, viewportSize: 320 })
    const s = v.getState()
    expect(s.totalSize).toBe(N * 32)
    // viewport/row = 10 visible; window is tiny, NOT 100k nodes
    expect(s.items.length).toBeLessThan(16)
  })

  it('scrolls deep into the list and measures in O(log n) without rebuild', () => {
    const v = createVirtualizer({ count: N, estimateSize: 32, viewportSize: 320 })
    v.scrollToOffset(32 * 50_000)
    const s = v.getState()
    expect(s.startIndex).toBeGreaterThan(49_000)
    expect(s.startIndex).toBeLessThan(50_010)
    // measuring one row mid-list shifts the total by exactly the delta
    v.measure(s.startIndex, 64)
    expect(v.totalSize()).toBe(N * 32 + 32)
  })
})

describe('scale: createSelectionModel @100k', () => {
  it('membership is O(1) over a 50k-key selection', () => {
    const sel = createSelectionModel({ mode: 'multiple' })
    const evens: string[] = []
    for (let i = 0; i < N; i += 2) evens.push(String(i))
    sel.set(evens) // bulk select (O(n) once), not 50k O(n) toggles
    expect(sel.get().length).toBe(N / 2)
    // Set-backed membership index → these are O(1) lookups, not array scans.
    expect(sel.isSelected('0')).toBe(true)
    expect(sel.isSelected('1')).toBe(false)
    expect(sel.isSelected('99998')).toBe(true)
    expect(sel.isSelected('99999')).toBe(false)
  })
})
