import {
  computed,
  isRef,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
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
 *
 * The fetcher may be reactive — pass `ref(fetcher)` or `computed(() => fetcher)`
 * and the *current* closure is used on every page load (`goToPage`/`loadMore`/
 * `refresh`). Updating it does NOT auto-refetch; trigger a load yourself:
 *
 * ```ts
 * const p = usePaginatedResource(computed(() => api.listUsers(props.id)))
 * watch(() => props.id, () => void p.refresh())
 * ```
 *
 * A bare getter `() => fetcher` is indistinguishable from a plain fetcher and
 * is treated as one — use `computed`/`ref` for reactive fetchers.
 */
export function usePaginatedResource<T>(
  fetcher: MaybeRefOrGetter<(query: PageQuery) => Promise<PageResult<T>>>,
  options: UsePaginatedResourceOptions = {},
): UsePaginatedResourceReturn<T> {
  // Plain-object holder (the Vue analog of React's `latest.current` ref):
  // core only ever sees the wrapper below, which re-reads `holder.current` at
  // call time — so every page load (and `refresh`'s replay) uses the fresh
  // closure for the component's whole lifetime.
  const holder: { current: (query: PageQuery) => Promise<PageResult<T>> } = {
    // isRef-only resolution. NEVER toValue() here: the element type is itself
    // a function, so toValue(fetcher) would *invoke the fetcher at setup*
    // (spurious request) and toValue(getter) would do the same. isRef narrows
    // to the only unambiguous reactive form: ref(fetcher) / computed(() =>
    // fetcher) / shallowRef(fetcher) — a ComputedRef IS a Ref.
    // F3 elision point — the ONE explicit narrowing cast: after the isRef
    // guard the else arm is `F | (() => F)`, and the bare-getter arm's return
    // `F` (a function) is not assignable to `F` (TS2322). No runtime
    // discriminant distinguishes a plain fetcher from a bare getter (both are
    // functions), so the cast encodes exactly the documented F3 ambiguity and
    // adds no unsafety beyond F3.
    current: (isRef(fetcher) ? fetcher.value : fetcher) as (
      query: PageQuery,
    ) => Promise<PageResult<T>>,
  }
  if (isRef(fetcher)) {
    // Ref sources only. watch(fn, cb) would treat a plain function source as a
    // getter: evaluate it once at setup (spurious fetcher invocation) and track
    // its deps. flush: 'sync' (precedent useAdminShell.ts:67) guarantees a
    // page load in the same tick as the ref assignment sees the new closure.
    // Plain-object holder => the swap is not reactive, no re-render.
    watch(
      fetcher,
      (next) => {
        holder.current = next
      },
      { flush: 'sync' },
    )
  }

  const resource = createPaginatedResource<T>((query) => holder.current(query), {
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
