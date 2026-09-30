import { computed, shallowRef, watch, type ComputedRef } from 'vue'
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

function cloneFilters(
  filters: Readonly<Record<string, string>> | null | undefined,
): Record<string, string> {
  return { ...(filters ?? {}) }
}

function cloneFilterValues(
  filterValues: Readonly<GridFilterValues> | null | undefined,
): GridFilterValues {
  return Object.fromEntries(
    Object.entries(filterValues ?? {}).map(([key, values]) => [key, [...values]]),
  )
}
export interface UseGridFilteringResult {
  model: GridFilteringModel
  filters: ComputedRef<Record<string, string>>
  filterValues: ComputedRef<GridFilterValues>
}
export function useGridFiltering<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridFilteringOptions = {},
): UseGridFilteringResult {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridFilteringModel>(
    core,
    'filtering',
    'getFilteringModel',
    () =>
      createGridFilteringFeature<Row>({
        defaultFilters:
          options.filters !== undefined ? (options.filters ?? {}) : options.defaultFilters,
        defaultFilterValues:
          options.filterValues !== undefined
            ? (options.filterValues ?? {})
            : options.defaultFilterValues,
        onFiltersChange: (v) => latest.value.onFiltersChange?.(v),
        onFilterValuesChange: (v) => latest.value.onFilterValuesChange?.(v),
      }),
  )
  const state = useStore(model.store)
  let wasFiltersControlled = options.filters !== undefined
  let hasUncontrolledFilters = !wasFiltersControlled
  const uncontrolledFilters = shallowRef<Record<string, string>>(
    wasFiltersControlled ? {} : cloneFilters(state.value.filters),
  )
  const lastControlledFilters = shallowRef<Record<string, string>>(cloneFilters(options.filters))
  let wasFilterValuesControlled = options.filterValues !== undefined
  let hasUncontrolledFilterValues = !wasFilterValuesControlled
  const uncontrolledFilterValues = shallowRef<GridFilterValues>(
    wasFilterValuesControlled ? {} : cloneFilterValues(state.value.filterValues),
  )
  const lastControlledFilterValues = shallowRef<GridFilterValues>(
    cloneFilterValues(options.filterValues),
  )

  watch(
    state,
    (current) => {
      if (!wasFiltersControlled) {
        uncontrolledFilters.value = cloneFilters(current.filters)
        hasUncontrolledFilters = true
      }
      if (!wasFilterValuesControlled) {
        uncontrolledFilterValues.value = cloneFilterValues(current.filterValues)
        hasUncontrolledFilterValues = true
      }
    },
    { flush: 'sync' },
  )
  watch(
    () => options.filters,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasFiltersControlled
      wasFiltersControlled = controlled
      if (controlled) {
        // Preserve model updates batched with the transition into control.
        if (!wasControlled) {
          uncontrolledFilters.value = cloneFilters(model.store.getState().filters)
          hasUncontrolledFilters = true
        }
        lastControlledFilters.value = cloneFilters(value)
        model.syncFilters(value ?? {})
      } else if (wasControlled) {
        const restore = hasUncontrolledFilters
          ? uncontrolledFilters.value
          : lastControlledFilters.value
        // A no-op Core sync still establishes the handoff as the next
        // uncontrolled baseline for a later controlled detour.
        uncontrolledFilters.value = cloneFilters(restore)
        hasUncontrolledFilters = true
        model.syncFilters(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => options.filterValues,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasFilterValuesControlled
      wasFilterValuesControlled = controlled
      if (controlled) {
        // Preserve model updates batched with the transition into control.
        if (!wasControlled) {
          uncontrolledFilterValues.value = cloneFilterValues(model.store.getState().filterValues)
          hasUncontrolledFilterValues = true
        }
        lastControlledFilterValues.value = cloneFilterValues(value)
        model.syncFilterValues(value ?? {})
      } else if (wasControlled) {
        const restore = hasUncontrolledFilterValues
          ? uncontrolledFilterValues.value
          : lastControlledFilterValues.value
        // A no-op Core sync still establishes the handoff as the next
        // uncontrolled baseline for a later controlled detour.
        uncontrolledFilterValues.value = cloneFilterValues(restore)
        hasUncontrolledFilterValues = true
        model.syncFilterValues(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  return {
    model,
    filters: computed(() => {
      const value = options.filters
      const current = state.value
      if (value !== undefined) return cloneFilters(value)
      return cloneFilters(
        wasFiltersControlled
          ? hasUncontrolledFilters
            ? uncontrolledFilters.value
            : lastControlledFilters.value
          : current.filters,
      )
    }),
    filterValues: computed(() => {
      const value = options.filterValues
      const current = state.value
      if (value !== undefined) return cloneFilterValues(value)
      return cloneFilterValues(
        wasFilterValuesControlled
          ? hasUncontrolledFilterValues
            ? uncontrolledFilterValues.value
            : lastControlledFilterValues.value
          : current.filterValues,
      )
    }),
  }
}
