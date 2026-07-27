import { createMemo, type Accessor } from 'solid-js'
import { createGroupedView, type GroupedViewConfig, type GroupedViewState } from '@iris-ui-kit/core'
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
  /** The live grouped-view state as a Solid accessor — call `state()` to read. */
  state: Accessor<GroupedViewState<Row, K>>
  setConfig: (partial: Partial<GroupedViewConfig<Row, K>>) => void
}

/**
 * Solid bridge over the framework-agnostic {@link createGroupedView}.
 * Creates the controller once (module-level singleton) and bridges the store
 * into Solid reactivity via {@link useStore}.
 */
export function useGroupedView<Row, K = string>(
  config: GroupedViewConfig<Row, K>,
): UseGroupedView<Row, K> {
  const controller = createGroupedView<Row, K>(config)
  const storeState = useStore(controller.store)
  const state = createMemo(() => storeState().state)

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
