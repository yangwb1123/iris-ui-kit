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
  /** Custom client-side filter (vxe filter-method parity). Return true to keep the row. Overrides the default case-insensitive substring match. */
  filterMethod?: (value: unknown, row: Row, filterValue: string) => boolean
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

/** One search-form field (vxe-grid formConfig items parity). On submit the
 * field's value merges into the table filters under `key` (client-side path
 * or the proxy query); empty strings are inactive and stripped. */
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

/** Search-form configuration (vxe-grid formConfig parity). Renders a field
 * row above the toolbar; submit merges values into the filters (client-side
 * or through the proxy query when `proxyConfig` is set). */
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

/** Params delivered to `IrisTableProps.proxyConfig.query` (vxe proxyConfig parity). */
export interface IrisTableProxyQueryParams {
  /** 1-based page number. */
  page: number
  pageSize: number
  sort: IrisTableSortState | null
  /**
   * Multi-column sort (vxe sort-config.multiple parity), most-significant
   * first. Present only in multiSort mode — single mode keeps passing `sort`.
   */
  sorts?: IrisTableSortState[]
  filters: Record<string, string>
}

/** One page of proxy query results (vxe proxyConfig parity). */
export interface IrisTableProxyQueryResult {
  rows: Array<Record<string, unknown>>
  total: number
}

/**
 * Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
 * set, `data` is ignored: rows come from `query` (paged), the table renders a
 * pager below the body, and edit write-back keeps working.
 */
export interface IrisTableProxyConfig {
  /**
   * Fetch one page. 1-based `page`; `sort`/`filters` are the ACTIVE state,
   * passed through when `remoteSort`/`remoteFilter` are enabled.
   */
  query: (params: IrisTableProxyQueryParams) => Promise<IrisTableProxyQueryResult>
  /** Auto-load the first page on mount (vxe autoLoad parity). Default true. */
  autoLoad?: boolean
  /** Sort changes re-query the server instead of sorting client-side (vxe proxyConfig.sort). Default false. */
  remoteSort?: boolean
  /** Filter changes re-query the server instead of filtering client-side (vxe proxyConfig.filter). Default false. */
  remoteFilter?: boolean
  /** Rows per page. Default 10. */
  pageSize?: number
  /** Initial page (1-based). Default 1. */
  defaultPage?: number
  /** Cumulative sequence numbers across pages: with the table `seq` prop, the
   * seq cell renders `(page - 1) * pageSize + rowIndex + 1` instead of
   * `rowIndex + seqStartIndex` (seqStartIndex ignored). */
  seq?: boolean
  /** Fired when the page changes. */
  onPageChange?: (page: number, pageSize: number) => void
}

/** Pager options (vxe-grid pagerConfig parity). */
export interface IrisTablePagerConfig {
  /** Rows-per-page options rendered as a size selector next to the pager. A
   * change re-queries with the new size and resets the page to 1. */
  pageSizes?: number[]
  /** Show the total-row count (i18n `table.total`) before the size selector. */
  showTotal?: boolean
}

/** Params delivered to `IrisTableProps.seqMethod` (vxe seqMethod parity). */
export interface IrisTableSeqMethodParams {
  rowIndex: number
  columnIndex: number
}

/** Params delivered to `IrisTableProps.spanMethod` (vxe span-method parity). */
export interface IrisTableSpanMethodParams {
  rowIndex: number
  columnIndex: number
}

/** Span result returned by `IrisTableProps.spanMethod` (vxe span-method parity):
 * both dimensions default to 1; values > 1 make the cell span adjacent cells,
 * which then render null. */
export interface IrisTableSpan {
  rowspan?: number
  colspan?: number
}

/** One toolbar button (vxe toolbar buttons parity). */
export interface IrisTableToolbarButton {
  key: string
  label: string
  onClick: () => void
  icon?: string
}

/** Batch action (vxe toolbar batch parity): a primary button rendered while
 * `selectable === 'multi'` and rows are selected. */
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
  /** Custom action buttons rendered after the built-ins (vxe toolbar buttons parity). */
  buttons?: IrisTableToolbarButton[]
  /** Batch action rendered while rows are selected (vxe toolbar batch parity). */
  batch?: IrisTableToolbarBatch
}
