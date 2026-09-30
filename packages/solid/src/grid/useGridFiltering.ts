import { createEffect, type Accessor } from 'solid-js'
import {
  createGridFilteringFeature,
  type GridCore,
  type GridFilterValues,
  type GridFilteringModel,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

export interface UseGridFilteringOptions {
  filters?: Record<string, string>
  defaultFilters?: Record<string, string>
  onFiltersChange?: (filters: Record<string, string>) => void
  filterValues?: GridFilterValues
  defaultFilterValues?: GridFilterValues
  onFilterValuesChange?: (values: GridFilterValues) => void
}

function cloneFilters(filters: Readonly<Record<string, string>>): Record<string, string> {
  return { ...filters }
}

function cloneFilterValues(filterValues: Readonly<GridFilterValues>): GridFilterValues {
  return Object.fromEntries(Object.entries(filterValues).map(([key, values]) => [key, [...values]]))
}

export function useGridFiltering<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridFilteringOptions = {},
): {
  model: GridFilteringModel
  filters: Accessor<Record<string, string>>
  filterValues: Accessor<GridFilterValues>
} {
  const latest = options
  const model = useGridFeature<Row, GridFilteringModel>(
    core,
    'filtering',
    'getFilteringModel',
    () =>
      createGridFilteringFeature<Row>({
        defaultFilters: options.filters !== undefined ? options.filters : options.defaultFilters,
        defaultFilterValues:
          options.filterValues !== undefined ? options.filterValues : options.defaultFilterValues,
        onFiltersChange: (v) => latest.onFiltersChange?.(v),
        onFilterValuesChange: (v) => latest.onFilterValuesChange?.(v),
      }),
  )
  const state = useStore(model.store)
  let wasFiltersControlled = options.filters !== undefined
  let hasUncontrolledFilters = !wasFiltersControlled
  let uncontrolledFilters = cloneFilters(state().filters)
  let lastControlledFilters = cloneFilters(options.filters ?? {})
  let wasFilterValuesControlled = options.filterValues !== undefined
  let hasUncontrolledFilterValues = !wasFilterValuesControlled
  let uncontrolledFilterValues = cloneFilterValues(state().filterValues)
  let lastControlledFilterValues = cloneFilterValues(options.filterValues ?? {})

  createEffect(() => {
    const filters = options.filters
    const filterValues = options.filterValues
    const filtersControlled = filters !== undefined
    const filterValuesControlled = filterValues !== undefined
    // Read nested fields so reactive prop proxies also observe in-place changes.
    void JSON.stringify(filters)
    void JSON.stringify(filterValues)

    // Capture both filtering channels from the live Core state before either
    // controlled sync runs; the Solid store mirror may still be pre-batch.
    if (
      (filtersControlled && !wasFiltersControlled) ||
      (filterValuesControlled && !wasFilterValuesControlled)
    ) {
      const current = model.store.getState()
      if (filtersControlled && !wasFiltersControlled) {
        uncontrolledFilters = cloneFilters(current.filters)
        hasUncontrolledFilters = true
      }
      if (filterValuesControlled && !wasFilterValuesControlled) {
        uncontrolledFilterValues = cloneFilterValues(current.filterValues)
        hasUncontrolledFilterValues = true
      }
    }

    if (filtersControlled) {
      lastControlledFilters = cloneFilters(filters)
      model.syncFilters(filters)
    } else if (wasFiltersControlled) {
      const restore = hasUncontrolledFilters ? uncontrolledFilters : lastControlledFilters
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledFilters = cloneFilters(restore)
      hasUncontrolledFilters = true
      model.syncFilters(restore)
    }
    if (filterValuesControlled) {
      lastControlledFilterValues = cloneFilterValues(filterValues)
      model.syncFilterValues(filterValues)
    } else if (wasFilterValuesControlled) {
      const restore = hasUncontrolledFilterValues
        ? uncontrolledFilterValues
        : lastControlledFilterValues
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledFilterValues = cloneFilterValues(restore)
      hasUncontrolledFilterValues = true
      model.syncFilterValues(restore)
    }
    wasFiltersControlled = filtersControlled
    wasFilterValuesControlled = filterValuesControlled
  })
  createEffect(() => {
    const current = state()
    if (!wasFiltersControlled) {
      uncontrolledFilters = cloneFilters(current.filters)
      hasUncontrolledFilters = true
    }
    if (!wasFilterValuesControlled) {
      uncontrolledFilterValues = cloneFilterValues(current.filterValues)
      hasUncontrolledFilterValues = true
    }
  })
  return {
    model,
    filters: () => {
      const current = state()
      const filters = options.filters
      if (filters !== undefined) return cloneFilters(filters)
      return cloneFilters(
        wasFiltersControlled
          ? hasUncontrolledFilters
            ? uncontrolledFilters
            : lastControlledFilters
          : current.filters,
      )
    },
    filterValues: () => {
      const current = state()
      const filterValues = options.filterValues
      if (filterValues !== undefined) return cloneFilterValues(filterValues)
      return cloneFilterValues(
        wasFilterValuesControlled
          ? hasUncontrolledFilterValues
            ? uncontrolledFilterValues
            : lastControlledFilterValues
          : current.filterValues,
      )
    },
  }
}
