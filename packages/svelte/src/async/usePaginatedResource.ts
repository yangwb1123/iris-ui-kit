import { readable, derived, type Readable } from 'svelte/store'
import { onDestroy, onMount } from 'svelte'
import {
  createPaginatedResource,
  type PageQuery,
  type PageResult,
  type AdvancedPaginatedResource,
  type PaginatedState,
  type PaginationMode,
} from '@iris-ui-kit/core'

export interface UsePaginatedResourceOptions {
  pageSize?: number
  mode?: PaginationMode
  immediate?: boolean
}

export interface UsePaginatedResourceReturn<T> {
  status: Readable<PaginatedState<T>['status']>
  items: Readable<T[]>
  page: Readable<number>
  pageSize: Readable<number>
  total: Readable<number | undefined>
  error: Readable<unknown>
  isLoading: Readable<boolean>
  isError: Readable<boolean>
  hasMore: Readable<boolean>
  goToPage: AdvancedPaginatedResource<T>['goToPage']
  loadMore: AdvancedPaginatedResource<T>['loadMore']
  refresh: AdvancedPaginatedResource<T>['refresh']
  setPageSize: AdvancedPaginatedResource<T>['setPageSize']
  cancel: AdvancedPaginatedResource<T>['cancel']
}

/**
 * Svelte binding for paginated resources.
 */
export function usePaginatedResource<T>(
  fetcher: (query: PageQuery, signal?: AbortSignal) => Promise<PageResult<T>>,
  options: UsePaginatedResourceOptions = {},
): UsePaginatedResourceReturn<T> {
  const resource = createPaginatedResource<T>(fetcher, {
    pageSize: options.pageSize,
    mode: options.mode,
  })

  const state = readable<PaginatedState<T>>(resource.getState(), (set) => {
    return resource.subscribe(set)
  })

  onDestroy(() => resource.cancel())

  if (options.immediate) {
    onMount(() => {
      void (options.mode === 'infinite' ? resource.loadMore() : resource.goToPage(1))
    })
  }

  return {
    status: derived(state, ($s) => $s.status),
    items: derived(state, ($s) => $s.items),
    page: derived(state, ($s) => $s.page),
    pageSize: derived(state, ($s) => $s.pageSize),
    total: derived(state, ($s) => $s.total),
    error: derived(state, ($s) => $s.error),
    isLoading: derived(state, ($s) => $s.status === 'loading'),
    isError: derived(state, ($s) => $s.status === 'error'),
    hasMore: derived(state, () => resource.hasMore()),
    goToPage: resource.goToPage,
    loadMore: resource.loadMore,
    refresh: resource.refresh,
    setPageSize: resource.setPageSize,
    cancel: resource.cancel,
  }
}
