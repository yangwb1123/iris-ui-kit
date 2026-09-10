import * as React from 'react'
import {
  createPaginatedResource,
  type PageQuery,
  type PageResult,
  type AdvancedPaginatedResource,
  type PaginatedState,
  type PaginationMode,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UsePaginatedResourceOptions {
  pageSize?: number
  mode?: PaginationMode
  /** Load the first page on mount (page 1, or `loadMore` in infinite mode). */
  immediate?: boolean
}

export interface UsePaginatedResourceReturn<T> extends PaginatedState<T> {
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  goToPage: AdvancedPaginatedResource<T>['goToPage']
  loadMore: AdvancedPaginatedResource<T>['loadMore']
  refresh: AdvancedPaginatedResource<T>['refresh']
  setPageSize: AdvancedPaginatedResource<T>['setPageSize']
  cancel: AdvancedPaginatedResource<T>['cancel']
}

/**
 * React binding for the server-side pagination resource. Instantiates once and
 * bridges via `useSyncExternalStore`; the fetcher is read through a ref so it
 * never goes stale.
 *
 * ```tsx
 * const p = usePaginatedResource((q) => api.rows(q), { pageSize: 25, immediate: true })
 * <IrisTable data={p.items} loading={p.isLoading} error={p.isError} />
 * <IrisPagination total={p.total ?? 0} value={p.page} onValueChange={p.goToPage} />
 * ```
 */
export function usePaginatedResource<T>(
  fetcher: (query: PageQuery, signal?: AbortSignal) => Promise<PageResult<T>>,
  options: UsePaginatedResourceOptions = {},
): UsePaginatedResourceReturn<T> {
  const latest = React.useRef(fetcher)
  latest.current = fetcher

  const ref = React.useRef<AdvancedPaginatedResource<T> | null>(null)
  if (ref.current === null) {
    ref.current = createPaginatedResource<T>(
      (query, signal) => {
        const current = latest.current
        return signal === undefined ? current(query) : current(query, signal)
      },
      {
        pageSize: options.pageSize,
        mode: options.mode,
      },
    )
  }
  const resource = ref.current
  const state = useStore(resource.store)

  const initial = React.useRef({ immediate: options.immediate ?? false, mode: options.mode })
  React.useEffect(() => {
    if (initial.current.immediate) {
      void (initial.current.mode === 'infinite' ? resource.loadMore() : resource.goToPage(1))
    }
    return () => resource.cancel()
  }, [resource])

  return {
    ...state,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    // `state` drives the re-render; hasMore() then reads the fresh batch state.
    hasMore: resource.hasMore(),
    goToPage: resource.goToPage,
    loadMore: resource.loadMore,
    refresh: resource.refresh,
    setPageSize: resource.setPageSize,
    cancel: resource.cancel,
  }
}
