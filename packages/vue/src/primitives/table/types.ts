export type IrisTableSortDirection = 'asc' | 'desc'

export interface IrisTableSortState {
  key: string
  direction: IrisTableSortDirection
}

/** Params delivered to {@link IrisTableProxyConfig.query} (vxe proxyConfig parity). */
export interface IrisTableProxyQueryParams {
  /** 1-based page number. */
  page: number
  pageSize: number
  sort: IrisTableSortState | null
  /**
   * Multi-column sort (multiSort mode), most-significant first. Only set in
   * multiSort mode — single mode keeps passing `sort`.
   */
  sorts?: IrisTableSortState[]
  /** key → filter value (empty string = inactive, stripped by the controller). */
  filters: Record<string, string>
}

/**
 * Server-side data proxy (vxe-grid proxyConfig parity, query slice). When set,
 * `data` is ignored: rows come from `query` (paged), the table renders a pager
 * below the body, and inline-edit write-back keeps working on a local copy.
 */
export interface IrisTableProxyConfig<Row = Record<string, unknown>> {
  /** Fetch one page. 1-based `page`; `sort`/`sorts`/`filters` are the ACTIVE state. */
  query: (params: IrisTableProxyQueryParams) => Promise<{ rows: Row[]; total: number }>
  /** Auto-load the first page on mount (vxe autoLoad parity). Default true. */
  autoLoad?: boolean
  /** Sort changes re-query the server instead of sorting client-side. Default false. */
  remoteSort?: boolean
  /** Filter changes re-query the server instead of filtering client-side. Default false. */
  remoteFilter?: boolean
  /** Rows per page. Default 10. */
  pageSize?: number
  /** Initial page (1-based). Default 1. */
  defaultPage?: number
  /** Fired when the page changes. */
  onPageChange?: (page: number, pageSize: number) => void
}

/** One search-form field (vxe-grid formConfig items parity). */
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

/** Search-form configuration (vxe-grid formConfig parity). */
export interface IrisTableFormConfig {
  fields: IrisTableFormField[]
  /** Label of the submit button. Defaults to the i18n `table.formSubmit` key. */
  submitText?: string
  /** Label of the reset button. Defaults to the i18n `table.formReset` key. */
  resetText?: string
  /** Fired on submit with every field's value (empty strings stripped). */
  onSearch?: (values: Record<string, string>) => void
  /** Fired on reset with the reset values (defaults re-applied). */
  onReset?: (values: Record<string, string>) => void
}

/** One custom toolbar action button (vxe toolbar buttons parity). */
export interface IrisTableToolbarButton {
  key: string
  label: string
  onClick: () => void
  icon?: string
}

/** Batch action (vxe toolbar batch parity): rendered while multi-selection is non-empty. */
export interface IrisTableToolbarBatch {
  label: string
  onClick: (keys: Array<string | number>) => void
  icon?: string
}

/** Toolbar (vxe-grid toolbarConfig parity, minimal built-ins). */
export interface IrisTableToolbarConfig {
  title?: string
  /** Fired by the refresh button. */
  onRefresh?: () => void
  /** Fired by the export button (vxe toolbar export parity). */
  onExport?: () => void
  /** Custom action buttons rendered after the built-ins. */
  buttons?: IrisTableToolbarButton[]
  /** Batch action rendered while `selectable === 'multi'` and rows are selected. */
  batch?: IrisTableToolbarBatch
}

export type IrisTableEditor = 'text' | 'number'

/** Aggregation op for a column's summary/footer cell. */
export type IrisTableAggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count'

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
  renderSummary?: (value: number, rows: Row[]) => import('vue').VNodeChild
  /**
   * Child columns, making this a HEADER GROUP that spans them in a multi-level
   * header. A column with `children` is not a data column itself — its leaf
   * descendants render the body. Omit for a normal (leaf) column.
   */
  children?: IrisTableColumn<Row>[]
}

/**
 * Render an expandable detail panel beneath a row. Providing this to the table
 * adds a leading expand-toggle column; clicking it reveals a full-width detail
 * row. (Not applied in the virtual-scroll path.)
 */
export type IrisTableRenderDetail<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => import('vue').VNodeChild

/** Predicate selecting which rows can expand a detail panel. */
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
  /** Per-row height in px (uniform). */
  itemHeight: number
  /** Viewport height. */
  height: number | string
  /** Extra rows rendered above and below the viewport. */
  buffer?: number
}

/** Map of column key → current width in px (after any resizing). */
export type IrisTableColumnWidths = Record<string, number>
