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

export type { IrisTableNamedView, IrisTableViewConfig } from './useTableViews'

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
  /**
   * Single-line cell formula (batch AO, iris 独有 — vxe has no computed
   * columns; the closest is a display-only formatter). Evaluated by the core
   * `evaluateFormula` parser against each row: field refs + `+ - * / %` +
   * whitelist functions SUM/AVG/MIN/MAX/COUNT (case-insensitive), optional
   * leading `=`. The COMPUTED value feeds every data consumer — cell render,
   * sorting, filtering, grouping, summary, range stats, clipboard and CSV
   * export. Errors / unknown fields → null (empty cell). An `editable`
   * formula column is DISPLAY-ONLY: inline editing, row mode and batch edit
   * ignore it. Overrides `dataIndex` / `sortBy`. Leading `=` optional.
   */
  formula?: string
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
  /** Batch AN column preset (iris 独有): fills display defaults from the core
   * factory — `'money'` (2 decimals + thousands separator, right-aligned,
   * number editor + numeric editRules), `'progress'` (percent text, right),
   * `'date'` (String passthrough, left), `'status'` (UPPERCASE text, center).
   * User fields always win over the preset defaults (defined-fields-only
   * merge); localized formatting stays the caller's job. */
  preset?: import('@iris-ui-kit/core').ColumnPreset
  /**
   * Native datalist suggestions while editing (batch AM, iris 独有): `true`
   * builds the option list from the DISTINCT cell values of this column over
   * the current body data (String-coerced, null/'' excluded, sorted, capped at
   * 50); an explicit array of `string | number` is used verbatim. Text editor
   * only — the number/select/textarea editors ignore it. */
  suggest?: boolean | Array<string | number>
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
  /** Mask this column's value for display (batch AY, iris 独有 — vxe has no
   * built-in masking): `'sensitive'` applies the core `maskValue` sensitive
   * rule (email → 11-digit phone → generic); a custom function receives the
   * RAW cell value and returns the masked string. Applied FIRST in the
   * display chain — `render`/`html`/`link`/`formatter`/tooltip all see the
   * masked value (a `formatter` receives the masked STRING); inline editing,
   * validation, sorting, filtering, summary, range stats and conditional
   * styles keep reading the RAW value. Export/copy mask by default unless
   * `exportRaw` is set. */
  mask?: 'sensitive' | ((value: unknown) => string)
  /** Export/copy the RAW value instead of the masked one (batch AY): when
   * true, `exportCsv`/`exportCurrentViewCsv`/`exportSelectionCsv` and the
   * clipboard TSV skip this column's mask. Display keeps masking. */
  exportRaw?: boolean
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
  /** Hide this column entirely (vxe column visibleMethod parity, batch U): a
   * predicate evaluated in the display-columns memo (at most once per
   * render); `false` hides the column even when `columnVisibility` says
   * visible (the column's own veto wins). Absent / `true` keeps it. Scope
   * mirrors `columnVisibility`: top-level columns only — a grouped column's
   * leaf `visibleMethod` is not consulted (same documented simplification). */
  visibleMethod?: () => boolean
}

/** Params delivered to `IrisTableProps.footerMethod` (vxe footer-method parity). */
export interface IrisTableFooterMethodParams<Row = Record<string, unknown>> {
  /** Leaf columns of the table (grouped headers flattened). */
  columns: IrisTableColumn<Row>[]
  /** Full body rows (sorted + filtered). */
  data: Row[]
}

export interface IrisTableCellEditEvent<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  oldValue: unknown
  newValue: unknown
  rowIndex: number
}

/** Params delivered to `IrisTableProps.onEditStart` (vxe edit-activated parity, batch V). */
export interface IrisTableEditStartParams<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  rowIndex: number
}

/**
 * Params delivered to `IrisTableProps.onEditClosed` (vxe edit-closed parity,
 * batch V). Cell mode only — row-edit sessions commit per column through
 * their own stores and are not reported (documented simplification); an
 * async-validating commit that lands after `commitEdit` returned is also not
 * reported (the sync path fires with the committed value).
 */
export interface IrisTableEditClosedParams<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  rowIndex: number
  /** The committed value; undefined when the edit was cancelled. */
  value?: unknown
  /** true when the edit was cancelled (Escape) instead of committed. */
  cancelled: boolean
}

/** Scroll coordinates delivered to `IrisTableProps.onScroll` (vxe scroll parity, batch V). */
export interface IrisTableScrollParams {
  scrollTop: number
  scrollLeft: number
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

/**
 * One header-merge entry (vxe-grid mergeHeaderCells parity, batch P). The
 * coordinate space is the FLAT header's leaf-column index: `row` 0 only —
 * entries with `row` > 0 are ignored (the flat header is a single row), and
 * grouped headers are NOT merged (documented simplification).
 */
export interface IrisTableMergeCell {
  /** Header row index — only 0 is supported (flat header). */
  row: number
  /** Leaf-column index of the merged cell's origin. */
  col: number
  /** Columns spanned (gridColumnEnd); the covered cells render null. */
  colspan?: number
  /** Rows spanned (gridRowEnd); inert on the single flat header row. */
  rowspan?: number
}

/**
 * Span result shared by `spanMethod` and `footerSpanMethod` (vxe
 * span-method / footer-span-method parity): both dimensions default to 1;
 * values > 1 make the cell span adjacent cells, which then render null.
 * Footer note: `rowspan` is inert in the footer stack (each footer row is
 * its own grid container — see `footerSpanMethod`).
 */
export interface IrisTableSpan {
  rowspan?: number
  colspan?: number
}

/** Params delivered to `IrisTableProps.footerSpanMethod` (vxe footer-span-method parity, batch P). */
export interface IrisTableFooterSpanParams<Row = Record<string, unknown>> {
  /** 0-based row index over the rendered footer stack (footerMethod rows →
   * summary row → footerData rows, whichever render). */
  rowIndex: number
  columnIndex: number
  /** Leaf columns of the table (grouped headers flattened). */
  columns: IrisTableColumn<Row>[]
  /** Full body rows (sorted + filtered). */
  data: Row[]
}

/** Footer cell merge callback (vxe footer-span-method parity, batch P). */
export type IrisTableFooterSpanMethod<Row = Record<string, unknown>> = (
  params: IrisTableFooterSpanParams<Row>,
) => IrisTableSpan | null

/** vxe-grid scrollbarConfig parity (batch Q): `theme: 'thin'` → 6px webkit + Firefox `scrollbar-width: thin` via `data-iris-scrollbar-thin`. */
export type IrisTableScrollbarConfig = { theme?: 'default' | 'thin' }

/** vxe-grid editDirtyConfig parity (batch Q): a committed cell whose value
 * differs from its pre-edit original renders a primary dot
 * (`data-iris-cell-dirty`); committing the original value clears it.
 * `indicator: false` suppresses the dot (tracking stays); `className: true`
 * also adds an `iris-table-cell-dirty` class for custom styling. */
export type IrisTableEditDirtyConfig = { indicator?: boolean; className?: boolean }

/**
 * One conditional-formatting rule (batch AX, iris 独有 — vxe has no built-in
 * conditional-formatting engine). Passed via `IrisTableProps.conditionalStyles`:
 * a rule matches a body cell when its optional `column` filter (omitted →
 * every column) equals the cell's column key AND `when(row, value)` returns
 * true — `value` is the RAW cell value (`dataIndex ?? key` resolved, formula
 * columns computed via `getCellValue`). Matching rules merge in array order
 * after `cellStyle`; later rules win on conflicting style keys.
 */
export interface IrisTableConditionalStyle<Row = Record<string, unknown>> {
  /** Column key the rule applies to; omitted → every column. */
  column?: string
  /** Match predicate: `row` is the full row object, `value` the raw cell value. */
  when: (row: Row, value: unknown) => boolean
  /** Inline styles merged onto the body cell when the rule matches. */
  style: import('react').CSSProperties
}

/**
 * One footer-merge entry (vxe-grid mergeFooterItems parity, batch R). The
 * coordinate space matches `footerSpanMethod`: `row` is the 0-based index
 * over the rendered footer stack (footerMethod rows → summary row →
 * footerData rows, whichever render) and `col` the leaf-column index — both
 * start at 0. The function (`footerSpanMethod`) wins when both are provided.
 */
export interface IrisTableMergeFooterItem {
  /** 0-based footer-stack row index (footerMethod rows → summary row → footerData rows). */
  row: number
  /** Leaf-column index of the merged cell's origin. */
  col: number
  /** Columns spanned (gridColumnEnd); the covered cells of the same row render null. */
  colspan?: number
  /** Rows spanned — INERT (each footer row is its own grid container, so
   * `gridRowEnd` cannot cross rows): covered cells of later rows keep their
   * own data, like `footerSpanMethod`'s rowspan. */
  rowspan?: number
}

/**
 * Imperative row operations (vxe-grid insert/remove/setRow parity, key
 * addressing). Assigned to `tableRef.current` on mount; every op applies a
 * core pure helper, commits through the cell-edit write-back channel and
 * fires `onDataChange`. Missing keys are silent no-ops.
 */
export interface IrisTableHandle<Row extends Record<string, unknown> = Record<string, unknown>> {
  /** Insert a row at `index` (default: end). A missing `rowKeyField` value gets an auto id. */
  insertRow: (row: Row, index?: number) => void
  /** Remove the row with `key`; its selection is pruned. */
  removeRow: (key: string | number) => void
  /** Batch-remove several rows by key (vxe removeRows parity): missing keys are silent no-ops, selection is pruned, one onDataChange fires. */
  removeRows: (keys: Array<string | number>) => void
  /** Patch the row with `key` ({ ...row, ...patch }). */
  updateRow: (key: string | number, patch: Partial<Row>) => void
  /** Re-fetch the current page (proxy mode). */
  refetch: () => void
  /** Replace the live row list (vxe loadData parity, batch V): fires onDataChange; in proxy mode the proxy state total stays unchanged until the next query (the core remote source has no setData — documented). */
  loadData: (rows: Row[]) => void
  /** Re-fetch the current page (vxe reloadData parity, batch V — alias of refetch). */
  reloadData: () => void
  /** Merge params into the proxy query and fire the request (vxe commitProxy parity, batch V). */
  commitProxy: (overrides: Partial<IrisTableProxyQueryParams>) => void
  /** Proxy state snapshot (vxe getProxyInfo parity, batch V): page/pageSize/total; null without a proxy. */
  getProxyInfo: () => { page: number; pageSize: number; total: number } | null
  /** Snapshot (copy) of the current live row list (vxe getTableData parity). */
  getData: () => Row[]
  /** Snapshot (copy) of the currently filtered + sorted rows (vxe getFilteredData parity, batch W): the filteredData memo value — the loaded page after local filters/sort (proxy mode: page after the prop `filters` merge), remoteFilter passes rows through unchanged. The handle object is re-created every render, so this always closes over the latest memo. */
  getFilteredData: () => Row[]
  /** Serialize the CURRENT filtered view as CSV (batch W): `exportCsv(getFilteredData(), displayColumns)` — hidden columns excluded (displayColumns drops columnVisibility/visibleMethod hides), formula injection neutralized; returns a plain string without BOM (caller downloads via `downloadCsv`). */
  exportCurrentViewCsv: () => string
  /** Serialize the SELECTED rows as CSV (batch AP, iris 独有): selected rows
   * in bodyData order (filtered + sorted + tree-flattened) → the same
   * `exportCsv` shape as `exportCurrentViewCsv` (formula columns materialized
   * on shadow rows, hidden columns excluded); empty selection → `''` (caller
   * detects via `getSelection()`). */
  exportSelectionCsv: () => string
  /** Current selection keys (vxe getCheckboxRecords parity). */
  getSelection: () => Array<string | number>
  /** Clear every selected row (vxe clearCheckboxRow parity). */
  clearSelection: () => void
  /** Select every checkMethod-eligible row of the current page (vxe
   * setAllCheckboxRow(true) parity — `checkMethod` rows are skipped). */
  selectAll: () => void
  /** Toggle a single row's selection by key (vxe toggleCheckboxRow parity —
   * a direct toggle that bypasses `checkMethod`). */
  toggleRowSelection: (key: string | number) => void
  /** Scroll the row with `key` into view (vxe scrollToRow parity); no-op when the row is not rendered. */
  scrollToRow: (key: string | number) => void
  /** Toggle a row's expand state (vxe toggleRowExpand parity): tree mode toggles the caret, detail mode the panel; no-op for plain tables. */
  toggleRowExpand: (key: string | number) => void
  /** Clear the active sort (vxe clearSort parity) — single and multi channels. */
  clearSort: () => void
  /** Clear every filter channel (vxe clearFilter parity): text filters + checked sets. */
  clearFilter: () => void
  /** Set the current (highlighted) row (vxe setCurrentRow parity); no-op without onCurrentRowChange (or an unknown key). */
  setCurrentRow: (key: string | number) => void
  /** Set the current (highlighted) column (vxe setCurrentColumn parity); no-op without onCurrentColumnChange (or an unknown key). */
  setCurrentColumn: (key: string) => void
  /** Audit trail snapshot (batch AT, iris 独有): newest-first entries (seq/at/type/rowKey/column/old→new) — an empty array when `auditLog` is off or nothing was committed yet. */
  getAuditLog: () => ReadonlyArray<IrisTableAuditEntry>
  /** Wipe every audit entry (batch AT, iris 独有): the seq counter never resets — audit integrity. No-op without `auditLog`. */
  clearAuditLog: () => void
  /** Version-history snapshot (batch BA, iris 独有): newest-first LIGHTWEIGHT entries (index/at/type — deliberately WITHOUT rows, so the snapshot stays cheap; `restoreVersion` fetches the rows from the controller) — an empty array when `versionHistory` is off or nothing was committed yet. */
  getVersions: () => ReadonlyArray<IrisTableVersionEntry>
  /** Restore the rows captured before the commit with `index` (batch BA, iris 独有): applies them through the normal write-back channel (`commitRowList`, type `'undo'` — auditable and undoable) WITHOUT pushing a new version; no-op for an unknown index (trimmed/cleared) or without `versionHistory`. */
  restoreVersion: (index: number) => void
}

/**
 * Audit-trail entry shape (batch AT, iris 独有) — mirrors the core
 * `AuditLogEntry` contract (the handle returns a snapshot of the controller
 * ring). Row-level structural changes (insert/remove) carry only `rowKey`.
 */
export interface IrisTableAuditEntry {
  /** Monotonic sequence number (never resets on clear — audit integrity). */
  seq: number
  /** Epoch ms when the entry was pushed. */
  at: number
  /** Commit kind: edit / insert / remove / paste / batch / fill / undo / redo. */
  type: 'edit' | 'insert' | 'remove' | 'paste' | 'batch' | 'fill' | 'undo' | 'redo'
  /** Key of the first changed row (undefined when none could be resolved). */
  rowKey?: string | number
  /** Column key of the first changed cell (undefined for row-level ops). */
  column?: string
  /** Value before the change. */
  oldValue?: unknown
  /** Value after the change. */
  newValue?: unknown
}

/**
 * Version-history entry shape (batch BA, iris 独有) — a LIGHTWEIGHT mirror of
 * the core `VersionHistoryEntry` WITHOUT the rows (the handle snapshot stays
 * cheap; `restoreVersion(index)` fetches the rows from the controller).
 */
export interface IrisTableVersionEntry {
  /** Monotonic version index (never resets on clear). */
  index: number
  /** Epoch ms when the version was pushed. */
  at: number
  /** Commit-kind hint: edit / insert / remove / paste / batch / fill / undo / redo. */
  type: 'edit' | 'insert' | 'remove' | 'paste' | 'batch' | 'fill' | 'undo' | 'redo'
}

/**
 * Collaborative-presence cursor entry (batch BD, iris 独有 — vxe has no
 * cursor sharing): one remote participant's cursor on a selected cell. Pure
 * display — the table renders the entry verbatim and owns no collaboration
 * state or logic. `cellKey` uses the canonical `${rowKeyVal}::${colKey}`
 * delimiter (the same as `cellId` and the `annotations` map keys).
 */
export interface IrisTablePresenceEntry {
  /** Stable participant id (also surfaced as `data-iris-presence-id`). */
  id: string
  /** Participant display name — the text of the cell's corner label. */
  name: string
  /** Cursor color, used verbatim: the cell outline + the label background. */
  color: string
  /** Target cell: `${rowKeyVal}::${colKey}` (same delimiter as `cellId`). */
  cellKey: string
}

/** Pager configuration (vxe-grid pagerConfig parity). */
