import { createStore, type Store } from './store'
import { createSelectionModel, type SelectionModel } from './selection'
import {
  pageCount as computePageCount,
  filterSort,
  paginate,
  type SortState,
  type FilterRule,
  type DataViewColumn,
} from './data-view'

/**
 * Framework-agnostic unified data engine (L4 composite) — the convergence point
 * the audit's dir-1 calls for. A superset of {@link createResourceController}:
 * the same list + pagination + selection + (optimistic) mutate workload, plus
 * the depth a production grid needs — multi-column sort, typed filter operators,
 * an `infinite` (load-more) mode alongside `paged`, and per-row pending/error
 * state for row-scoped mutations. pro-table, the base Table, and the resource
 * controller can all consume ONE engine instead of three. The loader is token-
 * and abort-guarded (the same race protection as {@link createAsyncResource},
 * extended for infinite append), so a slow page can never clobber a newer one.
 */
export interface DataSourceQuery {
  page: number
  pageSize: number
  /** Single-column sort (takes precedence). */
  sort: SortState | null
  /** Multi-column sort, applied when `sort` is null (most-significant first). */
  multiSort: SortState[]
  /** key → substring (case-insensitive); empty strings ignored. */
  filters: Record<string, string>
  /** Typed operator filters, AND-ed with `filters`. */
  filterRules: FilterRule[]
}

export type DataSourceMode = 'paged' | 'infinite'

export interface DataSourceConfig<T> {
  /**
   * Fetch one page for the query. An `AbortSignal` is appended as an optional
   * trailing arg (aborted when a newer load supersedes this one); accept it to
   * cancel the network call, or ignore it (the token guard still prevents stale
   * writes).
   */
  fetcher: (query: DataSourceQuery, signal?: AbortSignal) => Promise<{ rows: T[]; total: number }>
  /** Rows per page. Default 10. */
  pageSize?: number
  /** `'paged'` (default) replaces rows per page; `'infinite'` appends via loadMore. */
  mode?: DataSourceMode
  /** Auto-load the first page on creation. Default true. */
  immediate?: boolean
}

export interface DataSourceState<T> {
  /** Current page (paged) or all accumulated rows (infinite). */
  rows: T[]
  total: number
  page: number
  pageSize: number
  sort: SortState | null
  multiSort: SortState[]
  filters: Record<string, string>
  filterRules: FilterRule[]
  /** A full (replace) load is in flight. */
  loading: boolean
  /** An infinite `loadMore` (append) is in flight. */
  loadingMore: boolean
  error: unknown
  /** Whether more rows are available (paged: more pages; infinite: accumulated < total). */
  hasMore: boolean
  selectedKeys: string[]
  /** Row keys with an in-flight row-scoped mutate. */
  pendingRows: string[]
  /** Row key → last row-scoped mutate error. */
  rowErrors: Record<string, unknown>
}

/** Options for a table-level (optionally optimistic) {@link DataSourceController.mutate}. */
export interface MutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
}

/** Options for a row-scoped {@link DataSourceController.mutateRow}. */
export interface RowMutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
}

export interface DataSourceController<T> {
  store: Store<DataSourceState<T>>
  selection: SelectionModel
  getState(): DataSourceState<T>
  subscribe(listener: (state: DataSourceState<T>) => void): () => void
  /** (Re)load the current page, replacing rows. */
  load(): Promise<void>
  reload(): Promise<void>
  /** Infinite mode: fetch the next page and APPEND it. No-op otherwise / when exhausted. */
  loadMore(): Promise<void>
  setPage(page: number): void
  setPageSize(size: number): void
  /** Set single-column sort and reload from page 1. */
  setSort(sort: SortState | null): void
  /** Set multi-column sort (clears single sort) and reload from page 1. */
  setMultiSort(multiSort: SortState[]): void
  /** Set one substring filter and reload from page 1 (empty string clears it). */
  setFilter(key: string, value: string): void
  /** Set typed operator filters and reload from page 1. */
  setFilterRules(rules: FilterRule[]): void
  /** Clear all substring + typed filters and reload from page 1. */
  clearFilters(): void
  pageCount(): number
  hasMore(): boolean
  isRowPending(rowKey: string): boolean
  rowError(rowKey: string): unknown
  /** Run a table-level CRUD side-effect then reload; optionally optimistic. */
  mutate(action: () => Promise<unknown>, options?: MutateOptions<T>): Promise<void>
  /**
   * Run a row-scoped side-effect: marks the row pending, optionally applies an
   * optimistic row update, records a per-row error on rejection (rolling back any
   * optimistic update), then clears pending and reloads.
   */
  mutateRow(
    rowKey: string,
    action: () => Promise<unknown>,
    options?: RowMutateOptions<T>,
  ): Promise<void>
  /** Abort any in-flight load so a late response never writes back. Idempotent. */
  destroy(): void
}

export function createDataSource<T>(config: DataSourceConfig<T>): DataSourceController<T> {
  const mode: DataSourceMode = config.mode ?? 'paged'
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
  selection.store.subscribe((keys) => store.setState((s) => ({ ...s, selectedKeys: keys })))

  // Single token + abort authority for ALL fetches (replace + append), so a
  // stale page can never clobber a newer load and a superseding load aborts the
  // previous request.
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

  async function fetchPage(opts: { append: boolean; page?: number }): Promise<void> {
    const append = opts.append && mode === 'infinite'
    const token = ++epoch
    inFlight?.abort()
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
    inFlight = ac
    store.setState((s) => ({
      ...s,
      loading: !append,
      loadingMore: append,
      error: undefined,
    }))
    const query = buildQuery(opts.page)
    try {
      const result = ac ? await config.fetcher(query, ac.signal) : await config.fetcher(query)
      if (token !== epoch) return // superseded
      inFlight = null
      store.setState((s) => {
        const nextRows = append ? [...s.rows, ...result.rows] : result.rows
        const page = opts.page ?? s.page
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
    } catch (error) {
      if (token !== epoch) return // superseded
      inFlight = null
      if (ac?.signal.aborted) return // canceled, not a real error
      store.setState((s) => ({ ...s, loading: false, loadingMore: false, error }))
    }
  }

  const load = (): Promise<void> => fetchPage({ append: false })

  /** Reset to page 1 and replace (a sort/filter change invalidates offsets). */
  const reloadFromStart = (): Promise<void> => {
    store.setState((s) => ({ ...s, page: 1 }))
    return fetchPage({ append: false, page: 1 })
  }

  const setPendingRow = (rowKey: string, pending: boolean): void => {
    store.setState((s) => {
      const has = s.pendingRows.includes(rowKey)
      if (pending === has) return s
      return {
        ...s,
        pendingRows: pending
          ? [...s.pendingRows, rowKey]
          : s.pendingRows.filter((k) => k !== rowKey),
      }
    })
  }

  const setRowError = (rowKey: string, error: unknown): void => {
    store.setState((s) => {
      if (error === undefined) {
        if (!(rowKey in s.rowErrors)) return s
        const next = { ...s.rowErrors }
        delete next[rowKey]
        return { ...s, rowErrors: next }
      }
      return { ...s, rowErrors: { ...s.rowErrors, [rowKey]: error } }
    })
  }

  const controller: DataSourceController<T> = {
    store,
    selection,
    getState: store.getState,
    subscribe: store.subscribe,
    load,
    reload: load,
    loadMore() {
      const s = store.getState()
      if (mode !== 'infinite' || !s.hasMore || s.loadingMore || s.loading) return Promise.resolve()
      return fetchPage({ append: true, page: s.page + 1 })
    },
    setPage(page) {
      store.setState((s) => ({ ...s, page }))
      void fetchPage({ append: false, page })
    },
    setPageSize(size) {
      store.setState((s) => ({ ...s, pageSize: size, page: 1 }))
      void reloadFromStart()
    },
    setSort(sort) {
      store.setState((s) => ({ ...s, sort, page: 1 }))
      void reloadFromStart()
    },
    setMultiSort(multiSort) {
      store.setState((s) => ({ ...s, multiSort, sort: null, page: 1 }))
      void reloadFromStart()
    },
    setFilter(key, value) {
      store.setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 }))
      void reloadFromStart()
    },
    setFilterRules(rules) {
      store.setState((s) => ({ ...s, filterRules: rules, page: 1 }))
      void reloadFromStart()
    },
    clearFilters() {
      store.setState((s) => ({ ...s, filters: {}, filterRules: [], page: 1 }))
      void reloadFromStart()
    },
    pageCount() {
      const s = store.getState()
      return computePageCount(s.total, s.pageSize)
    },
    hasMore: () => store.getState().hasMore,
    isRowPending: (rowKey) => store.getState().pendingRows.includes(rowKey),
    rowError: (rowKey) => store.getState().rowErrors[rowKey],
    async mutate(action, options) {
      const snapshot = store.getState().rows
      if (options?.optimistic) {
        store.setState((s) => ({ ...s, rows: options.optimistic!(s.rows) }))
      }
      try {
        await action()
      } catch (error) {
        if (options?.optimistic) store.setState((s) => ({ ...s, rows: snapshot }))
        await load()
        throw error
      }
      if (!options?.skipReload) await load()
    },
    async mutateRow(rowKey, action, options) {
      const snapshot = store.getState().rows
      setRowError(rowKey, undefined)
      setPendingRow(rowKey, true)
      if (options?.optimistic) {
        store.setState((s) => ({ ...s, rows: options.optimistic!(s.rows) }))
      }
      try {
        await action()
      } catch (error) {
        if (options?.optimistic) store.setState((s) => ({ ...s, rows: snapshot }))
        setRowError(rowKey, error)
        setPendingRow(rowKey, false)
        throw error
      }
      setPendingRow(rowKey, false)
      if (!options?.skipReload) await load()
    },
    destroy() {
      epoch += 1
      inFlight?.abort()
      inFlight = null
    },
  }

  if (config.immediate !== false) void load()

  return controller
}

/**
 * Build a client-side `fetcher` for {@link createDataSource} from an in-memory
 * dataset: applies the query's substring filters + typed filter rules + single
 * or multi-column sort locally (via the core {@link filterSort} pipeline) and
 * slices the page — making the data source symmetric (client/server) and usable
 * with no backend.
 */
export function createClientDataSource<T>(
  data: readonly T[],
  columns: readonly DataViewColumn<T>[],
): (query: DataSourceQuery) => Promise<{ rows: T[]; total: number }> {
  return async ({ page, pageSize, sort, multiSort, filters, filterRules }) => {
    const processed = filterSort(data, columns, { filters, sort, multiSort, filterRules })
    return { rows: paginate(processed, page, pageSize), total: processed.length }
  }
}
