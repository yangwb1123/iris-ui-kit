/**
 * Shared table sorting projection.
 *
 * The adapters own sort state and value lookup (including formula columns),
 * while this module owns column resolution, typed value coercion, direction
 * handling, and stable multi-column comparator construction.
 */

import { compareValues } from './data-view/filter-sort'
import type { SortState } from './data-view/types'

/** Minimal column contract needed by the table sorting projection. */
export interface TableSortColumn<Row> {
  readonly key: string
  readonly sorter?: (a: Row, b: Row) => number
  readonly sortType?: 'number' | 'string' | 'auto'
}

export type TableSortValueResolver<Row, Column extends TableSortColumn<Row>> = (
  row: Row,
  column: Column,
) => unknown

export interface TableSortOptions<Row, Column extends TableSortColumn<Row>> {
  /** Resolves the value used by the default comparator. */
  readonly getValue: TableSortValueResolver<Row, Column>
  /** Single-column sort state used when `mode` is `'single'`. */
  readonly sort?: SortState | null
  /** Multi-column sort state used when `mode` is `'multiple'`. */
  readonly multiSort?: readonly SortState[]
  /** Selects the single or multi state channel. Defaults to `'single'`. */
  readonly mode?: 'single' | 'multiple'
}

export interface TableSortInfo {
  readonly isActive: boolean
  readonly direction: SortState['direction'] | null
  /** Zero-based position in the active multi-sort chain; `-1` otherwise. */
  readonly multiIndex: number
}

export interface TableSortInfoOptions {
  readonly multiSort: boolean
  readonly multiSortState?: readonly SortState[]
  readonly sort?: SortState | null
}

function isSortState(value: unknown): value is SortState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { key?: unknown; direction?: unknown }
  return (
    typeof candidate.key === 'string' &&
    (candidate.direction === 'asc' || candidate.direction === 'desc')
  )
}

function hasSortColumnKey(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string'
  )
}

function normalizeComparison(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0
}

/**
 * Resolve the display state for one table header without owning any UI.
 * Adapters use the same key/index/direction projection for aria attributes,
 * indicators, and multi-sort sequence badges.
 */
export function resolveTableSortInfo(
  columnKey: string,
  options: TableSortInfoOptions,
): TableSortInfo {
  const multiSortState = Array.isArray(options.multiSortState) ? options.multiSortState : []
  const multiIndex = options.multiSort
    ? multiSortState.findIndex((state) => isSortState(state) && state.key === columnKey)
    : -1
  const state = options.multiSort
    ? multiIndex >= 0
      ? multiSortState[multiIndex]
      : undefined
    : options.sort
  const isActive = isSortState(state) && state.key === columnKey
  return {
    isActive,
    direction: isActive ? state.direction : null,
    multiIndex,
  }
}

function normalizeSortValue(
  value: unknown,
  sortType: TableSortColumn<unknown>['sortType'],
): unknown {
  if (sortType === 'number') {
    // Keep compareValues' null-first contract. Invalid numeric values fall
    // back to their string representation instead of producing NaN (which
    // makes Array#sort treat comparisons as equal); valid numeric coercions
    // retain the existing numeric-string behavior.
    if (value == null) return value
    try {
      const numeric = Number(value)
      return Number.isNaN(numeric) ? String(value) : numeric
    } catch {
      return String(value)
    }
  }
  if (sortType === 'string') return String(value ?? '')
  return value
}

function defaultComparator<Row, Column extends TableSortColumn<Row>>(
  column: Column,
  getValue: TableSortValueResolver<Row, Column>,
): (a: Row, b: Row) => number {
  if (typeof column.sorter === 'function') {
    return (a, b) => normalizeComparison(column.sorter!(a, b))
  }
  return (a, b) =>
    normalizeComparison(
      compareValues(
        normalizeSortValue(getValue(a, column), column.sortType),
        normalizeSortValue(getValue(b, column), column.sortType),
      ),
    )
}

/** Build a comparator for one active table sort state. */
export function createTableSortComparator<
  Row,
  Column extends TableSortColumn<Row> = TableSortColumn<Row>,
>(
  sort: SortState | null | undefined,
  columns: readonly Column[],
  getValue: TableSortValueResolver<Row, Column>,
): ((a: Row, b: Row) => number) | null {
  if (!isSortState(sort) || !Array.isArray(columns)) return null
  const column = columns.find(
    (candidate) => hasSortColumnKey(candidate) && candidate.key === sort.key,
  )
  if (!column) return null
  const direction = sort.direction === 'asc' ? 1 : -1
  const compare = defaultComparator(column, getValue)
  return (a, b) => compare(a, b) * direction
}

/**
 * Build a comparator for an ordered multi-column sort list. Unknown columns
 * are ignored so persisted/query state can outlive a changing column set.
 */
export function createTableMultiSortComparator<
  Row,
  Column extends TableSortColumn<Row> = TableSortColumn<Row>,
>(
  sorts: readonly SortState[],
  columns: readonly Column[],
  getValue: TableSortValueResolver<Row, Column>,
): ((a: Row, b: Row) => number) | null {
  if (!Array.isArray(sorts) || !Array.isArray(columns) || sorts.length === 0) return null
  const columnsByKey = new Map<string, Column>()
  for (const column of columns) {
    if (hasSortColumnKey(column)) columnsByKey.set(column.key, column)
  }
  const chain: Array<{
    readonly direction: number
    readonly compare: (a: Row, b: Row) => number
  }> = []
  for (const sort of sorts) {
    if (!isSortState(sort)) continue
    const column = columnsByKey.get(sort.key)
    if (!column) continue
    chain.push({
      direction: sort.direction === 'asc' ? 1 : -1,
      compare: defaultComparator(column, getValue),
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

/**
 * Apply the selected table sort while preserving the input array identity
 * when no usable sort is active.
 */
export function sortTableRows<Row, Column extends TableSortColumn<Row>>(
  rows: readonly Row[],
  columns: readonly Column[],
  options: TableSortOptions<Row, Column>,
): Row[] {
  const comparator =
    options.mode === 'multiple'
      ? createTableMultiSortComparator(options.multiSort ?? [], columns, options.getValue)
      : createTableSortComparator(options.sort, columns, options.getValue)
  return comparator ? [...rows].sort(comparator) : (rows as Row[])
}

export type { SortState }
