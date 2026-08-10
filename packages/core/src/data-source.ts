/**
 * Framework-agnostic unified data engine (L4 composite).
 *
 * The convergence point for the list + pagination + selection + (optimistic)
 * mutate workload that pro-table, the base Table, and the resource controller
 * all consume from ONE engine. Supports both `paged` (replace on page change)
 * and `infinite` (append via loadMore) modes, with row-scoped mutate tracking.
 *
 * This is the public entry point / barrel. It re-exports from:
 *
 *   types.ts  — type declarations
 *   client.ts — createClientDataSource / createSyncClientDataSource
 *
 * createDataSource itself stays inline because it's the core factory (~220 lines).
 */
import { createStore } from './store'
import { createSelectionModel } from './selection'
import { pageCount as computePageCount } from './data-view'
import { createResilientFetcher } from './resilient-fetcher'
import { createOutbox } from './outbox'
import type {
  DataSourceQuery,
  DataSourceMode,
  DataSourceConfig,
  DataSourceState,
  DataSourceController,
} from './data-source/types'

export type {
  DataSourceQuery,
  DataSourceMode,
  DataSourceConfig,
  DataSourceState,
  MutateOptions,
  RowMutateOptions,
  DataSourceController,
} from './data-source/types'
export { createClientDataSource, createSyncClientDataSource } from './data-source/client'

function isThenable<T>(value: unknown): value is Promise<T> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

export function createDataSource<T>(config: DataSourceConfig<T>): DataSourceController<T> {
  const mode: DataSourceMode = config.mode ?? 'paged'
  const maxRows = config.maxRows ?? 5000
  const store = createStore<DataSourceState<T>>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: config.pageSize ?? 10,
    sort: null,
    multiSort: [],
    filters: {},
    filterRules: [],
    loading: false,
    loadingMore: false,
    error: undefined,
    hasMore: false,
    selectedKeys: [],
    pendingRows: [],
    rowErrors: {},
  })

  const selection = createSelectionModel({ mode: 'multiple' })
  const unsubSelection = selection.store.subscribe((keys) =>
    store.setState((s) => ({ ...s, selectedKeys: keys })),
  )

  // Optional resilient fetcher wrapping the raw config.fetcher with
  // cache (dedup/TTL/SWR) + circuit breaker + rate limiter.
  const resilient = config.resilient
    ? createResilientFetcher<{ rows: T[]; total: number }>(config.resilient)
    : null

  // Optional mutation outbox for offline-first, at-least-once delivery.
  const outboxOpts = config.outbox
  const outbox = outboxOpts
    ? createOutbox<{ description: string; run: () => Promise<unknown> }>({
        execute: async (m) => {
          await m.run()
        },
        storage: typeof outboxOpts === 'object' ? (outboxOpts.storage as never) : undefined,
        maxAttempts: typeof outboxOpts === 'object' ? outboxOpts.maxAttempts : undefined,
      })
    : null

  let epoch = 0
  let inFlight: AbortController | null = null
  // Unique-key counter for queries whose FilterRule.value is not JSON-serializable
  // (functions, cyclic objects, …): such a query can't share the cache, so each
  // call gets a fresh key — caching degrades to pass-through instead of throwing
  // mid-fetch (the key is only ever used as a Map key, never sent anywhere).
  let nonSerializableKey = 0

  const cacheKey = (query: DataSourceQuery): string => {
    try {
      // Fixed literal order — `ms`/`fr` complete the key so multiSort and
      // filterRules queries never collide with the initial page or each other.
      return JSON.stringify({
        page: query.page,
        ps: query.pageSize,
        s: query.sort,
        f: query.filters,
        ms: query.multiSort,
        fr: query.filterRules,
      })
    } catch {
      return `non-serializable:${++nonSerializableKey}`
    }
  }

  const buildQuery = (overridePage?: number): DataSourceQuery => {
    const s = store.getState()
    return {
      page: overridePage ?? s.page,
      pageSize: s.pageSize,
      sort: s.sort,
      multiSort: s.multiSort,
      filters: s.filters,
      filterRules: s.filterRules,
    }
  }

  const applyResult = (
    result: { rows: T[]; total: number },
    append: boolean,
    overridePage?: number,
  ): void => {
    store.setState((s) => {
      let nextRows = append ? [...s.rows, ...result.rows] : result.rows
      // Cap to maxRows in infinite mode to prevent unbounded accumulation
      if (mode === 'infinite' && nextRows.length > maxRows) {
        nextRows = nextRows.slice(0, maxRows)
      }
      const page = overridePage ?? s.page
      const hasMore =
        mode === 'infinite'
          ? nextRows.length < result.total
          : computePageCount(result.total, s.pageSize) > page
      return {
        ...s,
        rows: nextRows,
        total: result.total,
        page,
        loading: false,
        loadingMore: false,
        error: undefined,
        hasMore,
      }
    })
  }

  async function fetchPage(opts: { append: boolean; page?: number }): Promise<void> {
    const append = opts.append && mode === 'infinite'
    const token = ++epoch
    inFlight?.abort()
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
    inFlight = ac
    const query = buildQuery(opts.page)

    try {
      let result: { rows: T[]; total: number }
      if (resilient) {
        store.setState((s) => ({ ...s, loading: !append, loadingMore: append, error: undefined }))
        const key = cacheKey(query)
        const raw = await resilient.fetch(key, async () => {
          return ac ? config.fetcher(query, ac.signal) : config.fetcher(query)
        })
        if (token !== epoch) return
        result = raw
      } else {
        const raw = ac ? config.fetcher(query, ac.signal) : config.fetcher(query)
        if (isThenable(raw)) {
          store.setState((s) => ({ ...s, loading: !append, loadingMore: append, error: undefined }))
          const awaited = await raw
          if (token !== epoch) return
          result = awaited
        } else {
          result = raw
        }
      }
      applyResult(result, append, opts.page)
    } catch (error) {
      if (token !== epoch) return
      if (ac?.signal.aborted) return
      store.setState((s) => ({ ...s, loading: false, loadingMore: false, error }))
    } finally {
      if (inFlight === ac) inFlight = null
    }
  }

  const reloadFromStart = (): Promise<void> => {
    store.setState((s) => ({ ...s, page: 1 }))
    return fetchPage({ append: false, page: 1 })
  }

  /**
   * A successful mutation changes server state, so every cached query result is
   * stale. Two layers:
   *  - `invalidateAll()` marks all entries stale — SWR-serving readers still
   *    see data but re-fetch on their next read;
   *  - `remove(currentKey)` drops the CURRENT query's entry entirely. Its epoch
   *    bump orphans a pre-mutation in-flight fetch whose settle would otherwise
   *    re-fresh the entry with pre-mutation data — and the post-mutate `load()`
   *    would then short-circuit on that fresh entry, serving pre-mutation rows.
   * Only called on SUCCESS: on failure the server state is unchanged, so the
   * cache keeps serving the data it legitimately holds.
   */
  const invalidateAfterMutation = (): void => {
    if (!resilient) return
    resilient.cache.invalidateAll()
    resilient.cache.remove(cacheKey(buildQuery()))
  }

  const controller: DataSourceController<T> = {
    store,
    selection,
    getState: store.getState,
    subscribe: store.subscribe,
    load: () => fetchPage({ append: false }),
    reload: () => fetchPage({ append: false }),
    loadMore() {
      const s = store.getState()
      if (mode !== 'infinite' || !s.hasMore || s.loadingMore || s.loading) return Promise.resolve()
      if (s.rows.length >= maxRows) return Promise.resolve()
      return fetchPage({ append: true, page: s.page + 1 })
    },
    setPage(page) {
      store.batch(() => {
        store.setState((s) => ({ ...s, page }))
        void fetchPage({ append: false, page })
      })
    },
    setPageSize(size) {
      store.batch(() => {
        store.setState((s) => ({ ...s, pageSize: size, page: 1 }))
        void reloadFromStart()
      })
    },
    setSort(sort) {
      store.batch(() => {
        store.setState((s) => ({ ...s, sort, page: 1 }))
        void reloadFromStart()
      })
    },
    setMultiSort(multiSort) {
      store.batch(() => {
        store.setState((s) => ({ ...s, multiSort, sort: null, page: 1 }))
        void reloadFromStart()
      })
    },
    setFilter(key, value) {
      store.batch(() => {
        store.setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 }))
        void reloadFromStart()
      })
    },
    setFilterRules(rules) {
      store.batch(() => {
        store.setState((s) => ({ ...s, filterRules: rules, page: 1 }))
        void reloadFromStart()
      })
    },
    clearFilters() {
      store.batch(() => {
        store.setState((s) => ({ ...s, filters: {}, filterRules: [], page: 1 }))
        void reloadFromStart()
      })
    },
    pageCount: () => computePageCount(store.getState().total, store.getState().pageSize),
    hasMore: () => store.getState().hasMore,
    isRowPending: (rowKey) => store.getState().pendingRows.includes(rowKey),
    rowError: (rowKey) => store.getState().rowErrors[rowKey],
    async mutate(action, options) {
      const snapshot = store.getState().rows
      if (options?.optimistic) store.setState((s) => ({ ...s, rows: options.optimistic!(s.rows) }))

      if (outbox) {
        // Offline-first: enqueue in the outbox for at-least-once delivery.
        outbox.enqueue({ description: 'data-source mutate', run: action })
        await outbox.flush()
      } else {
        try {
          await action()
        } catch (error) {
          if (options?.optimistic) store.setState((s) => ({ ...s, rows: snapshot }))
          await controller.load()
          throw error
        }
      }
      invalidateAfterMutation()
      if (!options?.skipReload) await controller.load()
    },
    async mutateRow(rowKey, action, options) {
      const snapshot = store.getState().rows
      store.setState((s) => ({
        ...s,
        rowErrors: { ...s.rowErrors, [rowKey]: undefined },
        pendingRows: [...s.pendingRows, rowKey],
      }))
      if (options?.optimistic) store.setState((s) => ({ ...s, rows: options.optimistic!(s.rows) }))

      if (outbox) {
        // Offline-first: enqueue in the outbox for at-least-once delivery.
        outbox.enqueue({ description: `mutate-row:${rowKey}`, run: action })
        await outbox.flush()
      } else {
        try {
          await action()
        } catch (error) {
          if (options?.optimistic) store.setState((s) => ({ ...s, rows: snapshot }))
          store.setState((s) => ({
            ...s,
            rowErrors: { ...s.rowErrors, [rowKey]: error },
            pendingRows: s.pendingRows.filter((k) => k !== rowKey),
          }))
          throw error
        }
      }
      store.setState((s) => ({ ...s, pendingRows: s.pendingRows.filter((k) => k !== rowKey) }))
      invalidateAfterMutation()
      if (!options?.skipReload) await controller.load()
    },
    outbox: outbox ?? undefined,
    destroy() {
      unsubSelection()
      epoch += 1
      inFlight?.abort()
      inFlight = null
    },
  }

  if (config.immediate !== false) void controller.load()

  return controller
}
