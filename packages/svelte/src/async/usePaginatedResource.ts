import { readable, derived, type Readable } from 'svelte/store'
import { onMount } from 'svelte'
import {
  createPaginatedResource,
  type PageQuery,
  type PageResult,
  type PaginatedResource,
  type PaginatedState,
  type PaginationMode,
} from '@iris-ui/core'

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
  goToPage: PaginatedResource<T>['goToPage']
  loadMore: PaginatedResource<T>['loadMore']
  refresh: PaginatedResource<T>['refresh']
  setPageSize: PaginatedResource<T>['setPageSize']
}

/**
 * Svelte binding for paginated resources.
 */
export function usePaginatedResource<T>(
  fetcher: (query: PageQuery) => Promise<PageResult<T>>,
  options: UsePaginatedResourceOptions = {},
): UsePaginatedResourceReturn<T> {
  const resource = createPaginatedResource<T>(fetcher, {
    pageSize: options.pageSize,
    mode: options.mode,
  })

  const state = readable<PaginatedState<T>>(resource.getState(), (set) => {
    return resource.subscribe(set)
  })

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
  }
}
