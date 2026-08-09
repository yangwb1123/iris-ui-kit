export type IrisTableSortDirection = 'asc' | 'desc'

/** Map of column key → current width in px (after any resizing). */
export type IrisTableColumnWidths = Record<string, number>

export type IrisTableEditor = 'text' | 'number'

/** Aggregation op for a column's summary/footer cell. */
export type IrisTableAggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count'

export interface IrisTableVirtualOptions {
  /** Per-row height in px (uniform). */
  itemHeight: number
  /** Viewport height. Number → px; string → CSS length. */
  height: number | string
  /** Extra rows rendered above and below the viewport. */
  buffer?: number
}

export interface IrisTableSortState {
  key: string
  direction: IrisTableSortDirection
}

/**
 * One search-form field (vxe-grid formConfig items parity). On submit the
 * field's value merges into the table filters under `key` (client-side path
 * or the proxy query); empty strings are inactive and stripped.
 */
export interface IrisTableFormField {
  /** Filter key — matched against column keys and the query `filters` map. */
  key: string
  /** Visible field label. */
  label: string
  /** Control kind. Default `'text'`. */
  type?: 'text' | 'select'
  /** Options when `type: 'select'`. */
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  /** Initial value; reset restores it. */
  defaultValue?: string
}

/** Params delivered to `IrisTableProps.proxyConfig.query` (vxe proxyConfig parity). */
export interface IrisTableProxyQueryParams {
  /** 1-based page number. */
  page: number
  pageSize: number
  sort: import('./types').IrisTableSortState | null
  filters: Record<string, string>
}

/** Params delivered to `IrisTableProps.seqMethod` (vxe seqMethod parity). */
export interface IrisTableSeqMethodParams {
  rowIndex: number
  columnIndex: number
}

/** Coordinates delivered to `IrisTableProps.onCellClick` (vxe cell-click parity). */
export interface IrisTableCellClickParams<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  rowIndex: number
  columnIndex: number
}

export interface IrisTableColumn<Row = Record<string, unknown>> {
  key: string
  title: string
  /** Icon/content rendered before the header title (vxe title-prefix parity). */
  titlePrefix?: import('react').ReactNode
  /** Icon/content rendered after the header title (vxe title-suffix parity). */
  titleSuffix?: import('react').ReactNode
  /** Path inside the row to read the cell value from. Defaults to `key`. */
  dataIndex?: keyof Row | string
  sortable?: boolean
  /** Sort by another field (vxe sort-by parity): the comparator reads this
   * field instead of the column's own value. */
  sortBy?: string
  /** Force the sort type (vxe sort-type parity). Default `'auto'` (numbers
   * compare numerically, everything else as strings). */
  sortType?: 'number' | 'string' | 'auto'
  /** Custom client-side filter (vxe filter-method parity). Return true to
   * keep the row. Overrides the default case-insensitive substring match. */
  filterMethod?: (value: unknown, row: Row, filterValue: string) => boolean
  /** Single-select filter (vxe filter-multiple parity). The current filter
   * UI is value-based (one value per column), so this is the default. */
  filterMultiple?: boolean
  /** Render the cell value as HTML (vxe type=html parity). Opt-in only —
   * the value is injected with `dangerouslySetInnerHTML`; ensure the content
   * is trusted to avoid XSS. */
  html?: boolean
  width?: number | string
  /** Minimum width (px) when resizing. Default 60. */
  minWidth?: number
  /** Maximum width (px) when resizing. Default Infinity. */
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  /** Freeze this column to an edge during horizontal scroll (position: sticky). */
  pinned?: 'left' | 'right'
  /** Allow double-click inline editing of this column's cells. */
  editable?: boolean
  /** Editor kind. Default `'text'`. */
  editor?: IrisTableEditor
  /**
   * Validate a draft value before it commits. Return an error message to
   * REJECT the edit (the editor stays open, shows the message, and is marked
   * `aria-invalid`); return `null`/`undefined` to accept. Receives the parsed
   * value (a number for the `'number'` editor) and the row being edited.
   */
  validate?: (value: unknown, row: Row) => string | null | undefined
  /**
   * Declarative edit rules (vxe-grid editRules parity) evaluated on commit —
   * `required` / `min` / `max` / `type` / `pattern` / `validator` (sync or
   * async). Rules run first; the legacy `validate` callback runs after.
   */
  editRules?: import('@iris-ui-kit/core').EditRule<Row>[]
  /**
   * Aggregate this column in the table's summary/footer row. Any column with a
   * `summary` op makes the footer row appear; columns without one render blank.
   */
  summary?: IrisTableAggregateOp
  /**
   * Format this column's summary value. Receives the aggregated number and the
   * rows it was computed over; defaults to the number's string form.
   */
  renderSummary?: (value: number, rows: Row[]) => import('react').ReactNode
  /**
   * Child columns, making this a HEADER GROUP that spans them in a multi-level
   * header. A column with `children` is not a data column itself — its leaf
   * descendants render the body. Omit for a normal (leaf) column.
   */
  children?: IrisTableColumn<Row>[]
  /** Custom comparator for sorting; defaults to native `<`. */
  sorter?: (a: Row, b: Row) => number
  /** Custom render for cell content. */
  render?: (value: unknown, row: Row, rowIndex: number) => import('react').ReactNode
}

export interface IrisTableCellEditEvent<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  oldValue: unknown
  newValue: unknown
  rowIndex: number
}

export type IrisTableRenderDetail<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => import('react').ReactNode

export type IrisTableRowExpandable<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => boolean
