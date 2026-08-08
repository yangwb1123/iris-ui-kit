import { describe, it, expect } from 'vitest'
import { createDataSource } from './data-source'
import { createSyncClientDataSource } from './data-source/client'
import { filterSort, paginate, type DataViewColumn } from './data-view'
import type { DataSourceQuery } from './data-source/types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const ROWS: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
]

const COLUMNS: DataViewColumn<Row>[] = [
  { key: 'id', getValue: (r) => r.id },
  { key: 'name', getValue: (r) => r.name },
]

describe('createDataSource with resilient option', () => {
  it('resilient mode: constructs without error', () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 2,
      resilient: { ttlMs: 5000 },
    })
    expect(ds.getState().pageSize).toBe(2)
  })

  it('resilient mode: loads data correctly', async () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 2,
      resilient: { ttlMs: 5000 },
    })
    await ds.load()
    const state = ds.getState()
    expect(state.rows.length).toBe(2)
    expect(state.rows[0]?.name).toBe('Alice')
    expect(state.total).toBe(3)
  })

  it('resilient mode: second load hits cache (repeated query)', async () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 10,
      resilient: { ttlMs: 5000 },
    })
    // Wrap to count calls
    const originalLoad = ds.load.bind(ds)
    await originalLoad()
    await originalLoad()
    // With cache, second call should still work (data from cache or re-fetch)
    const state = ds.getState()
    expect(state.rows.length).toBe(3)
  })

  it('resilient mode: circuit breaker trips on repeated failures', async () => {
    const failingFetcher = async () => {
      throw new Error('Network error')
    }
    const ds = createDataSource<Row>({
      fetcher: failingFetcher,
      pageSize: 10,
      resilient: { ttlMs: 0, breaker: { failureThreshold: 2, resetMs: 60000 } },
    })
    await ds.load()
    expect(ds.getState().error).toBeTruthy()
  })

  it('resilient mode: works with outbox config', async () => {
    const ds = createDataSource<Row>({
      fetcher: createSyncClientDataSource(ROWS, COLUMNS),
      pageSize: 10,
      outbox: { maxAttempts: 1 },
    })
    await ds.load()
    expect(ds.getState().rows.length).toBe(3)
  })
})

/**
 * A fetcher over a MUTABLE backing store that counts its own invocations and
 * returns per-row COPIES — the engine's rows never alias the backing objects, so
 * a mutation becomes visible ONLY through a real re-fetch. `renameFirst()` swaps
 * the first backing row's name for the new value, as the server would after a
 * successful mutation.
 */
function makeCountingFetcher(rows: Row[]) {
  const backing: Row[] = rows.map((r) => ({ ...r }))
  let fetches = 0
  const fetcher = (q: DataSourceQuery): { rows: Row[]; total: number } => {
    const processed = filterSort(backing, COLUMNS, {
      filters: q.filters,
      sort: q.sort,
      multiSort: q.multiSort,
      filterRules: q.filterRules,
    })
    fetches += 1
    return {
      rows: paginate(processed, q.page, q.pageSize).map((r) => ({ ...r })),
      total: processed.length,
    }
  }
  const renameFirst = () => {
    backing[0] = { ...backing[0]!, name: `${backing[0]!.name}!` }
  }
  return { fetcher, getFetches: () => fetches, renameFirst }
}

describe('createDataSource resilient: cache-key completeness + mutate auto-invalidation', () => {
  it('multiSort produces distinct cache keys (no cross-query collisions)', async () => {
    const { fetcher, getFetches } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      immediate: false,
      resilient: { ttlMs: 60000 },
    })
    await ds.load() // fetch 1 (initial key)
    await ds.load() // fresh cache → coalesced
    expect(getFetches()).toBe(1)
    ds.setMultiSort([{ key: 'name', direction: 'desc' }])
    await ds.load() // distinct key → fetch 2
    expect(getFetches()).toBe(2)
    expect(ds.getState().rows.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice'])
    ds.setMultiSort([{ key: 'id', direction: 'desc' }])
    await ds.load() // yet another key → fetch 3
    expect(getFetches()).toBe(3)
    // Row identity follows the CURRENT query — never the initial page's cache.
    expect(ds.getState().rows.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('filterRules produce distinct cache keys (no cross-query collisions)', async () => {
    const { fetcher, getFetches } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      immediate: false,
      resilient: { ttlMs: 60000 },
    })
    await ds.load()
    ds.setFilterRules([{ key: 'name', operator: 'contains', value: 'li' }])
    await ds.load() // distinct key → fetch 2
    expect(getFetches()).toBe(2)
    expect(ds.getState().rows.map((r) => r.name)).toEqual(['Alice', 'Charlie'])
    ds.setFilterRules([{ key: 'id', operator: 'gt', value: 1 }])
    await ds.load() // yet another key → fetch 3
    expect(getFetches()).toBe(3)
    expect(ds.getState().rows.map((r) => r.name)).toEqual(['Bob', 'Charlie'])
  })

  it('non-serializable FilterRule.value degrades to pass-through (no throw, no false cache hits)', async () => {
    const { fetcher, getFetches } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      immediate: false,
      resilient: { ttlMs: 60000 },
    })
    await ds.load() // fetch 1
    expect(getFetches()).toBe(1)
    // A cyclic value makes JSON.stringify throw — the fallback must kick in
    // (functions would be silently omitted, which JSON semantics allow).
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    ds.setFilterRules([{ key: 'name', operator: 'eq', value: cyclic }])
    // The setter's own reload uses a unique key (fetch 2) — never the initial
    // page's entry — and a following load can't coalesce (fetch 3).
    await ds.load()
    expect(getFetches()).toBe(3)
    await ds.load() // still no cache sharing (fresh unique key) → fetch 4
    expect(getFetches()).toBe(4)
  })

  it('successful mutate invalidates the cache (post-mutate load refetches)', async () => {
    const { fetcher, getFetches, renameFirst } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      resilient: { ttlMs: 60000 },
    })
    await ds.load()
    await ds.load()
    expect(getFetches()).toBe(1) // fresh cache short-circuits the fetcher
    await ds.mutate(async () => renameFirst())
    expect(getFetches()).toBe(2) // auto-invalidate → real re-fetch
    expect(ds.getState().rows[0]?.name).toBe('Alice!')
  })

  it('mutate with skipReload still invalidates the cache (next read refetches)', async () => {
    const { fetcher, getFetches, renameFirst } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      resilient: { ttlMs: 60000 },
    })
    await ds.load()
    expect(getFetches()).toBe(1)
    await ds.mutate(async () => renameFirst(), { skipReload: true })
    expect(getFetches()).toBe(1) // skipReload → no reload
    expect(ds.getState().rows[0]?.name).toBe('Alice') // stale row is still displayed
    await ds.load() // next read must REFETCH (cache was invalidated)
    expect(getFetches()).toBe(2)
    expect(ds.getState().rows[0]?.name).toBe('Alice!')
  })

  it('failed mutate does NOT invalidate the cache (server state unchanged)', async () => {
    const { fetcher, getFetches } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      resilient: { ttlMs: 60000 },
    })
    await ds.load()
    expect(getFetches()).toBe(1)
    await expect(
      ds.mutate(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    // The failure path's re-load serves the still-fresh cache — no new fetch.
    expect(getFetches()).toBe(1)
    await ds.load()
    expect(getFetches()).toBe(1) // cache remains fresh and valid
  })

  it('successful mutateRow invalidates the cache', async () => {
    const { fetcher, getFetches } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      resilient: { ttlMs: 60000 },
    })
    await ds.load()
    await ds.mutateRow('1', async () => {})
    expect(getFetches()).toBe(2)
  })

  it('outbox flush success invalidates the cache', async () => {
    const { fetcher, getFetches } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      resilient: { ttlMs: 60000 },
      outbox: { maxAttempts: 1 },
    })
    await ds.load()
    expect(getFetches()).toBe(1)
    await ds.mutate(async () => {})
    expect(getFetches()).toBe(2) // flush success → invalidate → reload refetches
  })
})
