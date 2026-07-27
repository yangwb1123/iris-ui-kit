import {
  createDataSource,
  type DataSourceController,
  type DataSourceConfig,
  type DataSourceState,
} from '@iris-ui-kit/core'

export interface UseDataSource<T> extends DataSourceController<T> {
  /**
   * The live data-source state: rows, total, page/pageSize, sort/multiSort,
   * filters/filterRules, loading/loadingMore, hasMore, selectedKeys, and the
   * per-row pendingRows/rowErrors. Backed by a `$state` rune — read it in markup
   * (it re-renders on every store emission).
   */
  readonly state: DataSourceState<T>
}

/**
 * Svelte 5 bridge over the framework-agnostic {@link createDataSource} — the
 * unified data engine (paged/infinite + multi-sort + typed filters + selection +
 * per-row + optimistic mutate). Creates the controller once, kicks the initial
 * load from an effect, bridges its store into a `$state` rune, and returns the
 * controller plus its live `state`. A thin bridge — all logic lives in
 * `@iris-ui-kit/core`. A `.svelte.ts` runes module: call it from a component (runes
 * need a reactive owner).
 *
 * Constructed with `immediate: false` so no fetch fires during setup; the initial
 * load is kicked from an `$effect` and the controller is torn down (aborting any
 * in-flight request) via the effect teardown on unmount, so a late response never
 * writes back.
 */
export function useDataSource<T>(config: DataSourceConfig<T>): UseDataSource<T> {
  // svelte-ignore state_referenced_locally — one-time init read of the config.
  const immediate = config.immediate !== false
  // svelte-ignore state_referenced_locally — construct the controller once.
  const controller = createDataSource({ ...config, immediate: false })

  // Bridge the controller store into a rune so render tracks the live state.
  let state = $state<DataSourceState<T>>(controller.getState())
  $effect(() => {
    return controller.store.subscribe((s) => {
      state = s
    })
  })

  // Kick the initial load on mount; abort any in-flight fetch + detach the
  // controller's internal subscriptions on unmount (a late response must not
  // write back to a torn-down instance).
  $effect(() => {
    if (immediate) void controller.load()
    return () => controller.destroy()
  })

  return {
    ...controller,
    get state() {
      return state
    },
  }
}
