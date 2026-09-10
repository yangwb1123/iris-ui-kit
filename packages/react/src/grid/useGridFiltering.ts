import * as React from 'react'
import { filterTableRows, mergeFormFilters, type FilterRule } from '@iris-ui-kit/core'
import {
  createGridFilteringFeature,
  type GridCore,
  type GridFilteringModel,
  type GridFilterValues,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

export interface GridFilterColumn<Row> {
  key: string
  filterMethod?: (value: unknown, row: Row, filterValue: string) => boolean
}

export interface GridFilterQuery {
  readonly filters: Readonly<Record<string, string>>
  readonly inValues: Readonly<Record<string, readonly string[]>>
  readonly rules: readonly FilterRule[]
}

export interface UseGridFilteringOptions<
  Row,
  Column extends GridFilterColumn<Row> = GridFilterColumn<Row>,
> {
  columns: Column[]
  getValue: (row: Row, column: Column) => unknown
  filters?: Record<string, string>
  defaultFilters?: Record<string, string>
  onFiltersChange?: (filters: Record<string, string>) => void
  filterValues?: GridFilterValues
  defaultFilterValues?: GridFilterValues
  onFilterValuesChange?: (filterValues: GridFilterValues) => void
  /** Treat missing filter props as controlled empty maps. */
  controlled?: boolean
  formFilters?: Record<string, string>
  query?: GridFilterQuery
  proxy?: boolean
  remote?: boolean
}

export interface UseGridFilteringResult<Row> {
  core: GridCore
  model: GridFilteringModel
  filters: Record<string, string>
  filterValues: GridFilterValues
  filteredData: Row[]
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

/** Installs filtering state in Grid Core and derives the React row view. */
export function useGridFiltering<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Column extends GridFilterColumn<Row> = GridFilterColumn<Row>,
>(
  core: GridCore<Row>,
  data: Row[],
  options: UseGridFilteringOptions<Row, Column>,
): UseGridFilteringResult<Row> {
  const latest = React.useRef(options)
  latest.current = options
  const filtersControlled = options.controlled === true || options.filters !== undefined
  const valuesControlled = options.controlled === true || options.filterValues !== undefined

  const model = useGridFeature<Row, GridFilteringModel>(
    core,
    'filtering',
    'getFilteringModel',
    () =>
      createGridFilteringFeature<Row>({
        defaultFilters: filtersControlled ? (options.filters ?? {}) : options.defaultFilters,
        defaultFilterValues: valuesControlled
          ? (options.filterValues ?? {})
          : options.defaultFilterValues,
        onFiltersChange: (next) => latest.current.onFiltersChange?.(next),
        onFilterValuesChange: (next) => latest.current.onFilterValuesChange?.(next),
      }),
  )
  const internalState = useStore(model.store)
  // React dependency checks cannot observe mutations made through a stable prop
  // reference. Recompute these signatures on every render so controlled sync
  // remains content-sensitive without changing the Core model contract.
  const filtersSignature = JSON.stringify(options.filters)
  const filterValuesSignature = JSON.stringify(options.filterValues)
  const wasFiltersControlled = React.useRef(filtersControlled)
  const uncontrolledFilters = React.useRef<Record<string, string>>({})
  const hasUncontrolledFilters = React.useRef(!filtersControlled)
  const lastControlledFilters = React.useRef<Record<string, string>>(cloneFilters(options.filters))
  const wasFilterValuesControlled = React.useRef(valuesControlled)
  const uncontrolledFilterValues = React.useRef<GridFilterValues>({})
  const hasUncontrolledFilterValues = React.useRef(!valuesControlled)
  const lastControlledFilterValues = React.useRef<GridFilterValues>(
    cloneFilterValues(options.filterValues),
  )
  const leavingFiltersControlled = wasFiltersControlled.current && !filtersControlled
  const leavingFilterValuesControlled = wasFilterValuesControlled.current && !valuesControlled

  // Capture only genuine uncontrolled state. A rejected controlled proposal may
  // be ahead of the prop in the model, so it must not become the handoff value.
  if (!filtersControlled && !leavingFiltersControlled) {
    uncontrolledFilters.current = cloneFilters(internalState.filters)
    hasUncontrolledFilters.current = true
  }
  if (!valuesControlled && !leavingFilterValuesControlled) {
    uncontrolledFilterValues.current = cloneFilterValues(internalState.filterValues)
    hasUncontrolledFilterValues.current = true
  }
  // Capture model updates batched with the transition into controlled mode.
  if (filtersControlled && !wasFiltersControlled.current) {
    uncontrolledFilters.current = cloneFilters(internalState.filters)
    hasUncontrolledFilters.current = true
  }
  if (valuesControlled && !wasFilterValuesControlled.current) {
    uncontrolledFilterValues.current = cloneFilterValues(internalState.filterValues)
    hasUncontrolledFilterValues.current = true
  }
  if (filtersControlled) lastControlledFilters.current = cloneFilters(options.filters)
  if (valuesControlled) {
    lastControlledFilterValues.current = cloneFilterValues(options.filterValues)
  }

  const filters = cloneFilters(
    filtersControlled
      ? options.filters
      : leavingFiltersControlled
        ? hasUncontrolledFilters.current
          ? uncontrolledFilters.current
          : lastControlledFilters.current
        : internalState.filters,
  )
  const filterValues = cloneFilterValues(
    valuesControlled
      ? options.filterValues
      : leavingFilterValuesControlled
        ? hasUncontrolledFilterValues.current
          ? uncontrolledFilterValues.current
          : lastControlledFilterValues.current
        : internalState.filterValues,
  )

  React.useEffect(() => {
    if (filtersControlled) {
      const next = cloneFilters(options.filters)
      lastControlledFilters.current = cloneFilters(next)
      model.syncFilters(next)
    } else if (wasFiltersControlled.current) {
      const restore = hasUncontrolledFilters.current
        ? uncontrolledFilters.current
        : lastControlledFilters.current
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledFilters.current = cloneFilters(restore)
      hasUncontrolledFilters.current = true
      model.syncFilters(restore)
    }
    wasFiltersControlled.current = filtersControlled
  }, [filtersControlled, model, options.filters, filtersSignature])

  React.useEffect(() => {
    if (valuesControlled) {
      const next = cloneFilterValues(options.filterValues)
      lastControlledFilterValues.current = cloneFilterValues(next)
      model.syncFilterValues(next)
    } else if (wasFilterValuesControlled.current) {
      const restore = hasUncontrolledFilterValues.current
        ? uncontrolledFilterValues.current
        : lastControlledFilterValues.current
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledFilterValues.current = cloneFilterValues(restore)
      hasUncontrolledFilterValues.current = true
      model.syncFilterValues(restore)
    }
    wasFilterValuesControlled.current = valuesControlled
  }, [model, options.filterValues, valuesControlled, filterValuesSignature])

  const filteredData = React.useMemo(() => {
    if (options.remote) return data
    const merged = options.proxy
      ? { ...filters }
      : mergeFormFilters(filters, options.formFilters ?? {})
    for (const [key, value] of Object.entries(options.query?.filters ?? {})) {
      if (value !== '') merged[key] = value
    }
    return filterTableRows(data, options.columns, {
      getValue: options.getValue,
      filters: merged,
      filterValues,
      additionalFilterValues: options.query?.inValues ? [options.query.inValues] : undefined,
      filterRules: options.query?.rules,
    })
  }, [
    data,
    filterValues,
    filters,
    options.columns,
    options.formFilters,
    options.getValue,
    options.proxy,
    options.query,
    options.remote,
  ])

  return { core, model, filters, filterValues, filteredData }
}
