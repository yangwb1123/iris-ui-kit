export type IrisTableSortDirection = 'asc' | 'desc'

/** Map of column key → current width in px (after any resizing). */
export type IrisTableColumnWidths = Record<string, number>

export type IrisTableEditor = 'text' | 'number' | 'select' | 'textarea'

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
  /**
   * Multi-column sort (vxe sort-config.multiple parity), most-significant
   * first. Present only in multiSort mode — single mode keeps passing `sort`.
   */
  sorts?: IrisTableSortState[]
  filters: Record<string, string>
}

/**
 * Edit-validation presentation (vxe-grid ValidConfig parity).
 */
export interface IrisTableValidConfig {
  /**
   * Render the inline editor error message (`data-iris-table-editor-error`).
   * `false` still runs validation and blocks the commit — only the message
   * element is skipped (`aria-invalid` stays). Default true.
   */
  showMessage?: boolean
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
  /** Render the cell value as a link (vxe... no direct parity, batch L): return
   * `{ href, label?, target? }` or a plain href string; `null`/`undefined` falls
   * through to the formatter/raw value. The anchor text is `label` when given,
   * otherwise the formatted (or raw) text; `target: '_blank'` adds `rel="noreferrer"`. */
  link?: (
    value: unknown,
    row: Row,
  ) => { href: string; label?: string; target?: string } | string | null
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
   * Options for the `'select'` editor (vxe edit-render options parity). A
   * column with `editor: 'select'` renders a native `<select>` while editing;
   * each option commits its TYPED value — a number option commits a number,
   * a string option a string (matched by `String(value)`). When the current
   * cell value matches no option, a synthetic option preserves it so a plain
   * blur never silently replaces it.
   */
  editOptions?: Array<{ value: string | number; label: string }>
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
  /** Format a cell's value for display (vxe formatter parity, batch I). Applied AFTER
   * `render`/`html` and BEFORE the raw value; sorting, filtering, editing and summary
   * keep reading the RAW value. The tooltip defaults to the formatted text when it is
   * a string. */
  formatter?: (value: unknown, row: Row) => import('react').ReactNode
  /** Show a header filter trigger + checkbox panel (vxe filterConfig parity, batch I).
   * Filtering OR-matches the raw `String(value)` against the checked set. */
  filterable?: boolean
  /** Checkbox options for the filter panel; a column without options can't filter. */
  filterOptions?: IrisTableFilterOption[]
  /**
   * Group the body by this column's value (vxe group-config parity, batch M):
   * a group header row per distinct value (first-appearance order,
   * `data-iris-group-row`) showing the value + count, then that group's rows,
   * then a per-group summary row (`data-iris-group-summary`, same `summary`
   * ops as the footer computed over the group's rows) when any column has a
   * `summary` op. Flat mode only — tree mode ignores grouping (fail-closed);
   * proxy mode groups per loaded page. Only the first `groupBy` column drives
   * the plan.
   */
  groupBy?: boolean
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

/**
 * Cell tooltip configuration (vxe-grid tooltipConfig parity, title mode).
 * Renders a native `title` on every body cell — no portal, no positioning.
 * Empty content drops the tooltip (vxe empty-content parity); editing cells
 * are exempt.
 */
export interface IrisTableTooltipConfig<Row = Record<string, unknown>> {
  /**
   * Render a tooltip on every body cell. Default true when `tooltipConfig` is
   * set. Truncation-based gating (vxe `showAll: false`) is not implemented —
   * cells always carry the `title` (documented simplification: detecting a
   * truncated cell cheaply isn't possible without layout measurement).
   * `false` is accepted for API parity and behaves identically this batch.
   */
  showAll?: boolean
  /**
   * Custom tooltip text for a cell. Defaults to the raw cell value. Returning
   * an empty string drops the tooltip (vxe empty-content parity).
   */
  content?: (row: Row, column: IrisTableColumn<Row>) => string
}
