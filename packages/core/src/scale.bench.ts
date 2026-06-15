import { bench, describe } from 'vitest'
import { createDataSource, createSyncClientDataSource } from './data-source'
import type { DataViewColumn } from './data-view'
import { buildOffsets, computeVirtualRange } from './virtual'
import { createVirtualizer } from './virtualizer'
import { createSelectionModel } from './selection'

/**
 * Throughput benches for the scale-critical hot paths. NOT part of the test gate
 * (run with `pnpm bench` / `turbo run bench`) because absolute ms is runner-
 * variant — read these as a relative baseline and watch for order-of-magnitude
 * regressions. The deterministic correctness companion is scale.test.ts.
 *
 * What each bench guards:
 * - data-source sort/filter: the O(n log n) / O(n) client pipeline at 10k rows.
 * - virtualizer scroll: that windowing is per-scroll O(log n) (Fenwick), NOT a
 *   per-scroll O(n) offset rebuild — the cliff that hangs a 100k-row table.
 * - virtualizer measure: that a measurement is an O(log n) point update.
 * - the buildOffsets contrast shows the O(n)-rebuild cost the virtualizer avoids.
 */

interface Row extends Record<string, unknown> {
  id: number
  name: string
  n: number
}

function makeRows(count: number): Row[] {
  const rows = new Array<Row>(count)
  for (let i = 0; i < count; i++) rows[i] = { id: i, name: `row-${i}`, n: (i * 7919) % count }
  return rows
}

const columns: DataViewColumn<Row>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'n', getValue: (r) => r.n },
]

describe('createDataSource @10k', () => {
  const data = makeRows(10_000)
  bench('construct + initial sync load', () => {
    createDataSource<Row>({ fetcher: createSyncClientDataSource(data, columns), pageSize: 50 })
  })
  bench('setSort (full re-sort + page)', () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 50,
    })
    ds.setSort({ key: 'n', direction: 'asc' })
  })
  bench('setFilter (full scan + page)', () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(data, columns),
      pageSize: 50,
    })
    ds.setFilter('name', 'row-1')
  })
})

describe('virtualizer @100k', () => {
  bench('100 scroll steps (O(log n) windowing each)', () => {
    const v = createVirtualizer({ count: 100_000, estimateSize: 32, viewportSize: 320 })
    for (let i = 0; i < 100; i++) v.setScroll(i * 30_000)
  })
  bench('1000 measures (O(log n) point updates)', () => {
    const v = createVirtualizer({ count: 100_000, estimateSize: 32, viewportSize: 320 })
    for (let i = 0; i < 1000; i++) v.measure(i, 30 + (i % 13))
  })
})

describe('offset maintenance contrast @100k', () => {
  const sizeAt = (i: number): number => 30 + (i % 13)
  bench('buildOffsets O(n) full rebuild (what the virtualizer avoids per change)', () => {
    const offsets = buildOffsets(100_000, sizeAt)
    computeVirtualRange({
      itemCount: 100_000,
      scrollTop: 1_500_000,
      viewportSize: 320,
      itemSize: 0,
      offsets,
    })
  })
})

describe('selection @100k', () => {
  const keys = Array.from({ length: 100_000 }, (_, i) => String(i))
  bench('bulk set 100k keys', () => {
    const sel = createSelectionModel({ mode: 'multiple' })
    sel.set(keys)
  })
  bench('100k isSelected lookups (Set-backed O(1))', () => {
    const sel = createSelectionModel({ mode: 'multiple' })
    sel.set(keys)
    for (let i = 0; i < 100_000; i++) sel.isSelected(String(i))
  })
})
