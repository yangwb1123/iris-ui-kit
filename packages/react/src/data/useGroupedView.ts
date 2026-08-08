import * as React from 'react'
import { createGroupedView, type GroupedViewConfig, type GroupedViewState } from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseGroupedView<Row, K extends string | number = string> {
  /** Subscribable store with the full grouped state. */
  store: ReturnType<typeof createGroupedView<Row, K>>['store']
  /** The composed expansion model (multiple-open) — bridge it like IrisTable does: `useStore(expansion.store)`. */
  expansion: ReturnType<typeof createGroupedView<Row, K>>['expansion']
  /** Set the source rows (re-computes groups and aggregates). */
  setRows: (
    rows: readonly Row[],
    columns?: readonly import('@iris-ui-kit/core').DataViewColumn<Row>[],
  ) => void
  /** Toggle a group's expanded state. */
  toggleGroup: (key: K) => void
  /** Expand a specific group. */
  expandGroup: (key: K) => void
  /** Collapse a specific group. */
  collapseGroup: (key: K) => void
  /** Expand all groups. */
  expandAll: () => void
  /** Collapse all groups. */
  collapseAll: () => void
  /** The live grouped-view state snapshot. */
  state: GroupedViewState<Row, K>
  /** Update config. */
  setConfig: (partial: Partial<GroupedViewConfig<Row, K>>) => void
}

/**
 * React bridge over the framework-agnostic {@link createGroupedView}.
 * Creates the controller once (ref), subscribes to its store, and returns
 * the controller plus its live `state`.
 */
export function useGroupedView<Row, K extends string | number = string>(
  config: GroupedViewConfig<Row, K>,
): UseGroupedView<Row, K> {
  const ref = React.useRef<ReturnType<typeof createGroupedView<Row, K>> | null>(null)
  if (ref.current === null) ref.current = createGroupedView<Row, K>(config)
  const controller = ref.current

  const storeState = useStore(controller.store)
  const state: GroupedViewState<Row, K> = storeState.state

  const setRows = React.useCallback(
    (
      rows: readonly Row[],
      columns?: readonly import('@iris-ui-kit/core').DataViewColumn<Row>[],
    ) => {
      controller.setRows(rows, columns)
    },
    [controller],
  )

  const toggleGroup = React.useCallback((key: K) => controller.toggleGroup(key), [controller])
  const expandGroup = React.useCallback((key: K) => controller.expandGroup(key), [controller])
  const collapseGroup = React.useCallback((key: K) => controller.collapseGroup(key), [controller])
  const expandAll = React.useCallback(() => controller.expandAll(), [controller])
  const collapseAll = React.useCallback(() => controller.collapseAll(), [controller])
  const setConfig = React.useCallback(
    (partial: Partial<GroupedViewConfig<Row, K>>) => controller.setConfig(partial),
    [controller],
  )

  return React.useMemo(
    () => ({
      store: controller.store,
      expansion: controller.expansion,
      setRows,
      toggleGroup,
      expandGroup,
      collapseGroup,
      expandAll,
      collapseAll,
      state,
      setConfig,
    }),
    [
      controller,
      setRows,
      toggleGroup,
      expandGroup,
      collapseGroup,
      expandAll,
      collapseAll,
      state,
      setConfig,
    ],
  )
}
