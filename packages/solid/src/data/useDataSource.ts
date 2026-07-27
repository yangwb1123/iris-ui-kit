import { createEffect, onCleanup, type Accessor } from 'solid-js'
import {
  createDataSource,
  type DataSourceController,
  type DataSourceConfig,
  type DataSourceState,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseDataSource<T> extends DataSourceController<T> {
  /**
   * The live data-source state as a Solid accessor — call `state()` to read:
   * rows, total, page/pageSize, sort/multiSort, filters/filterRules,
   * loading/loadingMore, hasMore, selectedKeys, and the per-row
   * pendingRows/rowErrors.
   */
  state: Accessor<DataSourceState<T>>
}

/**
 * Solid bridge over the framework-agnostic {@link createDataSource} — the unified
 * data engine (paged/infinite + multi-sort + typed filters + selection +
 * per-row + optimistic mutate). Creates the controller once (a Solid component
 * body runs once), subscribes to its store via {@link useStore}, and returns the
 * controller plus its live `state` accessor. A thin bridge — all logic lives in
 * `@iris-ui-kit/core`.
 *
 * Constructed with `immediate: false` so no fetch fires synchronously during
 * setup; the initial load is kicked from an effect (when `immediate`), and the
 * controller is torn down on cleanup (aborting any in-flight request) so a late
 * response never writes back to a disposed instance.
 */
export function useDataSource<T>(config: DataSourceConfig<T>): UseDataSource<T> {
  const controller = createDataSource({ ...config, immediate: false })
  const immediate = config.immediate !== false

  createEffect(() => {
    if (immediate) void controller.load()
  })
  // Abort any in-flight fetch + detach the controller's internal subscriptions
  // on unmount (a late response must not write back to a torn-down instance).
  onCleanup(() => controller.destroy())

  const state = useStore(controller.store)
  return { ...controller, state }
}
