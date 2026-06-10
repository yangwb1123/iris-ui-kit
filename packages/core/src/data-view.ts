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
  // Index columns by key once (O(cols)) instead of a linear find per row per
  // filter/sort comparison (was O(rows × cols)).
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

/**
 * A {@link filterSort} with a single-entry referential cache. Adapters call
 * filterSort on every render; when `rows`, `columns`, and `query` are all the
 * same references as the previous call (the common case between unrelated
 * re-renders) the cached result is returned without re-running the pipeline.
 *
 * Each consumer should create its OWN instance (the cache is not shared) so one
 * table's inputs never evict another's.
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
 * since the last call. The returned function has a `cancel()` to drop a pending
 * call (e.g. on unmount). Use it to throttle per-keystroke filter recomputes
 * feeding {@link filterSort}. SSR-safe (uses whatever `setTimeout` is in scope).
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

/** Aggregation operation over a column's values. */
export type AggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count'

/**
 * Aggregate the values read by `getValue` across `rows`. `count` counts
 * non-null values; the others coerce to `Number` and ignore non-finite values.
 * Empty input → 0 for sum/avg/count, `NaN` for min/max (no extremum exists).
 */
export function aggregate<Row>(
  rows: readonly Row[],
  getValue: (row: Row) => unknown,
  op: AggregateOp,
): number {
  if (op === 'count') return rows.reduce((n, r) => (getValue(r) != null ? n + 1 : n), 0)
  const nums: number[] = []
  for (const r of rows) {
    const raw = getValue(r)
    if (raw == null) continue // null/undefined are not data points (Number(null) === 0)
    const v = Number(raw)
    if (Number.isFinite(v)) nums.push(v)
  }
  if (nums.length === 0) return op === 'min' || op === 'max' ? NaN : 0
  switch (op) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
  }
}

/** A `{ column key → operation }` pair for {@link summarize}. */
export interface AggregateSpec {
  key: string
  op: AggregateOp
}

/**
 * Compute a summary record (`{ columnKey: aggregatedNumber }`) for a set of
 * column specs, reading each column's value via its {@link DataViewColumn}. The
 * material behind a table's summary/footer row. Unknown column keys are skipped.
 */
export function summarize<Row>(
  rows: readonly Row[],
  columns: readonly DataViewColumn<Row>[],
  specs: readonly AggregateSpec[],
): Record<string, number> {
  const colMap = new Map(columns.map((c) => [c.key, c]))
  const out: Record<string, number> = {}
  for (const spec of specs) {
    const col = colMap.get(spec.key)
    if (col) out[spec.key] = aggregate(rows, col.getValue, spec.op)
  }
  return out
}

/**
 * Group rows by a key function into an ordered array of `{ key, rows }`
 * (first-seen key order preserved). The material behind grouped/tree table rows
 * and group-aggregate rollups.
 */
export function groupRows<Row, K>(
  rows: readonly Row[],
  keyOf: (row: Row) => K,
): Array<{ key: K; rows: Row[] }> {
  const groups = new Map<K, Row[]>()
  for (const row of rows) {
    const k = keyOf(row)
    const bucket = groups.get(k)
    if (bucket) bucket.push(row)
    else groups.set(k, [row])
  }
  return Array.from(groups, ([key, rs]) => ({ key, rows: rs }))
}

/** A row in the flattened view of a tree, tagged with its hierarchy position. */
export interface TreeRow<Row> {
  row: Row
  /** Stable key from `getKey`. */
  key: string
  /** Indentation level: `0` for roots, `+1` per descent. */
  depth: number
  /** Whether the node has children (regardless of whether they're shown). */
  hasChildren: boolean
  /** Whether this node's children are currently visible. */
  expanded: boolean
}

export interface FlattenTreeOptions<Row> {
  /** Stable, unique key for a row. */
  getKey: (row: Row) => string
  /** A row's child rows, or `undefined`/`[]` for a leaf. */
  getChildren: (row: Row) => readonly Row[] | undefined
  /** Whether a key's children are currently expanded (e.g. from createExpansion). */
  isExpanded: (key: string) => boolean
}

/**
 * Flatten a nested row tree into the visible flat list (pre-order: a parent
 * precedes its shown descendants), honoring an expansion predicate — children of
 * a collapsed node are omitted. Each emitted {@link TreeRow} carries its depth
 * (for indentation) and `hasChildren` (so the UI shows a toggle even when
 * collapsed). The C-layer material behind hierarchical/tree table rows. A
 * `seen`-key guard makes a malformed tree (a child cycling back to an ancestor)
 * terminate instead of looping, and de-dupes repeated keys.
 */
export function flattenTree<Row>(
  roots: readonly Row[],
  options: FlattenTreeOptions<Row>,
): Array<TreeRow<Row>> {
  const { getKey, getChildren, isExpanded } = options
  const out: Array<TreeRow<Row>> = []
  const seen = new Set<string>()
  const walk = (nodes: readonly Row[], depth: number): void => {
    for (const row of nodes) {
      const key = getKey(row)
      if (seen.has(key)) continue // cycle / duplicate-key guard
      seen.add(key)
      const children = getChildren(row)
      const hasChildren = !!children && children.length > 0
      const expanded = hasChildren && isExpanded(key)
      out.push({ row, key, depth, hasChildren, expanded })
      if (expanded) walk(children!, depth + 1)
    }
  }
  walk(roots, 0)
  return out
}

/**
 * The set of keys to KEEP when filtering a tree: a node is kept when it OR any
 * descendant satisfies `predicate`, so the ancestors of a match are retained for
 * context (a deep match still shows its path). Pair with {@link flattenTree} —
 * `flattenTree(roots, …).filter((tr) => keep.has(tr.key))` — to render a filtered
 * tree. Pure, post-order, and cycle/duplicate-guarded like `flattenTree`.
 */
export function treeMatchKeys<Row>(
  roots: readonly Row[],
  predicate: (row: Row) => boolean,
  options: {
    getKey: (row: Row) => string
    getChildren: (row: Row) => readonly Row[] | undefined
  },
): Set<string> {
  const { getKey, getChildren } = options
  const keep = new Set<string>()
  const seen = new Set<string>()
  const visit = (row: Row): boolean => {
    const key = getKey(row)
    if (seen.has(key)) return keep.has(key) // cycle / duplicate: reuse the decision
    seen.add(key)
    let anyChild = false
    for (const child of getChildren(row) ?? []) {
      if (visit(child)) anyChild = true
    }
    const kept = predicate(row) || anyChild
    if (kept) keep.add(key)
    return kept
  }
  for (const row of roots) visit(row)
  return keep
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
