import { computed, type ComputedRef } from 'vue'
import {
  createGroupedView,
  type GroupedViewConfig,
  type GroupedViewState,
  type GroupedViewStore,
} from '@iris-ui-kit/core'
import type { DataViewColumn } from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseGroupedView<Row, K = string> {
  store: ReturnType<typeof createGroupedView<Row, K>>['store']
  setRows: (rows: readonly Row[], columns?: readonly DataViewColumn<Row>[]) => void
  toggleGroup: (key: K) => void
  expandGroup: (key: K) => void
  collapseGroup: (key: K) => void
  expandAll: () => void
  collapseAll: () => void
  /** Reactive live grouped-view state. */
  state: ComputedRef<GroupedViewState<Row, K>>
  setConfig: (partial: Partial<GroupedViewConfig<Row, K>>) => void
}

/**
 * Vue bridge over the framework-agnostic {@link createGroupedView}.
 * Creates the controller once, subscribes its store to a reactive ref,
 * and returns the controller plus a computed `state`.
 */
export function useGroupedView<Row, K = string>(
  config: GroupedViewConfig<Row, K>,
): UseGroupedView<Row, K> {
  const controller = createGroupedView<Row, K>(config)
  const storeRef = useStore(controller.store)
  const state = computed(() => {
    const s = storeRef.value as GroupedViewStore<Row, K>
    return s.state
  })

  return {
    store: controller.store,
    setRows: (rows, columns) => controller.setRows(rows, columns),
    toggleGroup: (key) => controller.toggleGroup(key),
    expandGroup: (key) => controller.expandGroup(key),
    collapseGroup: (key) => controller.collapseGroup(key),
    expandAll: () => controller.expandAll(),
    collapseAll: () => controller.collapseAll(),
    state,
    setConfig: (partial) => controller.setConfig(partial),
  }
}
