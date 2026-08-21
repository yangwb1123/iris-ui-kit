import { compareValues } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableSortState } from './types'

/**
 * Fold checked filter sets into the query filter map as comma-joined strings
 * (vxe filter-multiple remote serialization parity).
 */
export function mergeFilterValues(
  filters: Record<string, string>,
  filterValues: Record<string, string[]>,
): Record<string, string> {
  const next = { ...filters }
  for (const [key, values] of Object.entries(filterValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

/** Build the ordered comparator used by multi-column sorting. */
export function createMultiSortComparator<Row extends Record<string, unknown>>(
  list: IrisTableSortState[],
  columns: IrisTableColumn<Row>[],
  getValue: (row: Row, column: IrisTableColumn<Row>) => unknown,
): ((a: Row, b: Row) => number) | null {
  if (list.length === 0) return null
  const colMap = new Map(columns.map((column) => [column.key, column]))
  const chain: Array<{
    direction: number
    compare: (a: Row, b: Row) => number
  }> = []
  for (const sort of list) {
    const column = colMap.get(sort.key)
    if (!column) continue
    chain.push({
      direction: sort.direction === 'asc' ? 1 : -1,
      compare:
        column.sorter ??
        ((a: Row, b: Row) => compareValues(getValue(a, column), getValue(b, column))),
    })
  }
  if (chain.length === 0) return null
  return (a, b) => {
    for (const step of chain) {
      const result = step.compare(a, b)
      if (result !== 0) return result * step.direction
    }
    return 0
  }
}
