import { createStore, type Store } from './store'
import { createAsyncResource } from './async'
import { createSelectionModel, type SelectionModel } from './selection'
import { pageCount as computePageCount } from './data-view'

/**
 * Framework-agnostic CRUD resource controller (L4 composite) — the canonical
 * admin "data list" abstraction, composed from already-sunk core primitives:
 * server loading via {@link createAsyncResource} (token-guarded), selection via
 * {@link createSelectionModel}, and the {@link pageCount} helper. Scoped minimal
 * per the re-layering plan (list + pagination + selection + refresh + mutate);
 * grows from here. The adapter is a pure table/list render over `controller`.
 */
export interface ResourceQuery {
  page: number
  pageSize: number
}

export interface ResourceControllerConfig<T> {
  /** Fetch one page. */
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
  loading: boolean
  error: unknown
  selectedKeys: string[]
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
  pageCount(): number
  /** Run a create/update/delete side-effect, then reload the current page. */
  mutate(action: () => Promise<unknown>): Promise<void>
}

export function createResourceController<T>(
  config: ResourceControllerConfig<T>,
): ResourceController<T> {
  const store = createStore<ResourceState<T>>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: config.pageSize ?? 10,
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
    const { page, pageSize } = store.getState()
    await resource.load({ page, pageSize })
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
    pageCount() {
      const s = store.getState()
      return computePageCount(s.total, s.pageSize)
    },
    async mutate(action) {
      await action()
      await load()
    },
  }

  if (config.immediate !== false) void load()

  return controller
}
