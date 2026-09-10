/**
 * Shared table filtering projection.
 *
 * The adapters own filter state and rendering; this module owns the pure row
 * projection so text filters, checked-value filters, and typed query rules
 * have one implementation across React, Vue, Solid, and Svelte.
 */

import { matchesRule } from './data-view'
import type { FilterRule } from './data-view'

/** Minimal column contract needed by the table filtering projection. */
export interface TableFilterColumn<Row> {
  readonly key: string
  readonly filterMethod?: (value: unknown, row: Row, filterValue: string) => boolean
}

/** key → checked values for a table filter column. */
export type TableFilterValues = Readonly<Record<string, readonly string[]>>

export interface TableFilterOptions<
  Row,
  Column extends TableFilterColumn<Row> = TableFilterColumn<Row>,
> {
  /** Reads the value shown/filtered for a row and column. */
  readonly getValue: (row: Row, column: Column) => unknown
  /** key → case-insensitive substring filter. Empty values are ignored. */
  readonly filters?: Readonly<Record<string, string | undefined>>
  /** Checked values for the table's local filter channel. */
  readonly filterValues?: TableFilterValues
  /** Additional checked-value maps (for example query `in` values). */
  readonly additionalFilterValues?: readonly TableFilterValues[]
  /** Typed rules from a parsed query. Every rule must match. */
  readonly filterRules?: readonly FilterRule[]
}

/**
 * Fold checked filter sets into a query filter map without mutating `filters`.
 * Empty sets are inactive and leave an existing text entry untouched.
 */
export function mergeFilterValues(
  filters: Readonly<Record<string, string>>,
  filterValues: TableFilterValues,
): Record<string, string> {
  const next: Record<string, string> = { ...filters }
  if (!filterValues || typeof filterValues !== 'object') return next
  for (const [key, values] of Object.entries(filterValues)) {
    if (Array.isArray(values) && values.length > 0) next[key] = values.join(',')
  }
  return next
}

type ActiveValueFilter = readonly [string, readonly string[]]

function activeValueFilters(values: TableFilterValues | undefined): ActiveValueFilter[] {
  if (!values || typeof values !== 'object') return []
  return Object.entries(values).filter(
    ([, candidates]) => Array.isArray(candidates) && candidates.length > 0,
  ) as ActiveValueFilter[]
}

/**
 * Apply table-local filters to rows.
 *
 * Text filters, each checked-value map, and typed rules are ANDed. Values in
 * one checked set are ORed. Unknown column keys are ignored so URL/query
 * state remains forward-compatible with a changing column projection. When
 * no channel is active the input array is returned by identity.
 */
export function filterTableRows<
  Row,
  Column extends TableFilterColumn<Row> = TableFilterColumn<Row>,
>(
  rows: readonly Row[],
  columns: readonly Column[],
  options: TableFilterOptions<Row, Column>,
): Row[] {
  const columnMap = new Map<string, Column>()
  if (Array.isArray(columns)) {
    for (const column of columns) {
      if (
        typeof column === 'object' &&
        column !== null &&
        typeof (column as { key?: unknown }).key === 'string'
      ) {
        columnMap.set(column.key, column)
      }
    }
  }

  const activeTextFilters = Object.entries(options.filters ?? {}).filter(
    ([, value]) => typeof value === 'string' && value !== '',
  ) as Array<readonly [string, string]>
  const checkedFilters = [
    ...activeValueFilters(options.filterValues),
    ...(Array.isArray(options.additionalFilterValues)
      ? options.additionalFilterValues.flatMap(activeValueFilters)
      : []),
  ]
  const rules = (Array.isArray(options.filterRules) ? options.filterRules : []).filter(
    (rule): rule is FilterRule =>
      typeof rule === 'object' &&
      rule !== null &&
      typeof (rule as { key?: unknown }).key === 'string',
  )
  if (activeTextFilters.length === 0 && checkedFilters.length === 0 && rules.length === 0) {
    return rows as Row[]
  }

  return rows.filter((row) => {
    const textMatches = activeTextFilters.every(([key, filterValue]) => {
      const column = columnMap.get(key)
      if (!column) return true
      const raw = options.getValue(row, column)
      if (typeof column.filterMethod === 'function') {
        try {
          return column.filterMethod(raw, row, filterValue)
        } catch {
          return false
        }
      }
      return String(raw ?? '')
        .toLowerCase()
        .includes(filterValue.toLowerCase())
    })
    if (!textMatches) return false

    const checkedMatches = checkedFilters.every(([key, values]) => {
      const column = columnMap.get(key)
      if (!column) return true
      return values.includes(String(options.getValue(row, column) ?? ''))
    })
    if (!checkedMatches) return false

    return rules.every((rule) => {
      const column = columnMap.get(rule.key)
      return !column || matchesRule(options.getValue(row, column), rule)
    })
  })
}
