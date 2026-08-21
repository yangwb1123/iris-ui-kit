import { createEffect, createSignal, on, onCleanup, type Accessor } from 'solid-js'
import {
  createRemoteTableSource,
  mergeFormFilters,
  type RemoteTableSource,
  type RemoteTableSourceState,
} from '@iris-ui-kit/core'
import type { IrisTableProps } from './props'
import type { IrisTableSortState } from './types'

const EMPTY_PROXY_STATE: RemoteTableSourceState<never> = {
  data: [],
  total: 0,
  loading: false,
  error: null,
  params: { page: 1, pageSize: 10, sort: null, filters: {} },
}

function mergeFilterValues(
  filters: Record<string, string>,
  filterValues: Record<string, string[]>,
): Record<string, string> {
  const next = { ...filters }
  for (const [key, values] of Object.entries(filterValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

export interface UseTableProxyOptions<Row extends Record<string, unknown>> {
  props: IrisTableProps<Row>
  proxyPresence: Accessor<boolean>
  remoteSort: Accessor<boolean>
  remoteFilter: Accessor<boolean>
  multiSort: boolean
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  multiSortState?: IrisTableSortState[]
  defaultMultiSort?: IrisTableSortState[]
  onProxyChange: (proxy: RemoteTableSource<Row> | null) => void
}

export interface UseTableProxyResult<Row extends Record<string, unknown>> {
  state: Accessor<RemoteTableSourceState<Row>>
}

/** Solid bridge for the framework-free remote table source. */
export function useTableProxy<Row extends Record<string, unknown>>(
  options: UseTableProxyOptions<Row>,
): UseTableProxyResult<Row> {
  const [state, setState] = createSignal<RemoteTableSourceState<Row>>(
    EMPTY_PROXY_STATE as RemoteTableSourceState<Row>,
  )
  let proxy: RemoteTableSource<Row> | null = null
  let unsubscribe: (() => void) | null = null

  createEffect(
    on(options.proxyPresence, (present) => {
      if (!present) {
        unsubscribe?.()
        unsubscribe = null
        proxy?.destroy()
        proxy = null
        options.onProxyChange(null)
        setState(EMPTY_PROXY_STATE as RemoteTableSourceState<Row>)
        return
      }
      if (proxy) return
      const config = options.props.proxyConfig!
      proxy = createRemoteTableSource<Row>({
        query: (params) => options.props.proxyConfig!.query(params),
        autoLoad: false,
        initialParams: {
          page: config.defaultPage ?? 1,
          pageSize: config.pageSize ?? 10,
          sort: options.remoteSort()
            ? ((options.props.sort !== undefined ? options.props.sort : options.defaultSort) ??
              null)
            : null,
          sorts:
            options.remoteSort() && options.multiSort
              ? (options.multiSortState ?? options.defaultMultiSort ?? [])
              : undefined,
          filters: options.remoteFilter()
            ? mergeFilterValues(
                mergeFormFilters(options.props.filters ?? {}, {}),
                options.props.filterValues ?? {},
              )
            : {},
        },
      })
      options.onProxyChange(proxy)
      setState(proxy.getState())
      unsubscribe = proxy.subscribe((snapshot) => setState(snapshot))
      onCleanup(() => {
        unsubscribe?.()
        unsubscribe = null
        proxy?.destroy()
        proxy = null
        options.onProxyChange(null)
      })
      if (config.autoLoad !== false) void proxy.request()
    }),
  )

  return { state }
}
