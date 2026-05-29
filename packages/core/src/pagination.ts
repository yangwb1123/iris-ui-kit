import { createStore, type Store } from './store'
import type { AsyncStatus } from './async'

/**
 * Framework-agnostic server-side pagination. Drives both UI shapes from one
 * resource: **paged** tables (`goToPage` replaces the visible page) and
 * **infinite** lists (`loadMore` appends the next page). Token-guarded against
 * out-of-order responses, like {@link createAsyncResource}.
 */

export type PaginationMode = 'paged' | 'infinite'

export interface PageQuery {
  /** 1-based page index. */
  page: number
  pageSize: number
}

export interface PageResult<T> {
  items: T[]
  /** Total row count across all pages, when the backend reports it. */
  total?: number
}

export interface PaginatedState<T> {
  status: AsyncStatus
  items: T[]
  /** Last-loaded page (1-based); `0` before the first load. */
  page: number
  pageSize: number
  total: number | undefined
  error: unknown
}

export interface PaginatedResourceConfig {
  pageSize?: number
  /** `'paged'` replaces items per page; `'infinite'` appends via `loadMore`. */
  mode?: PaginationMode
}

export interface PaginatedResource<T> {
  store: Store<PaginatedState<T>>
  getState(): PaginatedState<T>
  subscribe(listener: (state: PaginatedState<T>) => void): () => void
  /** Load `page` and replace the current items (paged tables). */
  goToPage(page: number): Promise<void>
  /** Append the next page (infinite lists). No-op when already loading or done. */
  loadMore(): Promise<void>
  /** Reload from page 1, resetting accumulated items. */
  refresh(): Promise<void>
  /** Change page size and reload from page 1. */
  setPageSize(pageSize: number): Promise<void>
  /** Whether more rows are likely available (by `total`, else full-page heuristic). */
  hasMore(): boolean
}

const DEFAULT_PAGE_SIZE = 20

export function createPaginatedResource<T>(
  fetcher: (query: PageQuery) => Promise<PageResult<T>>,
  config: PaginatedResourceConfig = {},
): PaginatedResource<T> {
  const initialPageSize = config.pageSize ?? DEFAULT_PAGE_SIZE

  const store = createStore<PaginatedState<T>>({
    status: 'idle',
    items: [],
    page: 0,
    pageSize: initialPageSize,
    total: undefined,
    error: undefined,
  })

  let token = 0
  // Size of the most recent batch — drives `hasMore` when `total` is unknown.
  let lastBatchSize = 0

  const hasMore = (): boolean => {
    const { page, total, items, pageSize } = store.getState()
    if (page === 0) return true // nothing loaded yet
    if (total !== undefined) return items.length < total
    return lastBatchSize === pageSize
  }

  const fetchPage = async (targetPage: number, mode: 'replace' | 'append'): Promise<void> => {
    const current = ++token
    const pageSize = store.getState().pageSize
    store.setState((s) => ({ ...s, status: 'loading', error: undefined }))
    try {
      const result = await fetcher({ page: targetPage, pageSize })
      if (current !== token) return // superseded
      lastBatchSize = result.items.length
      store.setState((s) => ({
        ...s,
        status: 'success',
        items: mode === 'append' ? [...s.items, ...result.items] : result.items,
        page: targetPage,
        total: result.total ?? s.total,
        error: undefined,
      }))
    } catch (error) {
      if (current !== token) return // superseded
      store.setState((s) => ({ ...s, status: 'error', error }))
    }
  }

  const refresh = async (): Promise<void> => {
    lastBatchSize = 0
    store.setState((s) => ({ ...s, items: [], page: 0, total: undefined }))
    await fetchPage(1, 'replace')
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    goToPage: (page) => fetchPage(page, 'replace'),
    loadMore: async () => {
      if (store.getState().status === 'loading') return
      if (!hasMore()) return
      await fetchPage(store.getState().page + 1, 'append')
    },
    refresh,
    setPageSize: async (pageSize) => {
      store.setState((s) => ({ ...s, pageSize }))
      await refresh()
    },
    hasMore,
  }
}
