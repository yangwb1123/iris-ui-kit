import { createStore, type Store } from './store'
import { createDataSource } from './data-source'
import { type SelectionModel } from './selection'
import { filterSort, paginate, type SortState, type DataViewColumn } from './data-view'

/**
 * Framework-agnostic CRUD resource controller (L4 composite) — the canonical
 * admin "data list" abstraction, composed from already-sunk core primitives:
 * server loading via {@link createAsyncResource} (token-guarded), selection via
 * {@link createSelectionModel}, and the {@link pageCount} helper. Covers list +
 * pagination + sort + filter + selection + refresh + (optionally optimistic)
 * mutate — the workload of every admin list. The adapter is a pure table/list
 * render over `controller`.
 */
export interface ResourceQuery {
  page: number
  pageSize: number
  /** Active sort, or null. Passed to the fetcher for server-side sorting. */
  sort: SortState | null
  /** key → filter value (empty string = inactive). Passed to the fetcher. */
  filters: Record<string, string>
}

export interface ResourceControllerConfig<T> {
  /** Fetch one page for the given query (page/pageSize/sort/filters). */
  fetcher: (query: ResourceQuery) => Promise<{ rows: T[]; total: number }>
  /** Rows per page. Default 10. */
  pageSize?: number
  /** Auto-load the first page on creation. Default true. */
  immediate?: boolean
}

export interface ResourceState<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  sort: SortState | null
  filters: Record<string, string>
  loading: boolean
  error: unknown
  selectedKeys: string[]
}

/** Options for an (optionally optimistic) {@link ResourceController.mutate}. */
export interface MutateOptions<T> {
  /**
   * Apply an immediate optimistic update to the current rows. If `action`
   * rejects, the rows are rolled back to the pre-mutate snapshot before the
   * error surfaces and a reload runs. Omit for the plain action-then-reload path.
   */
  optimistic?: (rows: T[]) => T[]
  /** Skip the reload after a successful action (e.g. an optimistic update is enough). */
  skipReload?: boolean
}

export interface ResourceController<T> {
  store: Store<ResourceState<T>>
  selection: SelectionModel
  getState(): ResourceState<T>
  subscribe(listener: (state: ResourceState<T>) => void): () => void
  /** Load the current page. */
  load(): Promise<void>
  /** Alias for {@link load} (re-fetch current page). */
  reload(): Promise<void>
  setPage(page: number): void
  setPageSize(size: number): void
  /** Set the sort and reload from page 1. */
  setSort(sort: SortState | null): void
  /** Set one column's filter and reload from page 1 (empty string clears it). */
  setFilter(key: string, value: string): void
  /** Clear all filters and reload from page 1. */
  clearFilters(): void
  pageCount(): number
  /**
   * Run a create/update/delete side-effect, then reload the current page.
   * With {@link MutateOptions.optimistic}, the rows update immediately and roll
   * back if the action rejects.
   */
  mutate(action: () => Promise<unknown>, options?: MutateOptions<T>): Promise<void>
  /**
   * Tear down the controller: abort any in-flight fetch so a late response
   * never writes back to a torn-down (e.g. unmounted) instance. Call from the
   * host adapter on unmount. Idempotent, and safe to load again afterwards
   * (the internal store subscriptions are intentionally left intact — they are
   * self-referential and collected with the controller — so a React StrictMode
   * remount that re-loads still propagates).
   */
  destroy(): void
}

export function createResourceController<T>(
  config: ResourceControllerConfig<T>,
): ResourceController<T> {
  const store = createStore<ResourceState<T>>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: config.pageSize ?? 10,
    sort: null,
    filters: {},
    loading: false,
    error: undefined,
    selectedKeys: [],
  })

  // The unified data engine does the work; this controller is a thin projection
  // of it onto the narrower ResourceState (a strict subset of DataSourceState),
  // so resource, the base Table, and pro-table all share ONE engine. A
  // DataSourceQuery is a superset of ResourceQuery, so the fetcher receives it
  // unchanged (the extra multi-sort/filter-rule fields stay empty here).
  const ds = createDataSource<T>({
    fetcher: (query) => config.fetcher(query),
    pageSize: config.pageSize ?? 10,
    immediate: false,
  })
  ds.subscribe((s) => {
    store.setState((st) => ({
      ...st,
      rows: s.rows,
      total: s.total,
      page: s.page,
      pageSize: s.pageSize,
      sort: s.sort,
      filters: s.filters,
      loading: s.loading,
      error: s.error,
      selectedKeys: s.selectedKeys,
    }))
  })

  const controller: ResourceController<T> = {
    store,
    selection: ds.selection,
    getState: store.getState,
    subscribe: store.subscribe,
    load: () => ds.load(),
    reload: () => ds.reload(),
    setPage: (page) => ds.setPage(page),
    setPageSize: (size) => ds.setPageSize(size),
    setSort: (sort) => ds.setSort(sort),
    setFilter: (key, value) => ds.setFilter(key, value),
    clearFilters: () => ds.clearFilters(),
    pageCount: () => ds.pageCount(),
    mutate: (action, options) => ds.mutate(action, options),
    destroy: () => ds.destroy(),
  }

  if (config.immediate !== false) void ds.load()

  return controller
}

/**
 * Build a client-side `fetcher` for {@link createResourceController} from an
 * in-memory dataset: applies the query's filters + sort locally (via the core
 * {@link filterSort} pipeline) and slices the page. Makes the resource
 * controller symmetric (client/server) and usable without a backend — pass the
 * result as `config.fetcher`. The `columns` map each filter/sort key to a cell
 * accessor (and optional custom `sorter`), the same `DataViewColumn` contract
 * the Table/ProTable use.
 */
export function createClientFetcher<T>(
  data: readonly T[],
  columns: readonly DataViewColumn<T>[],
): (query: ResourceQuery) => Promise<{ rows: T[]; total: number }> {
  return async ({ page, pageSize, sort, filters }) => {
    const processed = filterSort(data, columns, { filters, sort })
    return { rows: paginate(processed, page, pageSize), total: processed.length }
  }
}
