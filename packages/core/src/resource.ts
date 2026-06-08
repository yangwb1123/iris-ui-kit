import { createStore, type Store } from './store'
import { createAsyncResource } from './async'
import { createSelectionModel, type SelectionModel } from './selection'
import { pageCount as computePageCount, type SortState } from './data-view'

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

  const selection = createSelectionModel({ mode: 'multiple' })
  selection.store.subscribe((keys) => store.setState((s) => ({ ...s, selectedKeys: keys })))

  const resource = createAsyncResource((query: ResourceQuery) => config.fetcher(query))
  resource.subscribe((s) => {
    store.setState((st) => ({
      ...st,
      loading: s.status === 'loading',
      rows: s.data?.rows ?? (s.status === 'loading' ? st.rows : []),
      total: s.data?.total ?? (s.status === 'loading' ? st.total : 0),
      error: s.error,
    }))
  })

  async function load(): Promise<void> {
    const { page, pageSize, sort, filters } = store.getState()
    await resource.load({ page, pageSize, sort, filters })
  }

  const controller: ResourceController<T> = {
    store,
    selection,
    getState: store.getState,
    subscribe: store.subscribe,
    load,
    reload: load,
    setPage(page) {
      store.setState((s) => ({ ...s, page }))
      void load()
    },
    setPageSize(size) {
      store.setState((s) => ({ ...s, pageSize: size, page: 1 }))
      void load()
    },
    setSort(sort) {
      // Reset to page 1: the row at a given offset changes under a new sort.
      store.setState((s) => ({ ...s, sort, page: 1 }))
      void load()
    },
    setFilter(key, value) {
      store.setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 }))
      void load()
    },
    clearFilters() {
      store.setState((s) => ({ ...s, filters: {}, page: 1 }))
      void load()
    },
    pageCount() {
      const s = store.getState()
      return computePageCount(s.total, s.pageSize)
    },
    async mutate(action, options) {
      const snapshot = store.getState().rows
      if (options?.optimistic) {
        store.setState((s) => ({ ...s, rows: options.optimistic!(s.rows) }))
      }
      try {
        await action()
      } catch (error) {
        // Roll back the optimistic update, then reload to reconcile with server.
        if (options?.optimistic) store.setState((s) => ({ ...s, rows: snapshot }))
        await load()
        throw error
      }
      if (!options?.skipReload) await load()
    },
  }

  if (config.immediate !== false) void load()

  return controller
}
