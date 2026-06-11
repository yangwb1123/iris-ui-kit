import * as React from 'react'
import {
  createDataSource,
  type DataSourceController,
  type DataSourceConfig,
  type DataSourceState,
} from '@iris-ui/core'
import { useStore } from '../useStore'

export interface UseDataSource<T> extends DataSourceController<T> {
  /**
   * The live data-source state: rows, total, page/pageSize, sort/multiSort,
   * filters/filterRules, loading/loadingMore, hasMore, selectedKeys, and the
   * per-row pendingRows/rowErrors.
   */
  state: DataSourceState<T>
}

/**
 * React bridge over the framework-agnostic {@link createDataSource} — the unified
 * data engine (paged/infinite + multi-sort + typed filters + selection +
 * per-row + optimistic mutate). Creates the controller once, subscribes to its
 * store, and returns the controller plus its live `state`. A thin bridge — all
 * logic lives in `@iris-ui/core`.
 *
 * Constructed with `immediate: false` so no fetch fires during render; the
 * initial load is kicked from an effect and the controller is torn down on
 * unmount (aborting any in-flight request) so a late response never writes back.
 */
export function useDataSource<T>(config: DataSourceConfig<T>): UseDataSource<T> {
  const ref = React.useRef<DataSourceController<T> | null>(null)
  if (ref.current === null) ref.current = createDataSource({ ...config, immediate: false })
  const controller = ref.current
  const immediate = config.immediate !== false

  React.useEffect(() => {
    if (immediate) void controller.load()
    return () => controller.destroy()
  }, [controller, immediate])

  const state = useStore(controller.store)
  return React.useMemo(() => ({ ...controller, state }), [controller, state])
}
