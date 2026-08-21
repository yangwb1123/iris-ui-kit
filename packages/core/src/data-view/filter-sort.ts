/**
 * Sorting and filtering utilities for data grids.
 *
 * Pure C-layer material: null-safe comparison, tri-state cycle,
 * column contracts, typed filter rules, and the filter+sort pipeline.
 */

import type { SortState, DataViewColumn, FilterRule, DataViewQuery } from './types'

/**
 * Null-safe comparison: numbers numerically, everything else by locale string.
 * `null`/`undefined` sort first. Returns the usual negative/zero/positive.
 */
export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/**
 * Tri-state sort cycle for a header click: none → asc → desc → none.
 * Returns the next sort state or null to clear sorting.
 */
export function cycleSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

function matchString(
  value: unknown,
  filter: unknown,
  method: 'includes' | 'startsWith' | 'endsWith',
): boolean {
  const lower = (v: unknown): string => String(v ?? '').toLowerCase()
  return lower(value)[method](lower(filter))
}

function matchIn(value: unknown, candidates: unknown): boolean {
  return Array.isArray(candidates) && candidates.some((v) => compareValues(value, v) === 0)
}

function matchBetween(value: unknown, range: unknown): boolean {
  if (!Array.isArray(range) || range.length < 2) return true
  return compareValues(value, range[0]) >= 0 && compareValues(value, range[1]) <= 0
}

/** Whether a single cell value satisfies a typed filter rule. */
export function matchesRule(value: unknown, rule: FilterRule): boolean {
  switch (rule.operator) {
    case 'eq':
      return compareValues(value, rule.value) === 0
    case 'ne':
      return compareValues(value, rule.value) !== 0
    case 'gt':
      return compareValues(value, rule.value) > 0
    case 'gte':
      return compareValues(value, rule.value) >= 0
    case 'lt':
      return compareValues(value, rule.value) < 0
    case 'lte':
      return compareValues(value, rule.value) <= 0
    case 'contains':
      return matchString(value, rule.value, 'includes')
    case 'startsWith':
      return matchString(value, rule.value, 'startsWith')
    case 'endsWith':
      return matchString(value, rule.value, 'endsWith')
    case 'in':
      return matchIn(value, rule.value)
    case 'between':
      return matchBetween(value, rule.value)
    default:
      return true
  }
}

/**
 * Filter then sort the full row set (no pagination). Substring `filters` and
 * typed `filterRules` are both applied (a row must satisfy all), except for
 * columns with `filterable: false` — their terms are skipped, row kept.
 * Sorting uses
 * `sort` (single column) or, when that is null, `multiSort` (most-significant
 * first); each column uses its `sorter` or {@link compareValues}.
 */
export function filterSort<Row>(
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  query: DataViewQuery,
): Row[] {
  const colMap = new Map<string, DataViewColumn<Row>>()
  for (const c of columns) colMap.set(c.key, c)
  const colOf = (key: string): DataViewColumn<Row> | undefined => colMap.get(key)
  let working: readonly Row[] = rows

  const activeFilters = Object.entries(query.filters).filter(([, v]) => v !== '')
  const rules = query.filterRules ?? []
  if (activeFilters.length > 0 || rules.length > 0) {
    working = working.filter(
      (row) =>
        activeFilters.every(([key, value]) => {
          const col = colOf(key)
          if (!col || col.filterable === false) return true
          return String(col.getValue(row) ?? '')
            .toLowerCase()
            .includes(value.toLowerCase())
        }) &&
        rules.every((rule) => {
          const col = colOf(rule.key)
          if (!col || col.filterable === false) return true
          return matchesRule(col.getValue(row), rule)
        }),
    )
  }

  const sortCols: SortState[] = query.sort ? [query.sort] : (query.multiSort ?? [])
  if (sortCols.length > 0) {
    working = [...working].sort((a, b) => {
      for (const s of sortCols) {
        const col = colOf(s.key)
        if (!col) continue
        const cmp = col.sorter ? col.sorter(a, b) : compareValues(col.getValue(a), col.getValue(b))
        if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }

  return working === rows ? [...rows] : (working as Row[])
}

/**
 * A {@link filterSort} with a single-entry referential cache.
 * Each consumer should create its own instance.
 */
export function createMemoizedFilterSort<Row>(): (
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  query: DataViewQuery,
) => Row[] {
  let lastRows: readonly Row[] | null = null
  let lastColumns: readonly DataViewColumn<Row>[] | null = null
  let lastQuery: DataViewQuery | null = null
  let lastResult: Row[] = []
  return (rows, columns, query) => {
    if (rows === lastRows && columns === lastColumns && query === lastQuery) {
      return lastResult
    }
    lastResult = filterSort(rows, columns, query)
    lastRows = rows
    lastColumns = columns
    lastQuery = query
    return lastResult
  }
}

/**
 * Trailing-edge debounce: delays invoking `fn` until `wait` ms have elapsed
 * since the last call. SSR-safe (uses whatever `setTimeout` is in scope).
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const debounced = (...args: Args): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, wait)
  }
  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  return debounced
}
