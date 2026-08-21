import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import {
  createRemoteTableSource,
  type RemoteTableParams,
  type RemoteTableSource,
  type RemoteTableSourceState,
} from '@iris-ui-kit/core'
import type { IrisTableFilterValues, IrisTableProxyConfig, IrisTableSortState } from './types'

export function mergeFilterValues(
  filters: Record<string, string>,
  filterValues: Record<string, string[]>,
): Record<string, string> {
  const next: Record<string, string> = { ...filters }
  for (const [key, values] of Object.entries(filterValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

export interface UseTableProxyOptions<Row extends Record<string, unknown>> {
  proxyConfig: MaybeRefOrGetter<IrisTableProxyConfig<Row> | undefined>
  remoteSort?: MaybeRefOrGetter<boolean>
  remoteFilter?: MaybeRefOrGetter<boolean>
  multiSort?: MaybeRefOrGetter<boolean | undefined>
  sort?: MaybeRefOrGetter<IrisTableSortState | null | undefined>
  defaultSort?: IrisTableSortState | null
  multiSortState?: MaybeRefOrGetter<IrisTableSortState[] | undefined>
  defaultMultiSort?: IrisTableSortState[] | undefined
  filters?: MaybeRefOrGetter<Record<string, string> | undefined>
  filterValues?: MaybeRefOrGetter<IrisTableFilterValues | undefined>
}

export interface UseTableProxyResult<Row extends Record<string, unknown>> {
  proxy: ComputedRef<RemoteTableSource<Row> | null>
  state: ComputedRef<RemoteTableSourceState<Row>>
  liveData: Ref<Row[]>
  setParams: (partial: Partial<RemoteTableParams>) => boolean
  refetch: () => Promise<void>
}

/** Bridges the framework-free remote source into Vue reactivity. */
export function useTableProxy<Row extends Record<string, unknown>>(
  options: UseTableProxyOptions<Row>,
): UseTableProxyResult<Row> {
  const cfg = computed(() => toValue(options.proxyConfig))
  const queryRef = ref<IrisTableProxyConfig<Row>['query'] | undefined>(undefined)
  watch(
    () => cfg.value?.query,
    (query) => {
      queryRef.value = query
    },
    { immediate: true },
  )

  const proxy = shallowRef<RemoteTableSource<Row> | null>(null)
  const state = shallowRef<RemoteTableSourceState<Row>>({
    data: [],
    total: 0,
    loading: false,
    error: null,
    params: { page: 1, pageSize: 10, sort: null, filters: {} },
  })
  let unsubscribe: (() => void) | null = null
  let mounted = false

  const attach = (ctrl: RemoteTableSource<Row>): void => {
    unsubscribe?.()
    proxy.value = ctrl
    state.value = ctrl.getState()
    unsubscribe = ctrl.subscribe((snapshot) => {
      state.value = snapshot
    })
  }
  const detach = (): void => {
    unsubscribe?.()
    unsubscribe = null
    proxy.value?.destroy()
    proxy.value = null
    state.value = {
      data: [],
      total: 0,
      loading: false,
      error: null,
      params: { page: 1, pageSize: 10, sort: null, filters: {} },
    }
  }

  watch(
    () => cfg.value === undefined,
    (absent) => {
      if (absent) {
        detach()
        return
      }
      if (proxy.value) return
      const config = cfg.value!
      const remoteSort = toValue(options.remoteSort) === true
      const remoteFilter = toValue(options.remoteFilter) === true
      const multiSort = toValue(options.multiSort) === true
      const ctrl = createRemoteTableSource<Row>({
        query: (params) => queryRef.value!(params),
        autoLoad: false,
        initialParams: {
          page: config.defaultPage ?? 1,
          pageSize: config.pageSize ?? 10,
          sort: remoteSort ? (toValue(options.sort) ?? options.defaultSort ?? null) : null,
          sorts:
            remoteSort && multiSort
              ? (toValue(options.multiSortState) ?? options.defaultMultiSort ?? [])
              : undefined,
          filters: remoteFilter
            ? mergeFilterValues(toValue(options.filters) ?? {}, toValue(options.filterValues) ?? {})
            : {},
        },
      })
      attach(ctrl)
      if (mounted && config.autoLoad !== false) void ctrl.request()
    },
    { immediate: true },
  )

  onScopeDispose(detach)
  onMounted(() => {
    mounted = true
    const config = cfg.value
    if (config && proxy.value && config.autoLoad !== false) void proxy.value.request()
  })

  const liveData = shallowRef<Row[]>([])
  watch(
    state,
    (snapshot) => {
      liveData.value = snapshot.data
    },
    { immediate: true },
  )

  return {
    proxy: computed(() => proxy.value),
    state: computed(() => state.value),
    liveData,
    setParams: (partial) => (proxy.value ? proxy.value.setParams(partial) : false),
    refetch: () => (proxy.value ? proxy.value.refetch() : Promise.resolve()),
  }
}
