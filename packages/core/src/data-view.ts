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

export interface DataViewQuery {
  /** key → substring (case-insensitive); empty strings are ignored. */
  filters: Record<string, string>
  sort: SortState | null
}

/**
 * Filter then sort the full row set (no pagination). Filtering is a
 * case-insensitive substring match on each active filter's column; sorting uses
 * the column's `sorter` or {@link compareValues}.
 */
export function filterSort<Row>(
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  query: DataViewQuery,
): Row[] {
  let working: readonly Row[] = rows

  const activeFilters = Object.entries(query.filters).filter(([, v]) => v !== '')
  if (activeFilters.length > 0) {
    working = working.filter((row) =>
      activeFilters.every(([key, value]) => {
        const col = columns.find((c) => c.key === key)
        if (!col) return true
        return String(col.getValue(row) ?? '')
          .toLowerCase()
          .includes(value.toLowerCase())
      }),
    )
  }

  const { sort } = query
  if (sort) {
    const col = columns.find((c) => c.key === sort.key)
    if (col) {
      const cmp =
        col.sorter ?? ((a: Row, b: Row) => compareValues(col.getValue(a), col.getValue(b)))
      working = [...working].sort((a, b) => (sort.direction === 'asc' ? cmp(a, b) : -cmp(a, b)))
    }
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
