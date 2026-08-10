export type IrisTableSortDirection = 'asc' | 'desc'

export interface IrisTableSortState {
  key: string
  direction: IrisTableSortDirection
}

export type IrisTableEditor = 'text' | 'number'

/** Aggregation op for a column's summary/footer cell. */
export type IrisTableAggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count'

export interface IrisTableColumn<Row = Record<string, unknown>> {
  key: string
  title: string
  dataIndex?: keyof Row | string
  sortable?: boolean
  width?: number | string
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  pinned?: 'left' | 'right'
  sorter?: (a: Row, b: Row) => number
  editable?: boolean
  editor?: IrisTableEditor
  /**
   * Validate a draft before commit. Return an error message to REJECT (editor
   * stays open, marked aria-invalid); null/undefined to accept. Receives the
   * parsed value (a number for the number editor) and the row.
   */
  validate?: (value: unknown, row: Row) => string | null | undefined
  /**
   * Declarative edit rules (vxe-grid editRules parity) — required/min/max/
   * type/pattern/validator (sync or async). Runs before `validate`.
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
  renderSummary?: (value: number, rows: Row[]) => unknown
  /**
   * Custom cell renderer (framework-native Svelte snippet). Receives the raw
   * cell value and the row; return a snippet rendered in place of the plain
   * value. Parity with React `render` / Vue `cell.{key}` slots.
   */
  render?: (value: unknown, row: Row) => unknown
  /**
   * Child columns. A column WITH children is a header GROUP (not a data column);
   * its leaf descendants render the body. Additive: when absent the table is
   * flat (current behavior). Drives multi-level (grouped) headers.
   */
  children?: IrisTableColumn<Row>[]
}

/**
 * Render an expandable detail panel beneath a row. Providing this to the table
 * adds a leading expand-toggle column; clicking it reveals a full-width detail
 * row containing this function's return value. (Not applied in any virtual path.)
 */
export type IrisTableRenderDetail<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => unknown

export type IrisTableRowExpandable<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => boolean

export interface IrisTableCellEditEvent<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  oldValue: unknown
  newValue: unknown
  rowIndex: number
}

export interface IrisTableVirtualOptions {
  itemHeight: number
  height: number | string
  buffer?: number
}

export type IrisTableColumnWidths = Record<string, number>
