import { createGroupedView, type GroupedViewConfig, type GroupedViewState } from '@iris-ui-kit/core'
import type { DataViewColumn } from '@iris-ui-kit/core'

export interface UseGroupedView<Row, K extends string | number = string> {
  store: ReturnType<typeof createGroupedView<Row, K>>['store']
  /** The composed expansion model (multiple-open) — bridge it like a Svelte Table: `useStore(expansion.store)`. */
  expansion: ReturnType<typeof createGroupedView<Row, K>>['expansion']
  setRows: (rows: readonly Row[], columns?: readonly DataViewColumn<Row>[]) => void
  toggleGroup: (key: K) => void
  expandGroup: (key: K) => void
  collapseGroup: (key: K) => void
  expandAll: () => void
  collapseAll: () => void
  /** Live grouped-view state — read it in markup (re-renders on every store emission). */
  readonly state: GroupedViewState<Row, K>
  setConfig: (partial: Partial<GroupedViewConfig<Row, K>>) => void
}

/**
 * Svelte 5 bridge over the framework-agnostic {@link createGroupedView}.
 * Creates the controller once, bridges its store into a `$state` rune,
 * and returns the controller plus the reactive `state`. A `.svelte.ts` runes
 * module: call it from a component (runes need a reactive owner).
 */
export function useGroupedView<Row, K extends string | number = string>(
  config: GroupedViewConfig<Row, K>,
): UseGroupedView<Row, K> {
  // svelte-ignore state_referenced_locally — construct the controller once.
  const controller = createGroupedView<Row, K>(config)

  // Bridge the controller store into a rune so render tracks the live state.
  let state = $state<GroupedViewState<Row, K>>(controller.store.getState().state)
  $effect(() => {
    const unsub = controller.store.subscribe((next) => {
      state = next.state
    })
    return unsub
  })

  return {
    store: controller.store,
    expansion: controller.expansion,
    setRows: (rows, columns) => controller.setRows(rows, columns),
    toggleGroup: (key) => controller.toggleGroup(key),
    expandGroup: (key) => controller.expandGroup(key),
    collapseGroup: (key) => controller.collapseGroup(key),
    expandAll: () => controller.expandAll(),
    collapseAll: () => controller.collapseAll(),
    get state() {
      return state
    },
    setConfig: (partial) => controller.setConfig(partial),
  }
}
