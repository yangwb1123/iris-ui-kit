import type { IrisTableColumn } from './column'

export type IrisTableSortDirection = 'asc' | 'desc'

/** Map of column key → current width in px (after any resizing). */
export type IrisTableColumnWidths = Record<string, number>

/**
 * Custom column panel options (vxe-grid customConfig parity, batch S): the
 * toolbar `columnSettings` button opens the full panel — search, drag reorder,
 * visibility toggles and reset — in place of the plain checkbox menu.
 */
export interface IrisTableCustomConfig {
  /** Reset button label; defaults to the i18n `table.customConfig.reset` key. */
  resetText?: string
}

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

/** Horizontal cell alignment (vxe align / header-align / footer-align parity). */
export type IrisTableAlign = 'left' | 'center' | 'right'

export interface IrisTableVirtualOptions {
  /** Per-row height in px (uniform), or a `(index) => px` function for known
   * variable heights (batch AG — the iris take on vxe `virtualYConfig` 增强
   * 模式; the fn receives the virtual PLAN index — memoize it). */
  itemHeight: number | ((index: number) => number)
  /** Viewport height. Number → px; string → CSS length. */
  height: number | string
  /** Extra rows rendered above and below the viewport. */
  buffer?: number
}

/** State pieces persistable via `persistState` (batch AG, iris 独有). */
export type IrisTablePersistPiece =
  | 'sort'
  | 'multiSortState'
  | 'filters'
  | 'filterValues'
  | 'columnVisibility'
  | 'columnOrder'
  | 'columnWidths'
  | 'pageSize'
  | 'expandedKeys'

/** One persisted state snapshot (batch AG): the pieces `persistState` loads
 * and saves, keyed by piece name — a piece appears only when defined + included. */
export interface IrisTablePersistedState {
  sort?: IrisTableSortState | null
  multiSortState?: IrisTableSortState[]
  filters?: Record<string, string>
  filterValues?: IrisTableFilterValues
  columnVisibility?: Record<string, boolean>
  columnOrder?: string[]
  columnWidths?: IrisTableColumnWidths
  pageSize?: number
  /** Batch BY: expanded row keys (detail panels + tree carets) captured by
   * the shared collector when `onExpandedRowsChange` is set and the table
   * actually expands (renderDetail or tree mode); restored through the
   * expansion model — `expansion.set` commits and replays
   * `onExpandedRowsChange(keys)` (expansion has no controlled prop, so the
   * callback is the parent-owned channel). Row keys are STRINGIFIED at the
   * model boundary, so the stored array is always strings; the snapshot
   * accepts raw keys and the restore coerces them. Stale keys (rows not
   * loaded yet) are fail-inert — the row simply renders expanded when it
   * arrives. */
  expandedKeys?: Array<string | number>
  /** Batch AJ: natural-language query captured by the named-views collector
   * when `query` is set; restored FIRST via `onQueryChange` on view apply
   * (persistState path stays byte-identical; legacy views load unchanged). */
  query?: string
}

/**
 * `persistState` configuration (batch AG, iris 独有 — vxe has no built-in
 * state persistence). Persists view state (sort / filters / column layout /
 * page size) to a storage adapter so a table remounts where the user left it.
 * The table is CONTROLLED: restore replays through the change callbacks and
 * saves serialize the current props on every change.
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

/** Periodic full view-state snapshots (batch DM, iris 独有). Unlike
 * `persistState`, this config owns a separate timer/key and writes the same
 * JSON shape exposed by `tableRef.exportStateJson()`. */
export interface IrisTableAutoSaveStateConfig {
  /** Positive interval in milliseconds; zero/invalid values disable the timer. */
  intervalMs?: number
  /** Storage adapter; defaults to `localStorage` when available. `false` disables IO. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | false
  /** Storage key. Defaults to `'iris-table-auto-state'`. */
  key?: string
}

/** One external drop target for rowDragBetween (batch DQ). */
export interface IrisTableRowDragBetweenTarget<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Value read from the target element's `data-iris-drop-zone` attribute. */
  key: string
  /** Called once with the dragged row when it is released over that target. */
  onDrop: (row: Row) => void
}

export type { IrisTableNamedView, IrisTableViewConfig } from '../useTableViews'

/**
 * One table tab (batch CT, iris 独有 — vxe has no parity): a named tab in
 * the `tableTabs` strip rendered ABOVE the toolbar. Clicking the tab applies
 * each view name in `views` IN ORDER through the SAME `selectView` path the
 * toolbar select uses — unknown names are skipped fail-inert, and when
 * several views touch the same state piece the LAST applied view wins (the
 * toolbar select then mirrors that last view). An empty `views` array
 * renders an inert tab; without the `views` config the whole strip is inert.
 */
export interface IrisTableTab {
  /** Tab key (identity — the first occurrence wins on duplicates). */
  key: string
  /** Tab label. */
  label: string
  /** Named views applied in order on click; omitted → inert tab. */
  views?: string[]
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
  sort: IrisTableSortState | null
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
