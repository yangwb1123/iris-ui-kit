import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { compareValues } from '@iris-ui/core'
import { getCellValue } from './useTableState'
import type { IrisTableColumn, IrisTableSortState } from './types'

export interface UseTableSortOptions<Row> {
  leafColumns: IrisTableColumn<Row>[] | ComputedRef<IrisTableColumn<Row>[]>
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  onSortChange?: (next: IrisTableSortState | null) => void
}

export interface UseTableSortResult<Row> {
  sortState: ComputedRef<IrisTableSortState | null>
  cycleSort: (col: IrisTableColumn<Row>) => void
  setSort: (next: IrisTableSortState | null) => void
  sortComparator: ComputedRef<((a: Row, b: Row) => number) | null>
  sortedData: ComputedRef<Row[]>
}

/**
 * Vue composable for table sort state management.
 * Handles controlled/uncontrolled sort, comparator generation, and sorted data.
 */
export function useTableSort<Row extends Record<string, unknown>>(
  data: Ref<Row[]>,
  options: UseTableSortOptions<Row>,
): UseTableSortResult<Row> {
  const { sort: sortProp, defaultSort, onSortChange } = options

  // Unwrap leafColumns (supports both plain array and ComputedRef)
  const cols: IrisTableColumn<Row>[] = 'value' in (options.leafColumns as object) 
    ? (options.leafColumns as ComputedRef<IrisTableColumn<Row>[]>).value
    : options.leafColumns as IrisTableColumn<Row>[]

  const sortControlled = sortProp !== undefined
  const internalSortValue = ref<IrisTableSortState | null>(defaultSort ?? null)

  const sortState = computed<IrisTableSortState | null>({
    get: () => (sortProp === undefined ? internalSortValue.value : (sortProp ?? null)),
    set: (val) => {
      if (sortProp === undefined) internalSortValue.value = val
      onSortChange?.(val)
    },
  })

  const sortComparator = computed<((a: Row, b: Row) => number) | null>(() => {
    const s = sortState.value
    if (!s) return null
    const col = cols.find((c) => c.key === s.key)
    if (!col) return null
    const dir = s.direction === 'asc' ? 1 : -1
    const sorter =
      col.sorter ?? ((a: Row, b: Row) => compareValues(getCellValue(a, col), getCellValue(b, col)))
    return (a, b) => sorter(a, b) * dir
  })

  const sortedData = computed<Row[]>(() => {
    const compare = sortComparator.value
    if (!compare) return data.value
    return [...data.value].sort(compare)
  })

  function setSort(next: IrisTableSortState | null): void {
    if (!sortControlled) internalSortValue.value = next
    onSortChange?.(next)
  }

  function cycleSort(col: IrisTableColumn<Row>): void {
    if (!col.sortable) return
    const s = sortState.value
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
