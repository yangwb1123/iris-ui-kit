import { onMounted, onScopeDispose, type ShallowRef } from 'vue'
import {
  createDataSource,
  type DataSourceController,
  type DataSourceConfig,
  type DataSourceState,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseDataSource<T> extends DataSourceController<T> {
  /**
   * The live data-source state as a reactive ref: rows, total, page/pageSize,
   * sort/multiSort, filters/filterRules, loading/loadingMore, hasMore,
   * selectedKeys, and the per-row pendingRows/rowErrors.
   */
  state: ShallowRef<DataSourceState<T>>
}

/**
 * Vue bridge over the framework-agnostic {@link createDataSource} — the unified
 * data engine (paged/infinite + multi-sort + typed filters + selection +
 * per-row + optimistic mutate). Creates the controller once in `setup()`,
 * mirrors its store into a reactive ref, and returns the controller plus its
 * live `state`. A thin bridge — all logic lives in `@iris-ui-kit/core`.
 *
 * Constructed with `immediate: false` so no fetch fires during `setup()`; the
 * initial load is kicked from `onMounted` and the controller is torn down on
 * scope dispose (aborting any in-flight request) so a late response never
 * writes back to a torn-down instance.
 */
export function useDataSource<T>(config: DataSourceConfig<T>): UseDataSource<T> {
  const controller = createDataSource({ ...config, immediate: false })
  const immediate = config.immediate !== false

  onMounted(() => {
    if (immediate) void controller.load()
  })
  // Abort any in-flight fetch + detach the controller's internal subscriptions
  // on unmount (a late response must not write back to a torn-down instance).
  onScopeDispose(() => controller.destroy())

  const state = useStore(controller.store)
  return { ...controller, state }
}
