import { cycleSort as nextSort, type SortState } from './data-view'
import { createStore, type Store } from './store'
import type { GridFeature, GridMethod } from './grid'

export type GridSortingMode = 'single' | 'multiple'

export interface GridSortingState {
  readonly sort: SortState | null
  readonly multiSort: SortState[]
}

export type GridSortingChange =
  | { readonly mode: 'single'; readonly sort: SortState | null }
  | { readonly mode: 'multiple'; readonly sorts: readonly SortState[] }

export const GRID_SORTING_CHANGE_EVENT = 'sorting:change'

export interface GridSortingFeatureOptions {
  readonly mode?: GridSortingMode
  readonly defaultSort?: SortState | null
  readonly defaultMultiSort?: readonly SortState[]
  readonly onSortChange?: (sort: SortState | null) => void
  readonly onMultiSortChange?: (sorts: SortState[]) => void
}

export interface GridSortingModel {
  readonly mode: GridSortingMode
  readonly store: Store<GridSortingState>
  get(): GridSortingState
  setSort(sort: SortState | null): void
  syncSort(sort: SortState | null): void
  cycleSort(key: string): void
  setMultiSort(sorts: readonly SortState[]): void
  syncMultiSort(sorts: readonly SortState[]): void
  cycleMultiSort(key: string): void
  clear(): void
}

export interface GridSortingMethods {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getSortingModel(): GridSortingModel
  getSort(): SortState | null
  setSort(sort: SortState | null): void
  syncSort(sort: SortState | null): void
  cycleSort(key: string): void
  getMultiSort(): SortState[]
  setMultiSort(sorts: SortState[]): void
  syncMultiSort(sorts: SortState[]): void
  cycleMultiSort(key: string): void
  clearSort(): void
}

function cloneSort(sort: SortState | null): SortState | null {
  return sort ? { ...sort } : null
}

function cloneSorts(sorts: readonly SortState[]): SortState[] {
  return sorts.map((sort) => ({ ...sort }))
}

function sameSort(left: SortState | null, right: SortState | null): boolean {
  return left?.key === right?.key && left?.direction === right?.direction
}

function sameSorts(left: readonly SortState[], right: readonly SortState[]): boolean {
  return (
    left.length === right.length &&
    left.every((sort, index) => sameSort(sort, right[index] ?? null))
  )
}

function stateSnapshot(state: GridSortingState): GridSortingState {
  return { sort: cloneSort(state.sort), multiSort: cloneSorts(state.multiSort) }
}

/** Sorting state machine used by the Grid feature and framework bridges. */
export function createGridSortingModel(
  options: GridSortingFeatureOptions = {},
  emit?: (change: GridSortingChange) => void,
): GridSortingModel {
  const mode = options.mode ?? 'single'
  const store = createStore<GridSortingState>({
    sort: cloneSort(options.defaultSort ?? null),
    multiSort: cloneSorts(options.defaultMultiSort ?? []),
  })

  const commitSort = (sort: SortState | null, notify: boolean): void => {
    const next = cloneSort(sort)
    store.setState((state) => ({ ...state, sort: next }))
    if (!notify) return
    options.onSortChange?.(cloneSort(next))
    emit?.({ mode: 'single', sort: cloneSort(next) })
  }

  const commitMultiSort = (sorts: readonly SortState[], notify: boolean): void => {
    const next = cloneSorts(sorts)
    store.setState((state) => ({ ...state, multiSort: next }))
    if (!notify) return
    options.onMultiSortChange?.(cloneSorts(next))
    emit?.({ mode: 'multiple', sorts: cloneSorts(next) })
  }

  const model: GridSortingModel = {
    mode,
    store,
    get: () => stateSnapshot(store.getState()),
    setSort: (sort) => commitSort(sort, true),
    syncSort: (sort) => {
      if (!sameSort(store.getState().sort, sort)) commitSort(sort, false)
    },
    cycleSort: (key) => commitSort(nextSort(store.getState().sort, key), true),
    setMultiSort: (sorts) => commitMultiSort(sorts, true),
    syncMultiSort: (sorts) => {
      if (!sameSorts(store.getState().multiSort, sorts)) commitMultiSort(sorts, false)
    },
    cycleMultiSort(key) {
      const current = store.getState().multiSort
      const index = current.findIndex((sort) => sort.key === key)
      if (index < 0) {
        commitMultiSort([...current, { key, direction: 'asc' }], true)
        return
      }
      const next = cloneSorts(current)
      if (next[index]!.direction === 'asc') {
        next[index] = { key, direction: 'desc' }
      } else {
        next.splice(index, 1)
      }
      commitMultiSort(next, true)
    },
    clear() {
      if (mode === 'multiple') commitMultiSort([], true)
      else commitSort(null, true)
    },
  }
  return model
}

/** Built-in sorting capability: single/multi state, methods, and one event. */
export function createGridSortingFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(options: GridSortingFeatureOptions = {}): GridFeature<Row> {
  return {
    name: 'sorting',
    setup(context) {
      const model = createGridSortingModel(options, (change) =>
        context.emit(GRID_SORTING_CHANGE_EVENT, change),
      )
      const featureMethods: GridSortingMethods = {
        getSortingModel: () => model,
        getSort: () => cloneSort(model.get().sort),
        setSort: (sort) => model.setSort(sort),
        syncSort: (sort) => model.syncSort(sort),
        cycleSort: (key) => model.cycleSort(key),
        getMultiSort: () => cloneSorts(model.get().multiSort),
        setMultiSort: (sorts) => model.setMultiSort(sorts),
        syncMultiSort: (sorts) => model.syncMultiSort(sorts),
        cycleMultiSort: (key) => model.cycleMultiSort(key),
        clearSort: () => model.clear(),
      }
      return {
        methods: featureMethods as unknown as Readonly<Record<string, GridMethod>>,
      }
    },
  }
}

export type { SortState }
