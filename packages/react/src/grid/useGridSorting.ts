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

function cloneSort(sort: SortState | null): SortState | null {
  return sort ? { ...sort } : null
}

function cloneSorts(sorts: readonly SortState[]): SortState[] {
  return sorts.map((sort) => ({ ...sort }))
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
  // React dependency checks cannot observe mutations made through a stable prop
  // reference. Recompute these signatures on every render so controlled sync
  // remains content-sensitive without changing the Core model contract.
  const sortSignature = JSON.stringify(options.sort)
  const multiSortSignature = JSON.stringify(options.multiSortState)
  const wasSortControlled = React.useRef(sortControlled)
  const uncontrolledSort = React.useRef<SortState | null>(null)
  const hasUncontrolledSort = React.useRef(!sortControlled)
  const lastControlledSort = React.useRef<SortState | null>(cloneSort(options.sort ?? null))
  const wasMultiSortControlled = React.useRef(multiControlled)
  const uncontrolledMultiSort = React.useRef<SortState[]>([])
  const hasUncontrolledMultiSort = React.useRef(!multiControlled)
  const lastControlledMultiSort = React.useRef<SortState[]>(
    cloneSorts(options.multiSortState ?? []),
  )
  const leavingSortControlled = wasSortControlled.current && !sortControlled
  const leavingMultiSortControlled = wasMultiSortControlled.current && !multiControlled

  // Capture only genuine uncontrolled state. A rejected controlled proposal may
  // be ahead of the prop in the model, so it must not become the handoff value.
  if (!sortControlled && !leavingSortControlled) {
    uncontrolledSort.current = cloneSort(internalState.sort)
    hasUncontrolledSort.current = true
  }
  if (!multiControlled && !leavingMultiSortControlled) {
    uncontrolledMultiSort.current = cloneSorts(internalState.multiSort)
    hasUncontrolledMultiSort.current = true
  }
  // Capture a model update that was batched with the transition into control.
  if (multiControlled && !wasMultiSortControlled.current) {
    uncontrolledMultiSort.current = cloneSorts(internalState.multiSort)
    hasUncontrolledMultiSort.current = true
  }
  if (sortControlled) lastControlledSort.current = cloneSort(options.sort ?? null)
  if (multiControlled) {
    lastControlledMultiSort.current = cloneSorts(options.multiSortState ?? [])
  }

  const sortState = sortControlled
    ? cloneSort(options.sort ?? null)
    : cloneSort(
        leavingSortControlled
          ? hasUncontrolledSort.current
            ? uncontrolledSort.current
            : lastControlledSort.current
          : internalState.sort,
      )
  const multiSortState = multiControlled
    ? cloneSorts(options.multiSortState ?? [])
    : cloneSorts(
        leavingMultiSortControlled
          ? hasUncontrolledMultiSort.current
            ? uncontrolledMultiSort.current
            : lastControlledMultiSort.current
          : internalState.multiSort,
      )

  React.useEffect(() => {
    if (sortControlled) {
      const next = options.sort ?? null
      lastControlledSort.current = cloneSort(next)
      model.syncSort(next)
    } else if (wasSortControlled.current) {
      const restore = hasUncontrolledSort.current
        ? uncontrolledSort.current
        : lastControlledSort.current
      if (!hasUncontrolledSort.current) {
        uncontrolledSort.current = cloneSort(restore)
        hasUncontrolledSort.current = true
      }
      model.syncSort(restore)
    }
    wasSortControlled.current = sortControlled
  }, [model, options.sort, sortControlled, sortSignature])

  React.useEffect(() => {
    if (multiControlled) {
      const next = cloneSorts(options.multiSortState ?? [])
      lastControlledMultiSort.current = cloneSorts(next)
      model.syncMultiSort(next)
    } else if (wasMultiSortControlled.current) {
      const restore = hasUncontrolledMultiSort.current
        ? uncontrolledMultiSort.current
        : lastControlledMultiSort.current
      // Preserve the handoff value as the next uncontrolled baseline even if
      // Core was already equal and therefore emitted no store notification.
      uncontrolledMultiSort.current = cloneSorts(restore)
      hasUncontrolledMultiSort.current = true
      model.syncMultiSort(restore)
    }
    wasMultiSortControlled.current = multiControlled
  }, [model, multiControlled, options.multiSortState, multiSortSignature])

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
