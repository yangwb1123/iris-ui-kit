export type IrisTableSortDirection = 'asc' | 'desc'

/** Map of column key → current width in px (after any resizing). */
export type IrisTableColumnWidths = Record<string, number>

export type IrisTableEditor = 'text' | 'number'

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
  /** Allow double-click inline editing of this column's cells. */
  editable?: boolean
  /** Editor kind. Default `'text'`. */
  editor?: IrisTableEditor
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
