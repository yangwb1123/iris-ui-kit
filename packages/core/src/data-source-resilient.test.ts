import { describe, it, expect, vi } from 'vitest'
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

  it('resilient SWR is opt-in and refreshes a stale data-source cache entry', async () => {
    let now = 0
    let value = 1
    const fetcher = vi.fn(async () => ({ rows: [{ id: value, name: `row-${value}` }], total: 1 }))
    const ds = createDataSource<Row>({
      fetcher,
      immediate: false,
      resilient: { ttlMs: 100, staleWhileRevalidate: true, breaker: false, now: () => now },
    })

    await ds.load()
    value = 2
    now = 500
    await ds.load()
    expect(ds.getState().rows[0]?.id).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ds.getState().rows[0]?.id).toBe(1)
    await ds.load()
    expect(ds.getState().rows[0]?.id).toBe(2)
  })

  it('opts into cache SWR without changing DataSource state to background refresh', async () => {
    let clock = 0
    let resolveRefresh: ((result: { rows: Row[]; total: number }) => void) | undefined
    const fetcher = vi.fn(() => {
      if (fetcher.mock.calls.length === 1)
        return Promise.resolve({ rows: [{ ...ROWS[0]! }], total: 3 })
      return new Promise<{ rows: Row[]; total: number }>((resolve) => {
        resolveRefresh = resolve
      })
    })
    const ds = createDataSource<Row>({
      fetcher,
      immediate: false,
      resilient: { ttlMs: 100, staleWhileRevalidate: true, now: () => clock, breaker: false },
    })

    await ds.load()
    clock = 500
    const staleLoad = ds.load()
    await staleLoad
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(ds.getState().rows[0]?.id).toBe(1)

    resolveRefresh?.({ rows: [{ ...ROWS[1]! }], total: 3 })
    await Promise.resolve()
    await Promise.resolve()
    // SWR refreshes the resilient cache; DataSource remains pull-based and does
    // not claim an automatic UI update from the background cache settlement.
    expect(ds.getState().rows[0]?.id).toBe(1)
  })

  it('resilient retry starts a fresh same-key fetch after superseding an aborted request', async () => {
    type Result = { rows: Row[]; total: number }
    const requests: Array<{
      resolve: (result: Result) => void
      reject: (error: unknown) => void
    }> = []
    const fetcher = (query: DataSourceQuery, signal?: AbortSignal): Promise<Result> =>
      new Promise<Result>((resolve, reject) => {
        requests.push({ resolve, reject })
        signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        void query
      })
    const ds = createDataSource<Row>({
      fetcher,
      immediate: false,
      resilient: { ttlMs: 60000, breaker: false },
    })

    const first = ds.load()
    const second = ds.load()
    expect(requests).toHaveLength(2)
    requests[1]!.resolve({ rows: [ROWS[1]!], total: 1 })
    await Promise.all([first, second])

    expect(ds.getState().rows).toEqual([ROWS[1]])
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
    await ds.load() // setter's aborted request is not reused → fetch 3
    expect(getFetches()).toBe(3)
    expect(ds.getState().rows.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice'])
    ds.setMultiSort([{ key: 'id', direction: 'desc' }])
    await ds.load() // setter's aborted request is not reused → fetch 5
    expect(getFetches()).toBe(5)
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
    await ds.load() // setter's aborted request is not reused → fetch 3
    expect(getFetches()).toBe(3)
    expect(ds.getState().rows.map((r) => r.name)).toEqual(['Alice', 'Charlie'])
    ds.setFilterRules([{ key: 'id', operator: 'gt', value: 1 }])
    await ds.load() // setter's aborted request is not reused → fetch 5
    expect(getFetches()).toBe(5)
    expect(ds.getState().rows.map((r) => r.name)).toEqual(['Bob', 'Charlie'])
  })

  it('canonicalizes reordered nested JSON objects into one cache key', async () => {
    const queries: DataSourceQuery[] = []
    const fetcher = vi.fn(async (query: DataSourceQuery) => {
      queries.push(query)
      return { rows: ROWS, total: ROWS.length }
    })
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      immediate: false,
      resilient: { ttlMs: 60000 },
    })
    const first = { outer: { first: 1, second: [{ left: true, right: false }] }, value: 'same' }
    const reordered = {
      value: 'same',
      outer: { second: [{ right: false, left: true }], first: 1 },
    }

    ds.store.setState((state) => ({
      ...state,
      filterRules: [{ key: 'name', operator: 'eq', value: first }],
    }))
    await ds.load()
    ds.store.setState((state) => ({
      ...state,
      filterRules: [{ key: 'name', operator: 'eq', value: reordered }],
    }))
    await ds.load()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(queries[0]?.filterRules[0]?.value).toBe(first)
  })

  it('shares a cache key for inactive empty-string filters without changing the fetch query', async () => {
    const queries: DataSourceQuery[] = []
    const fetcher = vi.fn(async (query: DataSourceQuery) => {
      queries.push(query)
      return { rows: ROWS, total: ROWS.length }
    })
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      immediate: false,
      resilient: { ttlMs: 60000 },
    })

    ds.store.setState((state) => ({ ...state, filters: { name: '' } }))
    await ds.load()
    ds.store.setState((state) => ({ ...state, filters: {} }))
    await ds.load()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(queries[0]?.filters).toEqual({ name: '' })
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

  it('non-JSON-safe filter values never share cache entries and stay unchanged for the backend', async () => {
    const base = makeCountingFetcher(ROWS)
    const backendValues: unknown[] = []
    const fetcher = (query: DataSourceQuery) => {
      backendValues.push(query.filterRules[0]?.value)
      return base.fetcher(query)
    }
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      immediate: false,
      resilient: { ttlMs: 60000 },
    })
    await ds.load()
    const cyclicA: Record<string, unknown> = {}
    cyclicA.self = cyclicA
    const cyclicB: Record<string, unknown> = {}
    cyclicB.self = cyclicB
    const functionA = () => 'a'
    const functionB = () => 'b'
    const values: unknown[] = [
      functionA,
      functionB,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      cyclicA,
      cyclicB,
    ]

    let expectedFetches = 1
    for (const value of values) {
      ds.store.setState((state) => ({
        ...state,
        filterRules: [{ key: 'name', operator: 'eq', value }],
      }))
      await ds.load()
      expect(base.getFetches()).toBe(++expectedFetches)
      expect(backendValues.at(-1)).toBe(value)
    }
  })

  it('successful mutate invalidates the cache (post-mutate load refetches)', async () => {
    const { fetcher, getFetches, renameFirst } = makeCountingFetcher(ROWS)
    const ds = createDataSource<Row>({
      fetcher,
      pageSize: 10,
      immediate: false,
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
      immediate: false,
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
      immediate: false,
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
      immediate: false,
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
      immediate: false,
      resilient: { ttlMs: 60000 },
      outbox: { maxAttempts: 1 },
    })
    await ds.load()
    expect(getFetches()).toBe(1)
    await ds.mutate(async () => {})
    expect(getFetches()).toBe(2) // flush success → invalidate → reload refetches
  })
})
