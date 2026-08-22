import type {
  TableNamedView,
  TableTab,
  TableViewConfig,
  TableViewSnapshot,
} from '@iris-ui-kit/core'

export type IrisTableSortDirection = 'asc' | 'desc'

/** Table row-density preset. */
export type IrisTableDensity = 'comfortable' | 'compact' | 'cozy'

/** Clipboard range-copy options. Invalid runtime formats fall back to TSV. */
export interface IrisTableClipConfig {
  copy?: boolean
  paste?: boolean
  copyFormat?: 'tsv' | 'csv' | 'html'
  copyWithFormat?: boolean
}

export interface IrisTableSortState {
  key: string
  direction: IrisTableSortDirection
}

export type IrisTableViewConfig = TableViewConfig
export type IrisTableViewSnapshot = TableViewSnapshot
export type IrisTableNamedView = TableNamedView<IrisTableViewSnapshot>
export type IrisTableTab = TableTab

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
  /** Fired with parsed CSV rows by the import button. */
  onImport?: (rows: Array<Record<string, unknown>>) => void
  /** Custom action buttons rendered after the built-ins. */
  buttons?: IrisTableToolbarButton[]
  /** Batch action rendered while `selectable === 'multi'` and rows are selected. */
  batch?: IrisTableToolbarBatch
}

export type IrisTableEditor = 'text' | 'number'

/** Aggregation op for a column's summary/footer cell. */
export type IrisTableAggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count'

/** One checkbox option of a filterable column's filter panel (vxe filter-option parity). */
export interface IrisTableFilterOption {
  value: string
  label: string
}

/**
 * Per-column checked filter sets (vxe filter-multiple parity): column key →
 * values OR-matched against the raw `String(value)` of each row. Controlled
 * through `IrisTableProps.filterValues` / `onFilterValuesChange`.
 */
export type IrisTableFilterValues = Record<string, string[]>

/**
 * Coordinates delivered to `IrisTableProps.contextMenu` callbacks (vxe
 * context-menu event params parity): the row/column under the cursor and its
 * grid position.
 */
export interface IrisTableContextMenuParams<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  rowIndex: number
  columnIndex: number
}

/**
 * Right-click context menu (vxe-grid contextMenu parity). Opens on body leaf
 * cells only — header, seq, selection, expand, summary and footer cells never
 * open it. The menu floats at the cursor (virtual anchor), closes on Escape /
 * outside pointer-down / any scroll, and fires `onSelect` with the clicked
 * item's key and the cell's grid coordinates.
 */
export interface IrisTableContextMenuConfig<Row = Record<string, unknown>> {
  items: (
    params: IrisTableContextMenuParams<Row>,
  ) => Array<{ key: string; label: string; disabled?: boolean }>
  onSelect: (key: string, params: IrisTableContextMenuParams<Row>) => void
}

export interface IrisTableColumn<Row = Record<string, unknown>> {
  /** Stable unique column identifier; used for slot names and sort state. */
  key: string
  /** Header label. */
  title: string
  /** Path inside the row to read the default cell value from. Defaults to `key`. */
  dataIndex?: keyof Row | string
  /**
   * Single-line cell formula (batch EK, iris 独有 — vxe has no computed
   * columns; the closest is a display-only formatter). Evaluated by the core
   * `evaluateFormula` parser against each row: field refs + `+ - * / %` +
   * whitelist functions SUM/AVG/MIN/MAX/COUNT (case-insensitive), optional
   * leading `=`. The COMPUTED value feeds every data consumer — cell render,
   * sorting, filtering, summary, range copy and CSV export (all via the
   * `getCellValue` choke point). Errors / unknown fields → null (empty
   * cell). An `editable` formula column is DISPLAY-ONLY: inline editing and
   * row mode ignore it. Overrides `dataIndex`.
   */
  formula?: string
  /** Format the masked display value; copyWithFormat uses this string. */
  formatter?: (value: unknown, row: Row) => unknown
  /** Mask the display/copy value before the formatter. */
  mask?: 'sensitive' | ((value: unknown) => string)
  /** Copy/export the raw value instead of the masked value (formatter copy remains masked). */
  exportRaw?: boolean
  /** Allow sorting by this column. */
  sortable?: boolean
  /** Show a header filter trigger + checkbox panel (vxe filterConfig parity). Filtering OR-matches the raw `String(value)` against the checked set. */
  filterable?: boolean
  /** Checkbox options for the filter panel; a column without options can't filter. */
  filterOptions?: IrisTableFilterOption[]
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

/** Column visibility map (vxe columnConfig.visible parity): column key → visible. Default true. */
export type IrisTableColumnVisibility = Record<string, boolean>

/** Params delivered to `IrisTableProps.spanMethod` (vxe span-method parity). */
export interface IrisTableSpanMethodParams {
  /** 0-based row index over the body rows. */
  rowIndex: number
  /** 0-based leaf-column index (seq / selection / drag tracks excluded). */
  columnIndex: number
}

/** Span result returned by `IrisTableProps.spanMethod` (vxe span-method parity): both dimensions default to 1; values > 1 make the cell span adjacent cells, which then render null. */
export interface IrisTableSpan {
  rowspan?: number
  colspan?: number
}

/** Column drag-sort (vxe columnDragConfig parity). Reorders leaf columns on drop; the parent owns columns (pass the reordered array back). Grouped headers are NOT supported (documented simplification). */
export interface IrisTableColumnDrag<Row = Record<string, unknown>> {
  /** Called with the reordered column array after a drop. */
  onReorder: (columns: IrisTableColumn<Row>[]) => void
}

/** Row drag-sort (vxe rowDragConfig parity). Renders a drag handle per row; a drop reorders the table's LOCAL rows and reports through `onDataChange` (plus this callback, React parity). */
export interface IrisTableRowDrag<Row = Record<string, unknown>> {
  /** Called with the reordered row array after a drop. */
  onReorder: (rows: Row[]) => void
}

/** Snapshot returned by `IrisTableExpose.getProxyInfo` (vxe getProxyInfo parity). */
export interface IrisTableProxyInfo {
  page: number
  pageSize: number
  total: number
}

/** Imperative handle exposed by IrisTable (vxe loadData/reloadData/commitProxy/getProxyInfo parity, batch Y). */
export interface IrisTableExpose<Row = Record<string, unknown>> {
  /** Replace the live row list WITHOUT a query (vxe loadData parity): writes the local rows ref (proxy liveData / local override) and fires `onDataChange`. In proxy mode the controller's total/page stay unchanged until the next query. */
  loadData: (rows: Row[]) => void
  /** Re-fetch the current page (vxe reloadData parity — alias of the proxy refetch). */
  reloadData: () => void
  /** Merge params into the proxy query and fire the request (vxe commitProxy parity). */
  commitProxy: (overrides: Partial<IrisTableProxyQueryParams>) => void
  /** Proxy state snapshot: page/pageSize/total; null without a proxy (vxe getProxyInfo parity). */
  getProxyInfo: () => IrisTableProxyInfo | null
  /** Remove rows by row-key without issuing a query; missing keys are no-ops. */
  removeRows: (keys: Array<string | number>) => void
  /** Snapshot (copy) of the currently filtered + sorted body rows. */
  getFilteredData: () => Row[]
  /** Serialize the current filtered/sorted row view using visible leaf columns. */
  exportCurrentViewCsv: () => string
  /** Serialize the current view plus named bare row sets as CSV segments. */
  exportMultiCsv: () => string
  /** Compare two exported-state JSON strings; never throws on invalid input. */
  compareStates: (a: string, b: string) => string
  /** Scroll the rendered row with `key` into view; missing/virtualized rows are no-ops. */
  scrollToRow: (key: string | number) => void
  /** Scroll and transiently highlight the rendered row with `key`; the target clears after 2s. */
  goToRow: (key: string | number) => void
}
