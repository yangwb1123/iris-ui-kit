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

/** External row sets available to cross-table formula references. */
export type IrisTableFormulaTables<Row extends Record<string, unknown> = Record<string, unknown>> =
  Record<string, Row[]>

export type IrisTableViewConfig = TableViewConfig
export type IrisTableViewSnapshot = TableViewSnapshot
export type IrisTableNamedView = TableNamedView<IrisTableViewSnapshot>
export type IrisTableTab = TableTab

export type IrisTableEditor = 'text' | 'number'

/** Aggregation op for a column's summary/footer cell. */
export type IrisTableAggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count'

export interface IrisTableColumn<Row = Record<string, unknown>> {
  key: string
  title: string
  dataIndex?: keyof Row | string
  /**
   * Single-line cell formula (batch EM, iris 独有 — vxe has no computed
   * columns; the closest is a display-only formatter). Evaluated by the core
   * `evaluateFormula` parser against each row: field refs + `+ - * / %` +
   * whitelist functions SUM/AVG/MIN/MAX/COUNT (case-insensitive), optional
   * leading `=`. `table!field` reads the first row's field from the optional
   * `formulaTables` prop. The COMPUTED value feeds every data consumer — cell
   * render, sorting, filtering, summary, range copy and CSV export (all via
   * the `getCellValue` choke point). Missing tables/rows/fields and bad
   * formulas fail closed to null (empty cell). Replace the `formulaTables`
   * object when referenced rows change; in-place nested mutation may remain
   * memoized. An `editable` formula column is DISPLAY-ONLY: inline editing
   * and row mode ignore it. Overrides `dataIndex`.
   */
  formula?: string
  /** Format the masked display value; copyWithFormat uses this string. */
  formatter?: (value: unknown, row: Row) => unknown
  /** Mask the display/copy value before the formatter. */
  mask?: 'sensitive' | ((value: unknown) => string)
  /** Copy/export the raw value instead of the masked value (formatter copy remains masked). */
  exportRaw?: boolean
  sortable?: boolean
  /** Custom client-side filter (vxe filter-method parity). Return true to keep the row. Overrides the default case-insensitive substring match. */
  filterMethod?: (value: unknown, row: Row, filterValue: string) => boolean
  /** Show a checkbox filter trigger in the header. */
  filterable?: boolean
  /** Checkbox options rendered by the filter panel. */
  filterOptions?: IrisTableFilterOption[]
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

/** Inline-edit configuration (vxe-grid editConfig parity). */
export interface IrisTableEditConfig {
  /** What opens the editor. Default is `'dblclick'`. */
  trigger?: 'click' | 'dblclick' | 'manual'
  /** Show a required asterisk next to headers of columns with rules. */
  showAsterisk?: boolean
  /** Drop the draft when opening another cell without committing. */
  autoClear?: boolean
  /** `'row'` opens every editable column in the clicked row together. */
  mode?: 'cell' | 'row'
}

/** Column drag-sort (vxe columnDragConfig parity). Group headers are not draggable. */
export interface IrisTableColumnDrag {
  /** Called with the reordered leaf-column array after a drop. */
  onReorder: (columns: IrisTableColumn[]) => void
}

/** One checkbox option in a column filter panel. */
export interface IrisTableFilterOption {
  value: string
  label: string
}

/** Per-column checked values; values within one column are OR-matched. */
export type IrisTableFilterValues = Record<string, string[]>

/** One right-click context-menu item. */
export interface IrisTableContextMenuItem {
  key: string
  label: string
  disabled?: boolean
}

/** Coordinates delivered to the table context-menu callbacks. */
export interface IrisTableContextMenuParams {
  row: Record<string, unknown>
  column: IrisTableColumn
  rowIndex: number
  columnIndex: number
}

/** Right-click menu configuration for body leaf cells. */
export interface IrisTableContextMenuConfig {
  items: (params: IrisTableContextMenuParams) => IrisTableContextMenuItem[]
  onSelect: (key: string, params: IrisTableContextMenuParams) => void
}

/** Row drag-sort (vxe rowDragConfig parity). */
export interface IrisTableRowDrag {
  /** Called with the reordered row array after a drop. */
  onReorder: (rows: Array<Record<string, unknown>>) => void
}

export interface IrisTableVirtualOptions {
  itemHeight: number
  height: number | string
  buffer?: number
}

export type IrisTableColumnWidths = Record<string, number>

/** State pieces persistable via `persistState` (batch EJ, iris 独有). */
export type IrisTablePersistPiece =
  'sort' | 'filters' | 'columnVisibility' | 'columnOrder' | 'columnWidths' | 'pageSize'

/** One persisted state snapshot (batch EJ): the pieces `persistState` loads
 * and saves, keyed by piece name — a piece appears only when defined + included. */
export interface IrisTablePersistedState {
  sort?: IrisTableSortState | null
  filters?: Record<string, string>
  columnVisibility?: Record<string, boolean>
  columnOrder?: string[]
  columnWidths?: IrisTableColumnWidths
  pageSize?: number
}

/**
 * `persistState` configuration (batch EJ, iris 独有 — vxe has no built-in
 * state persistence). Persists view state (sort / filters / column widths /
 * page size) to a storage adapter so a table remounts where the user left it.
 * The table is CONTROLLED: restore replays through the change callbacks and
 * saves serialize the current props on every change. `columnVisibility` and
 * `columnOrder` are accepted for cross-framework parity but stay inert in this
 * bridge — neither has a change callback yet (fiat F1).
 */
export interface IrisTablePersistConfig {
  /** Storage adapter (`getItem`/`setItem`; defaults to `localStorage`).
   * `false` fully disables persistence — no reads, no writes. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | false
  /** Storage key. Default `'iris-table-state'`. */
  key?: string
  /** Pieces to persist. Defaults to ALL pieces. */
  include?: Array<IrisTablePersistPiece>
}

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

/** Imperative proxy/view handle (vxe loadData/reloadData/commitProxy parity). */
export interface IrisTableHandle {
  /** Replace the live rows without issuing a query. */
  loadData: (rows: Array<Record<string, unknown>>) => void
  /** Re-fetch the current proxy page; a local table is a no-op. */
  reloadData: () => void
  /** Merge query parameters and request the current proxy page. */
  commitProxy: (overrides: Partial<IrisTableProxyQueryParams>) => void
  /** Return the current proxy page snapshot, or null in local mode. */
  getProxyInfo: () => { page: number; pageSize: number; total: number } | null
  /** Clear the single and multi sort channels. */
  clearSort: () => void
  /** Clear the applied text/form filters and proxy filter channel. */
  clearFilter: () => void
  /** Remove rows by row-key without issuing a query; missing keys are no-ops. */
  removeRows: (keys: Array<string | number>) => void
  /** Snapshot (copy) of the currently filtered + sorted body rows. */
  getFilteredData: () => Array<Record<string, unknown>>
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
  /** Fired with parsed CSV rows by the import button. */
  onImport?: (rows: Array<Record<string, unknown>>) => void
  /** Custom action buttons rendered after the built-ins (vxe toolbar buttons parity). */
  buttons?: IrisTableToolbarButton[]
  /** Batch action rendered while rows are selected (vxe toolbar batch parity). */
  batch?: IrisTableToolbarBatch
}
