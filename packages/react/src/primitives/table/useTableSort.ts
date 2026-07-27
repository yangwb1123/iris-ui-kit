import * as React from 'react'
import { compareValues } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableSortState } from './types'

/**
 * Options for {@link useTableSort}.
 */
export interface UseTableSortOptions<Row> {
  /** Flat list of leaf columns (no grouping wrapper). */
  leafColumns: IrisTableColumn<Row>[]
  /** Controlled sort state. */
  sort?: IrisTableSortState | null
  /** Default sort (uncontrolled). */
  defaultSort?: IrisTableSortState | null
  /** Called when the sort changes. */
  onSortChange?: (next: IrisTableSortState | null) => void
}

/**
 * Result of {@link useTableSort}.
 */
export interface UseTableSortResult<Row> {
  /** Current sort state (controlled if a `sort` prop was provided, else internal). */
  sortState: IrisTableSortState | null
  /** Cycle a column: asc → desc → none. */
  cycleSort: (col: IrisTableColumn<Row>) => void
  /** Directly set the sort state. */
  setSort: (next: IrisTableSortState | null) => void
  /** Memoized comparator derived from the current sort. Null when no sort is active. */
  sortComparator: ((a: Row, b: Row) => number) | null
  /** Sorted data using the active comparator. Falls back to the original data. */
  sortedData: Row[]
}

/**
 * Extract and manage table sort state, comparator, and sorted data.
 *
 * Handles both controlled (`sort` prop) and uncontrolled (`defaultSort`) modes.
 * Produces a memoized comparator from the sort column's `sorter` or a default
 * value-based comparator, and a stable sorted copy of the data.
 *
 * @example
 * ```tsx
 * const { sortState, cycleSort, sortedData } = useTableSort({
 *   leafColumns,
 *   sort: props.sort,
 *   defaultSort: props.defaultSort,
 *   onSortChange: props.onSortChange,
 * })
 * ```
 */
export function useTableSort<Row extends Record<string, unknown>>(
  data: Row[],
  options: UseTableSortOptions<Row>,
): UseTableSortResult<Row> {
  const { leafColumns, sort: sortProp, defaultSort, onSortChange } = options

  // Internal state for uncontrolled mode
  const sortControlled = sortProp !== undefined
  const [sortInternal, setSortInternal] = React.useState<IrisTableSortState | null>(
    defaultSort ?? null,
  )
  const sortState = sortControlled ? (sortProp ?? null) : sortInternal

  // Memoized comparator
  const sortComparator = React.useMemo<((a: Row, b: Row) => number) | null>(() => {
    if (!sortState) return null
    const col = leafColumns.find((c) => c.key === sortState.key)
    if (!col) return null
    const dir = sortState.direction === 'asc' ? 1 : -1
    const sorter =
      col.sorter ?? ((a: Row, b: Row) => compareValues(getCellValue(a, col), getCellValue(b, col)))
    return (a, b) => sorter(a, b) * dir
  }, [leafColumns, sortState])

  // Sorted data
  const sortedData = React.useMemo(() => {
    if (!sortComparator) return data
    return [...data].sort(sortComparator)
  }, [data, sortComparator])

  const setSort = React.useCallback(
    (next: IrisTableSortState | null) => {
      if (!sortControlled) setSortInternal(next)
      onSortChange?.(next)
    },
    [sortControlled, onSortChange],
  )

  const cycleSort = React.useCallback(
    (col: IrisTableColumn<Row>) => {
      if (!col.sortable) return
      if (!sortState || sortState.key !== col.key) {
        setSort({ key: col.key, direction: 'asc' })
        return
      }
      if (sortState.direction === 'asc') {
        setSort({ key: col.key, direction: 'desc' })
        return
      }
      setSort(null)
    },
    [sortState, setSort],
  )

  return {
    sortState,
    cycleSort,
    setSort,
    sortComparator,
    sortedData,
  }
}

/** Get the value for a column from a row (handles dataIndex fallback). */
function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}
