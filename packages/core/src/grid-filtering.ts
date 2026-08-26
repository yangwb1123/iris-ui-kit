import { createStore, type Store } from './store'
import type { GridFeature, GridMethod } from './grid'

export type GridFilterValues = Record<string, string[]>

export interface GridFilteringState {
  readonly filters: Record<string, string>
  readonly filterValues: GridFilterValues
}

export type GridFilteringChange =
  | { readonly channel: 'filters'; readonly filters: Readonly<Record<string, string>> }
  | { readonly channel: 'values'; readonly filterValues: Readonly<GridFilterValues> }

export const GRID_FILTERING_CHANGE_EVENT = 'filtering:change'

export interface GridFilteringFeatureOptions {
  readonly defaultFilters?: Readonly<Record<string, string>>
  readonly defaultFilterValues?: Readonly<GridFilterValues>
  readonly onFiltersChange?: (filters: Record<string, string>) => void
  readonly onFilterValuesChange?: (filterValues: GridFilterValues) => void
}

export interface GridFilteringModel {
  readonly store: Store<GridFilteringState>
  get(): GridFilteringState
  setFilters(filters: Readonly<Record<string, string>>): void
  syncFilters(filters: Readonly<Record<string, string>>): void
  setFilter(key: string, value: string): void
  clearFilter(key: string): void
  setFilterValues(filterValues: Readonly<GridFilterValues>): void
  syncFilterValues(filterValues: Readonly<GridFilterValues>): void
  setColumnFilterValues(key: string, values: readonly string[]): void
  clearColumnFilterValues(key: string): void
  clear(): void
}

export interface GridFilteringMethods {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getFilteringModel(): GridFilteringModel
  getFilters(): Record<string, string>
  setFilters(filters: Record<string, string>): void
  syncFilters(filters: Record<string, string>): void
  setFilter(key: string, value: string): void
  clearFilter(key: string): void
  getFilterValues(): GridFilterValues
  setFilterValues(filterValues: GridFilterValues): void
  syncFilterValues(filterValues: GridFilterValues): void
  setColumnFilterValues(key: string, values: string[]): void
  clearColumnFilterValues(key: string): void
  clearAllFilters(): void
}

function cloneFilters(filters: Readonly<Record<string, string>>): Record<string, string> {
  return { ...filters }
}

function cloneFilterValues(filterValues: Readonly<GridFilterValues>): GridFilterValues {
  return Object.fromEntries(Object.entries(filterValues).map(([key, values]) => [key, [...values]]))
}

function sameFilters(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.is(left[key], right[key]))
  )
}

function sameFilterValues(
  left: Readonly<GridFilterValues>,
  right: Readonly<GridFilterValues>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        right[key] !== undefined &&
        left[key]!.length === right[key]!.length &&
        left[key]!.every((value, index) => Object.is(value, right[key]![index])),
    )
  )
}

function stateSnapshot(state: GridFilteringState): GridFilteringState {
  return {
    filters: cloneFilters(state.filters),
    filterValues: cloneFilterValues(state.filterValues),
  }
}

/** Filtering state model shared by framework bridges and imperative methods. */
export function createGridFilteringModel(
  options: GridFilteringFeatureOptions = {},
  emit?: (change: GridFilteringChange) => void,
): GridFilteringModel {
  const store = createStore<GridFilteringState>({
    filters: cloneFilters(options.defaultFilters ?? {}),
    filterValues: cloneFilterValues(options.defaultFilterValues ?? {}),
  })

  const commitFilters = (filters: Readonly<Record<string, string>>, notify: boolean): void => {
    const next = cloneFilters(filters)
    store.setState((state) => ({ ...state, filters: next }))
    if (!notify) return
    options.onFiltersChange?.(cloneFilters(next))
    emit?.({ channel: 'filters', filters: cloneFilters(next) })
  }

  const commitFilterValues = (values: Readonly<GridFilterValues>, notify: boolean): void => {
    const next = cloneFilterValues(values)
    store.setState((state) => ({ ...state, filterValues: next }))
    if (!notify) return
    options.onFilterValuesChange?.(cloneFilterValues(next))
    emit?.({ channel: 'values', filterValues: cloneFilterValues(next) })
  }

  return {
    store,
    get: () => stateSnapshot(store.getState()),
    setFilters: (filters) => commitFilters(filters, true),
    syncFilters: (filters) => {
      if (!sameFilters(store.getState().filters, filters)) commitFilters(filters, false)
    },
    setFilter(key, value) {
      commitFilters({ ...store.getState().filters, [key]: value }, true)
    },
    clearFilter(key) {
      const next = cloneFilters(store.getState().filters)
      delete next[key]
      commitFilters(next, true)
    },
    setFilterValues: (values) => commitFilterValues(values, true),
    syncFilterValues: (values) => {
      if (!sameFilterValues(store.getState().filterValues, values)) {
        commitFilterValues(values, false)
      }
    },
    setColumnFilterValues(key, values) {
      commitFilterValues({ ...store.getState().filterValues, [key]: [...values] }, true)
    },
    clearColumnFilterValues(key) {
      const next = cloneFilterValues(store.getState().filterValues)
      delete next[key]
      commitFilterValues(next, true)
    },
    clear() {
      const next: GridFilteringState = { filters: {}, filterValues: {} }
      store.setState(next)
      options.onFiltersChange?.({})
      emit?.({ channel: 'filters', filters: {} })
      options.onFilterValuesChange?.({})
      emit?.({ channel: 'values', filterValues: {} })
    },
  }
}

/** Built-in filtering capability: text/value channels, methods, and events. */
export function createGridFilteringFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(options: GridFilteringFeatureOptions = {}): GridFeature<Row> {
  return {
    name: 'filtering',
    setup(context) {
      const model = createGridFilteringModel(options, (change) =>
        context.emit(GRID_FILTERING_CHANGE_EVENT, change),
      )
      const methods: GridFilteringMethods = {
        getFilteringModel: () => model,
        getFilters: () => cloneFilters(model.get().filters),
        setFilters: (filters) => model.setFilters(filters),
        syncFilters: (filters) => model.syncFilters(filters),
        setFilter: (key, value) => model.setFilter(key, value),
        clearFilter: (key) => model.clearFilter(key),
        getFilterValues: () => cloneFilterValues(model.get().filterValues),
        setFilterValues: (values) => model.setFilterValues(values),
        syncFilterValues: (values) => model.syncFilterValues(values),
        setColumnFilterValues: (key, values) => model.setColumnFilterValues(key, values),
        clearColumnFilterValues: (key) => model.clearColumnFilterValues(key),
        clearAllFilters: () => model.clear(),
      }
      return { methods: methods as unknown as Readonly<Record<string, GridMethod>> }
    },
  }
}
