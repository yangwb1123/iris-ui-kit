import * as React from 'react'
import { matchesRule, mergeFormFilters, type FilterRule } from '@iris-ui-kit/core'
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

  const model = useGridFeature<Row, GridFilteringModel>(
    core,
    'filtering',
    'getFilteringModel',
    () =>
      createGridFilteringFeature<Row>({
        defaultFilters: options.filters ?? options.defaultFilters,
        defaultFilterValues: options.filterValues ?? options.defaultFilterValues,
        onFiltersChange: (next) => latest.current.onFiltersChange?.(next),
        onFilterValuesChange: (next) => latest.current.onFilterValuesChange?.(next),
      }),
  )
  const internalState = useStore(model.store)
  const filtersControlled = options.controlled === true || options.filters !== undefined
  const valuesControlled = options.controlled === true || options.filterValues !== undefined
  const filters = filtersControlled ? (options.filters ?? {}) : internalState.filters
  const filterValues = valuesControlled ? (options.filterValues ?? {}) : internalState.filterValues

  React.useEffect(() => {
    if (filtersControlled) model.syncFilters(options.filters ?? {})
  }, [filtersControlled, model, options.filters])

  React.useEffect(() => {
    if (valuesControlled) model.syncFilterValues(options.filterValues ?? {})
  }, [model, options.filterValues, valuesControlled])

  const filteredData = React.useMemo(() => {
    if (options.remote) return data
    const merged = options.proxy
      ? { ...filters }
      : mergeFormFilters(filters, options.formFilters ?? {})
    for (const [key, value] of Object.entries(options.query?.filters ?? {})) {
      if (value !== '') merged[key] = value
    }
    const active = Object.entries(merged).filter(([, value]) => value != null && value !== '')
    const checked = Object.entries(filterValues).filter(([, values]) => values.length > 0)
    const queryValues = Object.entries(options.query?.inValues ?? {}).filter(
      ([, values]) => values.length > 0,
    )
    const rules = options.query?.rules ?? []
    if (
      active.length === 0 &&
      checked.length === 0 &&
      queryValues.length === 0 &&
      rules.length === 0
    ) {
      return data
    }

    const columns = new Map(options.columns.map((column) => [column.key, column]))
    return data.filter((row) => {
      const textMatches = active.every(([key, value]) => {
        const column = columns.get(key)
        if (!column) return true
        const raw = options.getValue(row, column)
        return column.filterMethod
          ? column.filterMethod(raw, row, value)
          : String(raw ?? '')
              .toLowerCase()
              .includes(value.toLowerCase())
      })
      const valuesMatch = checked.every(([key, values]) => {
        const column = columns.get(key)
        return !column || values.includes(String(options.getValue(row, column) ?? ''))
      })
      const queryValuesMatch = queryValues.every(([key, values]) => {
        const column = columns.get(key)
        return !column || values.includes(String(options.getValue(row, column) ?? ''))
      })
      const rulesMatch = rules.every((rule) => {
        const column = columns.get(rule.key)
        return !column || matchesRule(options.getValue(row, column), rule)
      })
      return textMatches && valuesMatch && queryValuesMatch && rulesMatch
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
