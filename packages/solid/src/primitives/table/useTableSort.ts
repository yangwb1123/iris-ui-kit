import { createSignal, createMemo, type Accessor } from 'solid-js'
import { compareValues } from '@iris-ui/core'
import type { IrisTableColumn, IrisTableSortState } from './types'

export interface UseTableSortOptions<Row> {
  leafColumns: IrisTableColumn<Row>[]
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  onSortChange?: (next: IrisTableSortState | null) => void
}

export interface UseTableSortResult<Row> {
  sortState: Accessor<IrisTableSortState | null>
  cycleSort: (col: IrisTableColumn<Row>) => void
  setSort: (next: IrisTableSortState | null) => void
  sortComparator: Accessor<((a: Row, b: Row) => number) | null>
  sortedData: Accessor<Row[]>
}

/**
 * Solid primitive for table sort state management.
 * Handles controlled/uncontrolled sort, comparator generation, and sorted data.
 */
export function useTableSort<Row extends Record<string, unknown>>(
  data: Accessor<Row[]>,
  options: UseTableSortOptions<Row>,
): UseTableSortResult<Row> {
  const { leafColumns, sort: sortProp, defaultSort, onSortChange } = options

  const [internalSort, setInternalSort] = createSignal<IrisTableSortState | null>(
    defaultSort ?? null,
  )
  const sortControlled = () => sortProp !== undefined
  const sortState: Accessor<IrisTableSortState | null> = createMemo(() =>
    sortProp !== undefined ? (sortProp ?? null) : internalSort(),
  )

  const sortComparator = createMemo<((a: Row, b: Row) => number) | null>(() => {
    const s = sortState()
    if (!s) return null
    const col = leafColumns.find((c) => c.key === s.key)
    if (!col) return null
    const dir = s.direction === 'asc' ? 1 : -1
    const sorter =
      col.sorter ?? ((a: Row, b: Row) => compareValues(getCellValue(a, col), getCellValue(b, col)))
    return (a, b) => sorter(a, b) * dir
  })

  const sortedData = createMemo<Row[]>(() => {
    const compare = sortComparator()
    if (!compare) return data()
    return [...data()].sort(compare)
  })

  function setSort(next: IrisTableSortState | null): void {
    if (!sortControlled()) setInternalSort(next)
    onSortChange?.(next)
  }

  function cycleSort(col: IrisTableColumn<Row>): void {
    if (!col.sortable) return
    const s = sortState()
    if (!s || s.key !== col.key) {
      setSort({ key: col.key, direction: 'asc' })
      return
    }
    if (s.direction === 'asc') {
      setSort({ key: col.key, direction: 'desc' })
      return
    }
    setSort(null)
  }

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
