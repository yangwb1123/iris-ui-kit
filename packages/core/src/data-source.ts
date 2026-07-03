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

  let epoch = 0
  let inFlight: AbortController | null = null

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
      const result = ac ? config.fetcher(query, ac.signal) : config.fetcher(query)
      if (isThenable(result)) {
        store.setState((s) => ({ ...s, loading: !append, loadingMore: append, error: undefined }))
        const awaited = await result
        if (token !== epoch) return
        applyResult(awaited, append, opts.page)
        return
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
      try {
        await action()
      } catch (error) {
        if (options?.optimistic) store.setState((s) => ({ ...s, rows: snapshot }))
        await controller.load()
        throw error
      }
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
      store.setState((s) => ({ ...s, pendingRows: s.pendingRows.filter((k) => k !== rowKey) }))
      if (!options?.skipReload) await controller.load()
    },
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
