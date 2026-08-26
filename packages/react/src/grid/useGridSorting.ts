import * as React from 'react'
import { compareValues, memoizedFormulaValue } from '@iris-ui-kit/core'
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

function buildSorter<Row extends Record<string, unknown>>(
  column: GridSortColumn<Row>,
  formulaTables?: Record<string, Row[]>,
): (a: Row, b: Row) => number {
  if (column.sorter) return column.sorter
  return (a, b) => {
    if (column.formula) {
      let left = memoizedFormulaValue(column.formula, a, formulaTables)
      let right = memoizedFormulaValue(column.formula, b, formulaTables)
      if (column.sortType === 'number') {
        left = Number(left)
        right = Number(right)
      } else if (column.sortType === 'string') {
        left = String(left ?? '')
        right = String(right ?? '')
      }
      return compareValues(left, right)
    }
    const key = (column.sortBy ?? column.dataIndex ?? column.key) as keyof Row
    let left = a[key] as unknown
    let right = b[key] as unknown
    if (column.sortType === 'number') {
      left = Number(left)
      right = Number(right)
    } else if (column.sortType === 'string') {
      left = String(left ?? '')
      right = String(right ?? '')
    }
    return compareValues(left, right)
  }
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

  const sortComparator = React.useMemo<((a: Row, b: Row) => number) | null>(() => {
    if (!sortState) return null
    const column = options.leafColumns.find((candidate) => candidate.key === sortState.key)
    if (!column) return null
    const direction = sortState.direction === 'asc' ? 1 : -1
    const sorter = buildSorter(column, options.formulaTables)
    return (a, b) => sorter(a, b) * direction
  }, [options.leafColumns, sortState, options.formulaTables])

  const multiSortComparator = React.useMemo<((a: Row, b: Row) => number) | null>(() => {
    if (multiSortState.length === 0) return null
    const columns = new Map(options.leafColumns.map((column) => [column.key, column]))
    const chain = multiSortState.flatMap((sort) => {
      const column = columns.get(sort.key)
      return column
        ? [
            {
              direction: sort.direction === 'asc' ? 1 : -1,
              sorter: buildSorter(column, options.formulaTables),
            },
          ]
        : []
    })
    if (chain.length === 0) return null
    return (a, b) => {
      for (const step of chain) {
        const comparison = step.sorter(a, b)
        if (comparison !== 0) return comparison * step.direction
      }
      return 0
    }
  }, [options.leafColumns, multiSortState, options.formulaTables])

  const sortedData = React.useMemo(() => {
    const comparator = options.multiSort ? multiSortComparator : sortComparator
    return comparator ? [...data].sort(comparator) : data
  }, [data, options.multiSort, multiSortComparator, sortComparator])

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
