import { createSignal, onCleanup, onMount, type Accessor } from 'solid-js'
import {
  createPaginatedResource,
  type PageQuery,
  type PageResult,
  type PaginatedResource,
  type PaginatedState,
  type PaginationMode,
} from '@iris-ui-kit/core'

export interface UsePaginatedResourceOptions {
  pageSize?: number
  mode?: PaginationMode
  /** Load the first page on mount. */
  immediate?: boolean
}

export interface UsePaginatedResourceReturn<T> {
  status: Accessor<PaginatedState<T>['status']>
  items: Accessor<T[]>
  page: Accessor<number>
  pageSize: Accessor<number>
  total: Accessor<number | undefined>
  error: Accessor<unknown>
  isLoading: Accessor<boolean>
  isError: Accessor<boolean>
  hasMore: Accessor<boolean>
  goToPage: PaginatedResource<T>['goToPage']
  loadMore: PaginatedResource<T>['loadMore']
  refresh: PaginatedResource<T>['refresh']
  setPageSize: PaginatedResource<T>['setPageSize']
}

/**
 * Solid binding for the server-side pagination resource.
 */
export function usePaginatedResource<T>(
  fetcher: (query: PageQuery) => Promise<PageResult<T>>,
  options: UsePaginatedResourceOptions = {},
): UsePaginatedResourceReturn<T> {
  const resource = createPaginatedResource<T>(fetcher, {
    pageSize: options.pageSize,
    mode: options.mode,
  })

  const [state, setState] = createSignal<PaginatedState<T>>(resource.getState())
  const unsubscribe = resource.subscribe((next) => {
    setState(next as PaginatedState<T>)
  })
  onCleanup(unsubscribe)

  if (options.immediate) {
    onMount(() => {
      void (options.mode === 'infinite' ? resource.loadMore() : resource.goToPage(1))
    })
  }

  return {
    status: () => state().status,
    items: () => state().items,
    page: () => state().page,
    pageSize: () => state().pageSize,
    total: () => state().total,
    error: () => state().error,
    isLoading: () => state().status === 'loading',
    isError: () => state().status === 'error',
    hasMore: () => {
      void state() // touch state for reactivity
      return resource.hasMore()
    },
    goToPage: resource.goToPage,
    loadMore: resource.loadMore,
    refresh: resource.refresh,
    setPageSize: resource.setPageSize,
  }
}
