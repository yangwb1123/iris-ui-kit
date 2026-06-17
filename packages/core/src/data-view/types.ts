/**
 * Shared type definitions for the data-view module.
 *
 * These types are re-exported via the barrel (`data-view.ts`) so consumer
 * imports stay unchanged.
 */

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

/** A column's view contract: how to read, filter, and (optionally) sort it. */
export interface DataViewColumn<Row> {
  key: string
  getValue: (row: Row) => unknown
  filterable?: boolean
  sorter?: (a: Row, b: Row) => number
}

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

export interface FilterRule {
  key: string
  operator: FilterOperator
  value: unknown
}

export interface DataViewQuery {
  /** key → substring (case-insensitive); empty strings are ignored. */
  filters: Record<string, string>
  /** Single-column sort. */
  sort: SortState | null
  /** Typed operator filters, applied IN ADDITION to filters. */
  filterRules?: FilterRule[]
  /** Multi-column sort, most-significant first. Applied when `sort` is null. */
  multiSort?: SortState[]
}

export type AggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count'

export interface AggregateSpec {
  key: string
  op: AggregateOp
}

/** A row in the flattened view of a tree, tagged with its hierarchy position. */
export interface TreeRow<Row> {
  row: Row
  key: string
  depth: number
  hasChildren: boolean
  expanded: boolean
  setSize: number
  posInset: number
}

export interface FlattenTreeOptions<Row> {
  getKey: (row: Row) => string
  getChildren: (row: Row) => readonly Row[] | undefined
  isExpanded: (key: string) => boolean
}

/** A pagination control slot: a page number or a side-tagged ellipsis. */
export type PageItem = number | 'ellipsis-left' | 'ellipsis-right'
