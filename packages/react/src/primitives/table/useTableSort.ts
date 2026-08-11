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
  /** Multi-column sort mode (vxe sort-config.multiple parity). When on, header
   * cycling appends/removes columns (see {@link cycleMultiSort}) and the sorted
   * data uses the chained multi comparator. Default false. */
  multiSort?: boolean
  /** Controlled multi-column sort state (multiSort mode). */
  multiSortState?: IrisTableSortState[]
  /** Default multi-column sort (multiSort mode, uncontrolled). */
  defaultMultiSort?: IrisTableSortState[]
  /** Called when the multi-column sort changes. */
  onMultiSortChange?: (next: IrisTableSortState[]) => void
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
  /** Multi-column comparator (multiSort mode): the per-column comparators
   * chained in click order; null when the list is empty. Consumers that sort
   * derived views (e.g. tree children) use this so multi mode stays consistent. */
  multiSortComparator: ((a: Row, b: Row) => number) | null
  /** Current multi-column sort state (controlled if a `multiSortState` option was provided, else internal). */
  multiSortState: IrisTableSortState[]
  /** Cycle a column in multi mode: append asc → asc→desc → remove from the list. */
  cycleMultiSort: (col: IrisTableColumn<Row>) => void
  /** Directly set the multi-column sort list. */
  setMultiSort: (next: IrisTableSortState[]) => void
}

/** Per-column comparator: `col.sorter` or a value-based default (honoring
 * `sortBy` / `sortType`). Shared by the single and multi sort paths. */
function buildSorter<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
): (a: Row, b: Row) => number {
  if (col.sorter) return col.sorter
  return (a: Row, b: Row): number => {
    const key = (col.sortBy ?? col.dataIndex ?? col.key) as keyof Row
    let va = a[key] as unknown
    let vb = b[key] as unknown
    if (col.sortType === 'number') {
      va = Number(va)
      vb = Number(vb)
    } else if (col.sortType === 'string') {
      va = String(va ?? '')
      vb = String(vb ?? '')
    }
    return compareValues(va, vb)
  }
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
  const {
    leafColumns,
    sort: sortProp,
    defaultSort,
    onSortChange,
    multiSort,
    multiSortState: multiSortStateProp,
    defaultMultiSort,
    onMultiSortChange,
  } = options

  // Internal state for uncontrolled mode
  const sortControlled = sortProp !== undefined
  const [sortInternal, setSortInternal] = React.useState<IrisTableSortState | null>(
    defaultSort ?? null,
  )
  const sortState = sortControlled ? (sortProp ?? null) : sortInternal

  // ── Multi-column mode (vxe sort-config.multiple parity) ────────────────
  // Array order = click order (most-significant first). Controlled or internal
  // exactly like the single-column state above.
  const multiControlled = multiSortStateProp !== undefined
  const [multiSortInternal, setMultiSortInternal] = React.useState<IrisTableSortState[]>(
    defaultMultiSort ?? [],
  )
  const multiSortState = multiControlled ? (multiSortStateProp ?? []) : multiSortInternal

  const setMultiSort = React.useCallback(
    (next: IrisTableSortState[]) => {
      if (!multiControlled) setMultiSortInternal(next)
      onMultiSortChange?.(next)
    },
    [multiControlled, onMultiSortChange],
  )

  // Memoized comparator
  const sortComparator = React.useMemo<((a: Row, b: Row) => number) | null>(() => {
    if (!sortState) return null
    const col = leafColumns.find((c) => c.key === sortState.key)
    if (!col) return null
    const dir = sortState.direction === 'asc' ? 1 : -1
    return (a, b) => buildSorter(col)(a, b) * dir
  }, [leafColumns, sortState])

  // Multi comparator: iterate the list, first non-zero comparison wins (stable
  // — ties fall through to the next column, then keep the original order).
  const multiSortComparator = React.useMemo<((a: Row, b: Row) => number) | null>(() => {
    if (multiSortState.length === 0) return null
    const colMap = new Map(leafColumns.map((c) => [c.key, c]))
    const chain: Array<{ dir: number; sorter: (a: Row, b: Row) => number }> = []
    for (const s of multiSortState) {
      const col = colMap.get(s.key)
      if (!col) continue
      chain.push({ dir: s.direction === 'asc' ? 1 : -1, sorter: buildSorter(col) })
    }
    if (chain.length === 0) return null
    return (a, b) => {
      for (const step of chain) {
        const cmp = step.sorter(a, b)
        if (cmp !== 0) return cmp * step.dir
      }
      return 0
    }
  }, [leafColumns, multiSortState])

  // Sorted data
  const sortedData = React.useMemo(() => {
    // Multi mode uses the chained multi comparator exclusively (an empty list
    // means unsorted); single mode keeps its own comparator — byte-compatible.
    const comparator = multiSort ? multiSortComparator : sortComparator
    if (!comparator) return data
    return [...data].sort(comparator)
  }, [data, sortComparator, multiSort, multiSortComparator])

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

  // Multi cycle: a column not in the list APPENDS asc; an existing column
  // cycles asc → desc → REMOVE (vxe sort-config.multiple + chronological).
  const cycleMultiSort = React.useCallback(
    (col: IrisTableColumn<Row>) => {
      if (!col.sortable) return
      const idx = multiSortState.findIndex((s) => s.key === col.key)
      if (idx < 0) {
        setMultiSort([...multiSortState, { key: col.key, direction: 'asc' }])
        return
      }
      const next = [...multiSortState]
      if (next[idx]!.direction === 'asc') {
        next[idx] = { key: col.key, direction: 'desc' }
        setMultiSort(next)
        return
      }
      next.splice(idx, 1)
      setMultiSort(next)
    },
    [multiSortState, setMultiSort],
  )

  return {
    sortState,
    cycleSort,
    setSort,
    sortComparator,
    sortedData,
    multiSortState,
    cycleMultiSort,
    multiSortComparator,
    setMultiSort,
  }
}
