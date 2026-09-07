import * as React from 'react'
import {
  createTableMultiSortComparator,
  createTableSortComparator,
  resolveTableColumnValue,
  sortTableRows,
} from '@iris-ui-kit/core'
import {
  createGridSortingFeature,
  type GridCore,
  type GridSortingModel,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

export interface GridSortColumn<Row> {
  key: string
  dataIndex?: keyof Row | string
  formula?: string
  sortable?: boolean
  sorter?: (a: Row, b: Row) => number
  sortBy?: string
  sortType?: 'number' | 'string' | 'auto'
}

export interface UseGridSortingOptions<Row> {
  leafColumns: GridSortColumn<Row>[]
  sort?: SortState | null
  defaultSort?: SortState | null
  onSortChange?: (next: SortState | null) => void
  multiSort?: boolean
  multiSortState?: SortState[]
  defaultMultiSort?: SortState[]
  onMultiSortChange?: (next: SortState[]) => void
  formulaTables?: Record<string, Row[]>
}

export interface UseGridSortingResult<Row> {
  core: GridCore
  model: GridSortingModel
  sortState: SortState | null
  cycleSort: (column: GridSortColumn<Row>) => void
  setSort: (next: SortState | null) => void
  sortComparator: ((a: Row, b: Row) => number) | null
  sortedData: Row[]
  multiSortState: SortState[]
  cycleMultiSort: (column: GridSortColumn<Row>) => void
  setMultiSort: (next: SortState[]) => void
  multiSortComparator: ((a: Row, b: Row) => number) | null
}

/** Installs sorting state in Grid Core and derives React column comparators. */
export function useGridSorting<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  data: Row[],
  options: UseGridSortingOptions<Row>,
): UseGridSortingResult<Row> {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridSortingModel>(core, 'sorting', 'getSortingModel', () =>
    createGridSortingFeature<Row>({
      mode: options.multiSort ? 'multiple' : 'single',
      defaultSort: options.sort !== undefined ? options.sort : options.defaultSort,
      defaultMultiSort:
        options.multiSortState !== undefined ? options.multiSortState : options.defaultMultiSort,
      onSortChange: (next) => latest.current.onSortChange?.(next),
      onMultiSortChange: (next) => latest.current.onMultiSortChange?.(next),
    }),
  )
  const internalState = useStore(model.store)
  const sortControlled = options.sort !== undefined
  const multiControlled = options.multiSortState !== undefined
  const sortState = sortControlled ? (options.sort ?? null) : internalState.sort
  const multiSortState = multiControlled ? (options.multiSortState ?? []) : internalState.multiSort

  React.useEffect(() => {
    if (sortControlled) model.syncSort(options.sort ?? null)
  }, [model, options.sort, sortControlled])

  React.useEffect(() => {
    if (multiControlled) model.syncMultiSort(options.multiSortState ?? [])
  }, [model, multiControlled, options.multiSortState])

  const setSort = React.useCallback(
    (next: SortState | null) => {
      if (latest.current.sort !== undefined) model.syncSort(latest.current.sort ?? null)
      model.setSort(next)
    },
    [model],
  )
  const cycleSort = React.useCallback(
    (column: GridSortColumn<Row>) => {
      if (!column.sortable) return
      if (latest.current.sort !== undefined) model.syncSort(latest.current.sort ?? null)
      model.cycleSort(column.key)
    },
    [model],
  )
  const setMultiSort = React.useCallback(
    (next: SortState[]) => {
      if (latest.current.multiSortState !== undefined) {
        model.syncMultiSort(latest.current.multiSortState)
      }
      model.setMultiSort(next)
    },
    [model],
  )
  const cycleMultiSort = React.useCallback(
    (column: GridSortColumn<Row>) => {
      if (!column.sortable) return
      if (latest.current.multiSortState !== undefined) {
        model.syncMultiSort(latest.current.multiSortState)
      }
      model.cycleMultiSort(column.key)
    },
    [model],
  )

  const getValue = React.useCallback(
    (row: Row, column: GridSortColumn<Row>): unknown => {
      if (column.sortBy !== undefined) return row[column.sortBy as keyof Row]
      return resolveTableColumnValue(row, column, options.formulaTables)
    },
    [options.formulaTables],
  )

  const sortComparator = React.useMemo(
    () => createTableSortComparator(sortState, options.leafColumns, getValue),
    [getValue, options.leafColumns, sortState],
  )

  const multiSortComparator = React.useMemo(
    () => createTableMultiSortComparator(multiSortState, options.leafColumns, getValue),
    [getValue, options.leafColumns, multiSortState],
  )

  const sortedData = React.useMemo(
    () =>
      sortTableRows(data, options.leafColumns, {
        mode: options.multiSort ? 'multiple' : 'single',
        sort: sortState,
        multiSort: multiSortState,
        getValue,
      }),
    [data, getValue, multiSortState, options.leafColumns, options.multiSort, sortState],
  )

  return {
    core,
    model,
    sortState,
    cycleSort,
    setSort,
    sortComparator,
    sortedData,
    multiSortState,
    cycleMultiSort,
    setMultiSort,
    multiSortComparator,
  }
}
