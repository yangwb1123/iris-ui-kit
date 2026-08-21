import * as React from 'react'
import {
  createRemoteTableSource,
  type ParsedTableQuery,
  type RemoteTableSource,
  type RemoteTableSourceState,
} from '@iris-ui-kit/core'
import type { IrisTableProxyConfig } from './props'
import type { IrisTableFilterValues, IrisTableSortState } from './types'
import { mergeFilterValues, mergeQueryIntoFilters } from './table-query-helpers'

const EMPTY_PROXY_STATE: RemoteTableSourceState<never> = {
  data: [],
  total: 0,
  loading: false,
  error: null,
  params: { page: 1, pageSize: 10, sort: null, filters: {} },
}
const noopSubscribe = (): (() => void) => () => {}

export interface UseTableProxyOptions<Row extends Record<string, unknown>> {
  proxyConfig?: IrisTableProxyConfig<Row>
  remoteSort: boolean
  remoteFilter: boolean
  sortProp?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  multiSort?: boolean
  multiSortState?: IrisTableSortState[]
  defaultMultiSort?: IrisTableSortState[]
  filters?: Record<string, string>
  filterValues?: IrisTableFilterValues
  queryParsed: ParsedTableQuery
  loading: boolean
  error: boolean
  onRetry?: () => void
}

export interface UseTableProxyResult<Row extends Record<string, unknown>> {
  proxyRef: React.MutableRefObject<RemoteTableSource<Row> | null>
  createProxySource: () => RemoteTableSource<Row>
  proxy: RemoteTableSource<Row> | null
  proxyState: RemoteTableSourceState<Row>
  tableLoading: boolean
  tableError: boolean
  retry?: () => void
}

/** React bridge for the framework-free remote table source. */
export function useTableProxy<Row extends Record<string, unknown>>(
  options: UseTableProxyOptions<Row>,
): UseTableProxyResult<Row> {
  const queryRef = React.useRef<IrisTableProxyConfig<Row>['query'] | undefined>(undefined)
  queryRef.current = options.proxyConfig?.query

  const createProxySource = (): RemoteTableSource<Row> =>
    createRemoteTableSource<Row>({
      query: (params) => queryRef.current!(params),
      autoLoad: false,
      initialParams: {
        page: options.proxyConfig?.defaultPage ?? 1,
        pageSize: options.proxyConfig?.pageSize ?? 10,
        sort: options.remoteSort
          ? ((options.sortProp !== undefined ? options.sortProp : options.defaultSort) ?? null)
          : null,
        sorts:
          options.remoteSort && options.multiSort
            ? (options.multiSortState ?? options.defaultMultiSort ?? [])
            : undefined,
        filters: options.remoteFilter
          ? mergeQueryIntoFilters(
              mergeFilterValues(options.filters ?? {}, options.filterValues ?? {}),
              options.queryParsed,
            )
          : {},
      },
    })

  const proxyRef = React.useRef<RemoteTableSource<Row> | null>(null)
  if (options.proxyConfig && proxyRef.current === null) {
    proxyRef.current = createProxySource()
  }
  const proxy = options.proxyConfig ? proxyRef.current : null
  const proxyState = React.useSyncExternalStore(
    proxy ? proxy.subscribe : noopSubscribe,
    proxy ? proxy.getState : ((() => EMPTY_PROXY_STATE) as () => RemoteTableSourceState<Row>),
    proxy ? proxy.getState : ((() => EMPTY_PROXY_STATE) as () => RemoteTableSourceState<Row>),
  )
  const handleRetry = React.useCallback(() => {
    void proxyRef.current?.refetch()
    options.onRetry?.()
  }, [options.onRetry])

  return {
    proxyRef,
    createProxySource,
    proxy,
    proxyState,
    tableLoading: proxy ? proxyState.loading : options.loading,
    tableError: proxy ? proxyState.error !== null : options.error,
    retry: proxy ? handleRetry : options.onRetry,
  }
}
