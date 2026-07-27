import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
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
  /** Load the first page on mount (page 1, or `loadMore` in infinite mode). */
  immediate?: boolean
}

export interface UsePaginatedResourceReturn<T> {
  status: ComputedRef<PaginatedState<T>['status']>
  items: ComputedRef<T[]>
  page: ComputedRef<number>
  pageSize: ComputedRef<number>
  total: ComputedRef<number | undefined>
  error: ComputedRef<unknown>
  isLoading: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  hasMore: ComputedRef<boolean>
  goToPage: PaginatedResource<T>['goToPage']
  loadMore: PaginatedResource<T>['loadMore']
  refresh: PaginatedResource<T>['refresh']
  setPageSize: PaginatedResource<T>['setPageSize']
}

/**
 * Vue binding for the server-side pagination resource. Created in `setup()`
 * (fetcher closure stays live) and bridged to computed refs.
 */
export function usePaginatedResource<T>(
  fetcher: (query: PageQuery) => Promise<PageResult<T>>,
  options: UsePaginatedResourceOptions = {},
): UsePaginatedResourceReturn<T> {
  const resource = createPaginatedResource<T>(fetcher, {
    pageSize: options.pageSize,
    mode: options.mode,
  })

  const state = ref(resource.getState()) as Ref<PaginatedState<T>>
  const unsubscribe = resource.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  if (options.immediate) {
    onMounted(() => {
      void (options.mode === 'infinite' ? resource.loadMore() : resource.goToPage(1))
    })
  }

  return {
    status: computed(() => state.value.status),
    items: computed(() => state.value.items),
    page: computed(() => state.value.page),
    pageSize: computed(() => state.value.pageSize),
    total: computed(() => state.value.total),
    error: computed(() => state.value.error),
    isLoading: computed(() => state.value.status === 'loading'),
    isError: computed(() => state.value.status === 'error'),
    // Touch state so this recomputes on every store change; hasMore() then
    // reads the resource's fresh internal batch state.
    hasMore: computed(() => {
      void state.value
      return resource.hasMore()
    }),
    goToPage: resource.goToPage,
    loadMore: resource.loadMore,
    refresh: resource.refresh,
    setPageSize: resource.setPageSize,
  }
}
