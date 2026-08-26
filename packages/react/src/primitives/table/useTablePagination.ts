import type { MutableRefObject } from 'react'
import type { RemoteTableSource, RemoteTableSourceState } from '@iris-ui-kit/core'
import type { GridCore } from '@iris-ui-kit/core/grid'
import {
  toGridPaginationOptions,
  useGridPagination,
  type LegacyGridPaginationProxyConfig,
  type UseGridPaginationResult,
} from '../../grid'

/** Connect the legacy proxy request lifecycle to the standard pagination feature. */
export function useTablePagination<Row extends Record<string, unknown>>(
  core: GridCore<Row>,
  proxyState: RemoteTableSourceState<Row> | null,
  proxyConfig: LegacyGridPaginationProxyConfig | undefined,
  proxyRef: MutableRefObject<RemoteTableSource<Row> | null>,
): UseGridPaginationResult {
  return useGridPagination(
    core,
    toGridPaginationOptions({
      proxyConfig,
      state: proxyState
        ? {
            page: proxyState.params.page,
            pageSize: proxyState.params.pageSize,
            total: proxyState.total,
          }
        : undefined,
      request: (next) => proxyRef.current?.setParams(next),
    }),
  )
}
