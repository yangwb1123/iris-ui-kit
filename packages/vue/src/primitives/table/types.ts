export type IrisTableSortDirection = 'asc' | 'desc'

export interface IrisTableSortState {
  key: string
  direction: IrisTableSortDirection
}

export type IrisTableEditor = 'text' | 'number'

export interface IrisTableColumn<Row = Record<string, unknown>> {
  /** Stable unique column identifier; used for slot names and sort state. */
  key: string
  /** Header label. */
  title: string
  /** Path inside the row to read the default cell value from. Defaults to `key`. */
  dataIndex?: keyof Row | string
  /** Allow sorting by this column. */
  sortable?: boolean
  /** Initial width (px or CSS length). */
  width?: number | string
  /** Minimum width when resizing. Default 60. */
  minWidth?: number
  /** Maximum width when resizing. Default `Infinity`. */
  maxWidth?: number
  /** Cell alignment. */
  align?: 'left' | 'center' | 'right'
  /** Freeze this column to an edge during horizontal scroll (position: sticky). */
  pinned?: 'left' | 'right'
  /** Custom comparator for sorting; defaults to native `<`. */
  sorter?: (a: Row, b: Row) => number
  /** Allow double-click to edit this cell inline. */
  editable?: boolean
  /** Which kind of editor to render. Default `'text'`. */
  editor?: IrisTableEditor
  /**
   * Validate a draft before commit. Return an error message to REJECT (editor
   * stays open, marked aria-invalid); null/undefined to accept. Receives the
   * parsed value (a number for the number editor) and the row.
   */
  validate?: (value: unknown, row: Row) => string | null | undefined
}

export interface IrisTableCellEditEvent<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  oldValue: unknown
  newValue: unknown
  rowIndex: number
}

export interface IrisTableVirtualOptions {
  /** Per-row height in px (uniform). */
  itemHeight: number
  /** Viewport height. */
  height: number | string
  /** Extra rows rendered above and below the viewport. */
  buffer?: number
}

/** Map of column key → current width in px (after any resizing). */
export type IrisTableColumnWidths = Record<string, number>
