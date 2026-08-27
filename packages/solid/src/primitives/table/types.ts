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

/** External row sets used by adapter-local `table!field` formula references.
 * The first row of the named set is read; callers pass a new record when a
 * referenced table changes. */
export type IrisTableFormulaTables<Row extends Record<string, unknown> = Record<string, unknown>> =
  Record<string, Row[]>

export type IrisTableViewConfig = TableViewConfig
export type IrisTableViewSnapshot = TableViewSnapshot
export type IrisTableNamedView = TableNamedView<IrisTableViewSnapshot>
export type IrisTableTab = TableTab

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

export interface IrisTableColumn<Row = Record<string, unknown>> {
  key: string
  title: string
  dataIndex?: keyof Row | string
  /**
   * Single-line cell formula (batch EL, iris 独有 — vxe has no computed
   * columns; the closest is a display-only formatter). Evaluated by the core
   * `evaluateFormula` parser against each row: field refs + `+ - * / %` +
   * whitelist functions SUM/AVG/MIN/MAX/COUNT (case-insensitive), optional
   * leading `=`. `table!field` reads the first row's field from the optional
   * `formulaTables` prop. The COMPUTED value feeds every data consumer — cell
   * render, sorting, filtering, summary, range copy and CSV export (all via
   * the `getCellValue` choke point). Unknown tables, empty tables, unknown
   * fields, and bad formulas fail closed to null (empty cell). An `editable`
   * formula column is DISPLAY-ONLY: inline editing and row mode ignore it.
   * Overrides `dataIndex`.
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
  /** Show a header filter trigger + checkbox panel (vxe filterConfig parity).
   * Filtering OR-matches the raw `String(value)` against the checked set. */
  filterable?: boolean
  /** Checkbox options for the filter panel; a column without options can't filter. */
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
  renderSummary?: (value: number, rows: Row[]) => JSX.Element
  /** Custom cell render function. */
  renderCell?: (row: Row, index: number) => JSX.Element
  /**
   * Child columns. A column WITH children is a header GROUP (not a data column):
   * it renders only as a spanning header label, and its leaf descendants drive
   * the body. Additive — absent means a flat (single-row) header.
   */
  children?: IrisTableColumn<Row>[]
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
) => JSX.Element

export type IrisTableRowExpandable<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => boolean

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

/**
 * Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
 * set, `data` is ignored: rows come from `query` (paged), the table renders a
 * pager below the body, and edit write-back keeps working.
 */
export interface IrisTableProxyConfig<Row extends Record<string, unknown>> {
  /**
   * Fetch one page. 1-based `page`; `sort`/`filters` are the ACTIVE state,
   * passed through when `remoteSort`/`remoteFilter` are enabled.
   */
  query: (params: IrisTableProxyQueryParams) => Promise<{ rows: Row[]; total: number }>
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
 * Lazy tree loader (vxe-grid lazyLoad parity, batch J): called on the first
 * expand of a row that has no `getSubRows` children — `load` resolves the
 * children (caching them and expanding the row). A throwing load stays
 * retryable (the key is not cached); a stale resolution after the data
 * source changed is dropped.
 */
export type IrisTableLazyLoad<Row extends Record<string, unknown> = Record<string, unknown>> = (
  row: Row,
  load: (children: Row[]) => void,
) => void

/** One right-click menu entry (vxe MenuFirstOption code/name/disabled parity). */
export interface IrisTableContextMenuItem {
  key: string
  label: string
  disabled?: boolean
}

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

/** Inline-edit configuration (vxe-grid editConfig parity). */
export interface IrisTableEditConfig {
  /** What opens the editor. Default `'dblclick'`. */
  trigger?: 'click' | 'dblclick' | 'manual'
  /** Show a required asterisk next to headers of columns with rules. */
  showAsterisk?: boolean
  /** Drop the draft when opening another cell without committing. */
  autoClear?: boolean
  /** Edit mode (vxe editConfig.mode parity): `'cell'` (default) edits one cell
   * at a time; `'row'` opens every editable column of the clicked row together
   * — Enter/blur commits THAT column, Escape cancels the whole row, clicking
   * another row commits the current row's open editors first. */
  mode?: 'cell' | 'row'
}

/**
 * Imperative handle (vxe-grid proxy/view parity). Assigned to
 * `tableRef.current` on mount; every method runs against mount-time closures
 * that read the LATEST state (Solid props are getters, the proxy controller is
 * captured by reference), so no stale snapshot is possible.
 */
export interface IrisTableHandle<Row extends Record<string, unknown> = Record<string, unknown>> {
  /** Replace the live row list without a query (vxe loadData parity): fires
   * onDataChange; in proxy mode the proxy state total/page stays unchanged
   * until the next query replaces the page. */
  loadData: (rows: Row[]) => void
  /** Re-fetch the current page (vxe reloadData parity). Proxy mode only. */
  reloadData: () => void
  /** Merge params into the proxy query and fire the request (vxe commitProxy parity). */
  commitProxy: (overrides: Partial<IrisTableProxyQueryParams>) => void
  /** Proxy state snapshot (vxe getProxyInfo parity): page/pageSize/total; null without a proxy. */
  getProxyInfo: () => { page: number; pageSize: number; total: number } | null
  /** Clear the active sort (vxe clearSort parity) — single and multi channels. */
  clearSort: () => void
  /** Clear every filter channel (vxe clearFilter parity): text filters + checked sets. */
  clearFilter: () => void
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

import type { JSX } from 'solid-js'
