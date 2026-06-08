/**
 * Framework-agnostic data-grid logic (the "data view" of a table/list). Pure
 * functions for the filter → sort → paginate pipeline plus the page-range
 * (ellipsis) algorithm. These are the C-layer **material** the ProTable plugin,
 * the Table primitive, and the Pagination primitive all compose instead of each
 * re-deriving them per framework.
 */

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

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
 * Tri-state sort cycle for a header click: none → asc → desc → none. Pass the
 * current sort and the clicked column key; returns the next sort state.
 */
export function cycleSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

/** A column's view contract: how to read, filter, and (optionally) sort it. */
export interface DataViewColumn<Row> {
  key: string
  /** Read the cell value from a row. */
  getValue: (row: Row) => unknown
  /** Participates in substring filtering when a filter for this key is set. */
  filterable?: boolean
  /** Custom comparator; defaults to {@link compareValues} on the cell values. */
  sorter?: (a: Row, b: Row) => number
}

/** Comparison operators for a typed {@link FilterRule}. */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'between'

/**
 * A typed filter on a column. `contains`/`startsWith`/`endsWith` are
 * case-insensitive string ops; `in` matches any value in `value` (an array);
 * `between` matches an inclusive `[min, max]` (a two-element `value`); the rest
 * compare via {@link compareValues}.
 */
export interface FilterRule {
  key: string
  operator: FilterOperator
  value: unknown
}

export interface DataViewQuery {
  /** key → substring (case-insensitive); empty strings are ignored. */
  filters: Record<string, string>
  /** Single-column sort. For multi-column, use {@link DataViewQuery.multiSort}. */
  sort: SortState | null
  /**
   * Typed operator filters, applied IN ADDITION to {@link DataViewQuery.filters}
   * (a row must satisfy both). Optional — omit for the substring-only path.
   */
  filterRules?: FilterRule[]
  /**
   * Multi-column sort, most-significant first. Applied when `sort` is null;
   * ties on an earlier column fall through to the next. Optional.
   */
  multiSort?: SortState[]
}

function matchesRule(value: unknown, rule: FilterRule): boolean {
  const lower = (v: unknown): string => String(v ?? '').toLowerCase()
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
      return lower(value).includes(lower(rule.value))
    case 'startsWith':
      return lower(value).startsWith(lower(rule.value))
    case 'endsWith':
      return lower(value).endsWith(lower(rule.value))
    case 'in':
      return Array.isArray(rule.value) && rule.value.some((v) => compareValues(value, v) === 0)
    case 'between': {
      if (!Array.isArray(rule.value) || rule.value.length < 2) return true // incomplete → skip
      const [min, max] = rule.value
      return compareValues(value, min) >= 0 && compareValues(value, max) <= 0
    }
    default:
      return true
  }
}

/**
 * Filter then sort the full row set (no pagination). Substring `filters` and
 * typed `filterRules` are both applied (a row must satisfy all). Sorting uses
 * `sort` (single column) or, when that is null, `multiSort` (most-significant
 * first); each column uses its `sorter` or {@link compareValues}.
 */
export function filterSort<Row>(
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  query: DataViewQuery,
): Row[] {
  const colOf = (key: string): DataViewColumn<Row> | undefined => columns.find((c) => c.key === key)
  let working: readonly Row[] = rows

  const activeFilters = Object.entries(query.filters).filter(([, v]) => v !== '')
  const rules = query.filterRules ?? []
  if (activeFilters.length > 0 || rules.length > 0) {
    working = working.filter(
      (row) =>
        activeFilters.every(([key, value]) => {
          const col = colOf(key)
          if (!col) return true
          return String(col.getValue(row) ?? '')
            .toLowerCase()
            .includes(value.toLowerCase())
        }) &&
        rules.every((rule) => {
          const col = colOf(rule.key)
          if (!col) return true
          return matchesRule(col.getValue(row), rule)
        }),
    )
  }

  // Single-column sort wins; otherwise apply the multi-column list in order.
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

/** Slice the page-th page (1-based) of `pageSize` rows. */
export function paginate<Row>(rows: readonly Row[], page: number, pageSize: number): Row[] {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

/** Total pages for `total` rows at `pageSize` (minimum 1). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** A pagination control slot: a page number or a side-tagged ellipsis. */
export type PageItem = number | 'ellipsis-left' | 'ellipsis-right'

/**
 * Compute the visible page list with two-sided ellipsis insertion — the single
 * source of truth behind the Pagination primitive across all four frameworks.
 *
 * Always shows the first page, the last page, and the `siblingCount` pages on
 * either side of `current`. Inserts a side-tagged ellipsis when there's a gap of
 * ≥ 2 between kept segments (a single missing page renders as its number, not an
 * ellipsis). Pure UI math — distinct from the server-side
 * `createPaginatedResource` data resource.
 */
export function getPageRange(current: number, totalPages: number, siblingCount = 1): PageItem[] {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [1]

  const left = Math.max(2, current - siblingCount)
  const right = Math.min(totalPages - 1, current + siblingCount)
  const items: PageItem[] = [1]
  if (left > 2) items.push('ellipsis-left')
  for (let i = left; i <= right; i += 1) items.push(i)
  if (right < totalPages - 1) items.push('ellipsis-right')
  items.push(totalPages)
  return items
}
