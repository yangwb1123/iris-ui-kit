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

export interface IrisTableColumn<Row = Record<string, unknown>> {
  key: string
  title: string
  /** Path inside the row to read the cell value from. Defaults to `key`. */
  dataIndex?: keyof Row | string
  sortable?: boolean
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
