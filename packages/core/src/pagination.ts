import { createStore, type Store } from './store'
import { createDisposableScope, type Disposable } from './disposable'
import type { AsyncStatus } from './async'

/**
 * Framework-agnostic server-side pagination. Drives both UI shapes from one
 * resource: **paged** tables (`goToPage` replaces the visible page) and
 * **infinite** lists (`loadMore` appends the next page). Token-guarded against
 * out-of-order responses, like {@link createAsyncResource}. Fetchers may declare
 * an optional trailing `AbortSignal`; legacy one-argument fetchers keep their
 * original call shape.
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
  /**
   * `'paged'` replaces items per page; `'infinite'` appends via `loadMore`.
   * Omitting the mode keeps the historical append-on-`loadMore` behavior.
   */
  mode?: PaginationMode
}

export interface PaginatedResource<T> {
  store: Store<PaginatedState<T>>
  getState(): PaginatedState<T>
  subscribe(listener: (state: PaginatedState<T>) => void): () => void
  /** Load `page` and replace the current items (paged tables). */
  goToPage(page: number): Promise<void>
  /**
   * Load the next page. Infinite and omitted modes append; paged mode replaces
   * the visible page. No-op when already loading, exhausted, or disposed.
   */
  loadMore(): Promise<void>
  /** Reload from page 1, resetting accumulated items. */
  refresh(): Promise<void>
  /** Change page size and reload from page 1. */
  setPageSize(pageSize: number): Promise<void>
  /** Whether more rows are available by total or the full-page heuristic. */
  hasMore(): boolean
}

/**
 * The factory's lifecycle-aware surface. The legacy resource remains
 * implementable by existing consumers; created resources also support
 * cancellation and disposal.
 */
export interface AdvancedPaginatedResource<T> extends PaginatedResource<T>, Disposable {
  /** Abort the active request and make a cancelled load retryable. */
  cancel(): void
}

const DEFAULT_PAGE_SIZE = 20

/**
 * Page and page-size inputs use one fail-safe normalization policy: finite
 * positive values are truncated to a safe integer of at least one; non-positive,
 * non-finite, or unsafe values fall back to the current value (or the
 * default/page one when there is no current value). Thus no request can carry
 * an invalid query or overflow when advancing a page.
 */
function positiveInteger(value: number | undefined, fallback: number): number {
  const safeFallback = Number.isSafeInteger(fallback) && fallback > 0 ? fallback : 1
  if (value === undefined || !Number.isFinite(value) || value <= 0) return safeFallback

  const truncated = Math.trunc(value)
  return Number.isSafeInteger(truncated) && truncated >= 1 ? truncated : safeFallback
}

function isPageResult<T>(value: unknown): value is PageResult<T> {
  if (typeof value !== 'object' || value === null) return false
  const result = value as { items?: unknown; total?: unknown }
  return (
    Array.isArray(result.items) &&
    (result.total === undefined ||
      (typeof result.total === 'number' && Number.isSafeInteger(result.total) && result.total >= 0))
  )
}

export function createPaginatedResource<T>(
  fetcher: (query: PageQuery, signal?: AbortSignal) => Promise<PageResult<T>>,
  config: PaginatedResourceConfig = {},
): AdvancedPaginatedResource<T> {
  const initialPageSize = positiveInteger(config.pageSize, DEFAULT_PAGE_SIZE)
  const mode = config.mode

  const store = createStore<PaginatedState<T>>({
    status: 'idle',
    items: [],
    page: 0,
    pageSize: initialPageSize,
    total: undefined,
    error: undefined,
  })

  const scope = createDisposableScope()
  let token = 0
  // Size of the most recent batch — drives `hasMore` when `total` is unknown.
  let lastBatchSize = 0
  let controller: AbortController | null = null

  const abortInFlight = (): void => {
    const activeController = controller
    controller = null
    activeController?.abort()
  }

  // AbortController is deliberately best-effort. The generation token remains
  // authoritative on runtimes (including SSR) without AbortController.
  scope.add(() => {
    token += 1
    abortInFlight()
  })

  const hasMore = (): boolean => {
    const { page, total, pageSize } = store.getState()
    if (page === 0) return true // nothing loaded yet

    if (total !== undefined) {
      // Account for the page offset. This also keeps `hasMore` correct if an
      // infinite resource is explicitly navigated with `goToPage`, which
      // replaces (rather than appends) the visible page.
      const loaded = (page - 1) * pageSize + lastBatchSize
      return loaded < total
    }

    return lastBatchSize === pageSize
  }

  const fetchPage = async (targetPage: number, operation: 'replace' | 'append'): Promise<void> => {
    if (scope.disposed) return

    const current = ++token
    abortInFlight()
    // An abort listener may synchronously start a newer operation. Do not
    // allocate a controller for, or otherwise overwrite, that newer request.
    if (current !== token || scope.disposed) return
    const page = positiveInteger(targetPage, 1)
    const pageSize = positiveInteger(store.getState().pageSize, DEFAULT_PAGE_SIZE)
    const query: PageQuery = { page, pageSize }
    const hasAbortController = typeof AbortController !== 'undefined'
    const ac = hasAbortController ? new AbortController() : null
    controller = ac
    store.setState((s) => ({ ...s, status: 'loading', error: undefined }))
    if (current !== token || scope.disposed) return
    try {
      // Preserve one-argument call behavior while allowing a fetcher that
      // declares the optional second parameter to receive the signal.
      const result = await (ac !== null ? fetcher(query, ac.signal) : fetcher(query))
      if (current !== token || scope.disposed) return // superseded or destroyed
      if (!isPageResult<T>(result)) {
        throw new TypeError('Pagination fetcher must return { items: T[], total?: number }')
      }
      lastBatchSize = result.items.length
      controller = null
      store.setState((s) => ({
        ...s,
        status: 'success',
        // Own the backend array in both modes; a caller must not be able to
        // mutate the resource by retaining and changing its result array.
        items: operation === 'append' ? [...s.items, ...result.items] : [...result.items],
        page,
        total: result.total ?? s.total,
        error: undefined,
      }))
    } catch (error) {
      if (current !== token || scope.disposed) return // superseded or destroyed
      controller = null
      store.setState((s) => ({ ...s, status: 'error', error }))
    }
  }

  const cancel = (): void => {
    if (scope.disposed) return
    token += 1
    abortInFlight()
    // `idle` is the retryable cancellation state. Keep visible page data
    // intact, but do not leave `loadMore` blocked by a stale `loading` status.
    if (store.getState().status === 'loading') {
      store.setState((s) => ({ ...s, status: 'idle', error: undefined }))
    }
  }

  const refresh = async (): Promise<void> => {
    if (scope.disposed) return
    const current = ++token
    abortInFlight()
    lastBatchSize = 0
    store.setState((s) => ({ ...s, items: [], page: 0, total: undefined }))
    // A subscriber may start a newer operation while the reset is emitted.
    if (current !== token || scope.disposed) return
    await fetchPage(1, 'replace')
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    goToPage: (requestedPage) => {
      const currentPage = positiveInteger(store.getState().page, 1)
      return fetchPage(positiveInteger(requestedPage, currentPage), 'replace')
    },
    loadMore: async () => {
      if (scope.disposed) return
      const state = store.getState()
      if (state.status === 'loading') return
      if (!hasMore()) return
      await fetchPage(positiveInteger(state.page + 1, 1), mode === 'paged' ? 'replace' : 'append')
    },
    refresh,
    setPageSize: async (requestedPageSize) => {
      if (scope.disposed) return
      const currentPageSize = positiveInteger(store.getState().pageSize, DEFAULT_PAGE_SIZE)
      const pageSize = positiveInteger(requestedPageSize, currentPageSize)
      const current = token
      store.setState((s) => ({ ...s, pageSize }))
      // A synchronous subscriber can start a newer load while observing the
      // page-size change; that load must not be superseded by our refresh.
      if (current !== token || scope.disposed) return
      await refresh()
    },
    hasMore,
    cancel,
    destroy: () => {
      scope.destroy()
    },
    get disposed() {
      return scope.disposed
    },
  }
}
