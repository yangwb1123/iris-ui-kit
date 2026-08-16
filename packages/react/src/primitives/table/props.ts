import type { CSSProperties, MutableRefObject, ReactNode } from 'react'
import type { IrisTableKeyAction } from '@iris-ui-kit/core'
import type {
  IrisTableCellEditEvent,
  IrisTableEditStartParams,
  IrisTableEditClosedParams,
  IrisTableScrollParams,
  IrisTableAlign,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableConditionalStyle,
  IrisTableContextMenuParams,
  IrisTableCustomConfig,
  IrisTableFooterMethodParams,
  IrisTableFormField,
  IrisTableHandle,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
  IrisTableSortState,
  IrisTableTooltipConfig,
  IrisTableValidConfig,
  IrisTableVirtualOptions,
  IrisTableMergeCell,
  IrisTableMergeFooterItem,
  IrisTableFooterSpanMethod,
  IrisTablePresenceEntry,
} from './types'
/**
 * vxe-grid proxyConfig parity — the server-side data proxy (query slice).
 * When set, `data` is ignored: rows come from `query` (paged), the table
 * renders a pager below the body, and edit write-back keeps working.
 */
export interface IrisTableProxyConfig<Row extends Record<string, unknown>> {
  /**
   * Fetch one page. 1-based `page`; `sort`/`filters` are the ACTIVE state,
   * passed through when `remoteSort`/`remoteFilter` are enabled.
   */
  query: (
    params: import('./types').IrisTableProxyQueryParams,
  ) => Promise<{ rows: Row[]; total: number }>
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
  /** Cumulative sequence numbers across pages (batch L): with the table `seq`
   * prop, the seq cell renders `(page - 1) * pageSize + rowIndex + 1` instead of `rowIndex + seqStartIndex`. `seqMethod` still wins. */
  seq?: boolean
  /** Fired when the page changes. */
  onPageChange?: (page: number, pageSize: number) => void
}

/**
 * Search-form configuration (vxe-grid formConfig parity): a field row above
 * the toolbar; submit merges values into the filters (client-side or proxy).
 */
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

/** Empty-state descriptor (iris 独有 — vxe has no empty-state action button):
 * object form of `emptyState` renders centered text (optional) plus an inline
 * action button. A plain ReactNode stays on the node path untouched. */
export interface IrisTableEmptyState {
  /** Empty-state text (falls back to the localized default when omitted). */
  text?: ReactNode
  /** Action button rendered inline after the text. */
  action?: { label: string; onClick: () => void }
}

/** Pager configuration (vxe-grid pagerConfig parity). */
export interface IrisTablePagerConfig {
  /** Rows-per-page options rendered as a size selector next to the pager. A
   * change re-queries with the new size and resets the page to 1. */
  pageSizes?: number[]
  /** Show the total-row count (i18n `table.total`) before the size selector (vxe pagerConfig.showTotal parity). */
  showTotal?: boolean
}

/** Public input surface for the React table adapter. */
/** Row-density preset (iris 独有 — vxe has no density concept): the three
 * tiers stack ON TOP of `size` — both write `--iris-cell-pad-y`, and the
 * density rules come later in the stylesheet (same specificity, later
 * wins). Default comfortable. */
export type IrisTableDensity = 'comfortable' | 'compact' | 'cozy'

export interface IrisTableProps<Row extends Record<string, unknown> = Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  /** Table data. Optional when `proxyConfig` is set (server-side source). */
  data?: Row[]
  /** Field to use as the row key. */
  rowKey?: string
  /** Selection mode. */
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  defaultSelection?: Array<string | number>
  onSelectionChange?: (next: Array<string | number>) => void
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  onSortChange?: (next: IrisTableSortState | null) => void
  /** Multi-column sort (vxe sort-config.multiple parity): header clicks
   * append/cycle columns in click order instead of replacing. Default false. */
  multiSort?: boolean
  /** Controlled multi-column sort state (multiSort mode). */
  multiSortState?: IrisTableSortState[]
  /** Default multi-column sort (multiSort mode, uncontrolled). */
  defaultMultiSort?: IrisTableSortState[]
  onMultiSortChange?: (next: IrisTableSortState[]) => void
  striped?: boolean
  /** Size preset (vxe-grid size parity): medium / small / mini. */
  size?: 'medium' | 'small' | 'mini'
  /**
   * Row-density preset (iris 独有 — vxe has no density concept): three tiers
   * of row/cell padding stacked on top of `size` (both write
   * `--iris-cell-pad-y`; density wins on ties). Default comfortable.
   */
  density?: IrisTableDensity
  /**
   * Toolbar density-toggle button (iris 独有 — vxe has no density toggle):
   * cycles comfortable → compact → cozy → comfortable; while shown, the
   * button state wins over the `density` prop.
   */
  densityToggle?: boolean
  /** First sequence number (vxe seq-config.startIndex parity). Default 1. */
  seqStartIndex?: number
  /** Custom sequence renderer (vxe seq-config.seqMethod parity). */
  seqMethod?: (params: import('./types').IrisTableSeqMethodParams) => string | number
  /** Current (highlighted) row key (vxe row-config.isCurrent parity). */
  currentRowKey?: string | number
  /** Fired when the current row changes (row click). */
  onCurrentRowChange?: (key: string | number, row: Row) => void
  /** Veto a current-row change: return false to keep the previous row. */
  beforeCurrentRowChange?: (key: string | number, row: Row) => boolean | void
  /** Current (highlighted) column key (vxe column-config.isCurrent parity). */
  currentColumnKey?: string
  /** Fired when the current column changes (header click). */
  onCurrentColumnChange?: (key: string) => void
  /** Header cell click (vxe header-click parity). Fired after the sort toggle on sortable headers. */
  onHeaderClick?: (column: IrisTableColumn<Row>) => void
  /** Veto a current-column change: return false to keep the previous column. */
  beforeCurrentColumnChange?: (key: string) => boolean | void
  /** Hide the header row(s) (vxe show-header parity). Default true. */
  showHeader?: boolean
  /**
   * Custom footer rows (vxe footer-data parity): rendered below the summary
   * row, one grid row per entry; structure matches `data`.
   */
  footerData?: Row[]
  /** Custom footer rows (vxe footer-method parity, batch N): one grid row per returned entry, cell value = `entry[col.key]`, same styling as the summary row; `footerData` renders below. `columns` = leaf columns, `data` = full filtered rows. */
  footerMethod?: (params: IrisTableFooterMethodParams<Row>) => Row[]
  /** Footer cell merge (vxe footer-span-method parity, batch P): `colspan` > 1 spans adjacent cells (covered cells skipped, same occupy pattern as `spanMethod`); `rowspan` inert (each footer row is its own grid container). Applies over the footer stack in order: footerMethod rows → summary row → footerData rows; `rowIndex` is 0-based over that stack, `columns` = leaf columns, `data` = full filtered body rows. Group summary rows are not part of the stack. */
  footerSpanMethod?: IrisTableFooterSpanMethod<Row>
  /** Header cell alignment (vxe header-align parity): `headerAlign` wins over
   * the column's `align`, then 'left'. Applies to flat + grouped headers. */
  headerAlign?: IrisTableAlign
  /** Footer/summary cell alignment (vxe footer-align parity): `footerAlign`
   * wins over the column's `align`. Applies to summary, footer-method, footer-data. */
  footerAlign?: IrisTableAlign
  /**
   * Auto-detect column types (batch CX, iris 独有 — vxe requires the caller
   * to declare `sortType` per column; no auto inference): on FIRST data
   * arrival, each leaf column's value kind (`string`/`number`/`date`/
   * `boolean`) is inferred by the core `detectColumnType` from its first 50
   * non-nullish values (all-samples-agree; mixed columns and numeric/boolean
   * STRINGS fall back to `string`). Detected columns receive the matching
   * default alignment + `sortType` — `number` → right-aligned + `'number'`
   * sort, everything else → left + `'string'` — filling ONLY the fields the
   * caller left `undefined` (explicit `align`/`sortType` always win; preset
   * defaults survive). One-shot per mount (later data re-feeds never
   * re-detect); SSR-safe (effect-driven, the fill lands post-hydration).
   * Default false — byte-identical with the pre-prop render path.
   */
  autoDetectTypes?: boolean
  /** Batch CM (iris 独有 — vxe has no summary sticky parity): `'sticky'` pins
   * the GLOBAL summary row (op row or footerMethod rows — the two renders
   * that occupy the same footer slot) to the viewport's bottom edge inside
   * the fixed-height scroll container (`position: sticky; bottom: 0`;
   * gated by `[data-iris-table-fixed-height]`, same z-index 1 as pinned
   * columns). Two explicit fiats: per-group summary rows never stick (groups
   * would fight over the bottom edge) and footerData rows never stick
   * (contractually rendered below the summary). Pure CSS additive; default
   * `'default'` — fail-closed, no sticky attr. */
  summaryRowStyle?: 'default' | 'sticky'
  /**
   * Decimal places for summary/footer aggregate values (vxe
   * aggregateAccuracyConfig parity, batch P): a finite numeric op result is
   * rounded via `Number(value.toFixed(n))` at the single summary point
   * (global + per-group summaries), before `renderSummary` — custom renderers
   * see the rounded value. Non-finite results are left untouched. Values
   * outside 0–100 (inclusive) are ignored — no rounding (`toFixed`
   * RangeError guard). Default: no rounding.
   */
  aggregateAccuracy?: number
  /** Per-row class hook (vxe row-class-name parity). */
  rowClassName?: (row: Row, rowIndex: number) => string
  /** Per-cell class hook (vxe cell-class-name parity). */
  cellClassName?: (row: Row, column: IrisTableColumn<Row>, rowIndex: number) => string
  /** Per-header-cell class hook (vxe header-cell-class-name parity). */
  headerCellClassName?: (column: IrisTableColumn<Row>) => string
  /** Per-footer-cell class hook (vxe footer-cell-class-name parity). */
  footerCellClassName?: (column: IrisTableColumn<Row>, rowIndex: number) => string
  /** Per-row inline style hook (vxe row-style parity). */
  rowStyle?: (row: Row, rowIndex: number) => CSSProperties
  /** Per-cell inline style hook (vxe cell-style parity). */
  cellStyle?: (row: Row, column: IrisTableColumn<Row>, rowIndex: number) => CSSProperties
  /** Conditional cell styles (batch AX, iris 独有): an ordered rule list merged onto matching body cells AFTER `cellStyle` — later matching rules win on conflicting keys. A rule matches when its `column` filter (omitted → every column) equals the cell's column key AND `when(row, value)` is true; `value` is the RAW cell value (dataIndex ?? key resolved, formula columns computed). Rules evaluate inline per visible cell (cost = visibleCells × rules; virtual scroll bounds it — memoize the array in the caller). */
  conditionalStyles?: IrisTableConditionalStyle<Row>[]
  /** External table data for cross-table formula refs (batch BC, iris 独有): `=other!col` reads `formulaTables['other'][0]['col']` (the FIRST row of the named table). Missing tables arg / unknown table / EMPTY table / unknown field → the whole formula null (fail-closed); a known nullish field coerces (Excel parity). Immutable contract: pass a NEW object when referenced tables change. */
  formulaTables?: Record<string, Row[]>
  /** Per-header-cell inline style hook (vxe header-cell-style parity). */
  headerCellStyle?: (column: IrisTableColumn<Row>) => CSSProperties
  /** Per-footer-cell inline style hook (vxe footer-cell-style parity). */
  footerCellStyle?: (column: IrisTableColumn<Row>, rowIndex: number) => CSSProperties
  /** Cell click (vxe cell-click parity). Fired after internal handlers. */
  onCellClick?: (params: import('./types').IrisTableCellClickParams<Row>) => void
  /** Cell double-click (vxe cell-dblclick parity). Fired AFTER the inline edit starts on editable columns; non-editable columns fire it too. */
  onCellDblClick?: (params: import('./types').IrisTableCellClickParams<Row>) => void
  bordered?: boolean
  /**
   * Rounded root corners (vxe-grid round parity, batch P): the root gets
   * `border-radius: var(--iris-radius-lg, 10px)` when `bordered && round`;
   * otherwise the default md radius applies.
   */
  round?: boolean
  /**
   * Cell padding override (vxe-grid deprecated `padding` parity, batch P):
   * sets `--iris-cell-pad` on the root; every cell padding reads
   * `var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)`, so the size
   * presets (small/mini) still win through `--iris-cell-pad-y`.
   */
  padding?: string
  /** Enable column resizing (drag the header's trailing edge or focus + arrow keys). */
  resizableColumns?: boolean
  /** Controlled per-column pixel widths, keyed by column `key`. */
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  /**
   * Toolbar reset-widths button (iris 独有, batch BO): clicking it calls
   * `onColumnWidthsChange({})` — the empty map means zero overrides, so every
   * column falls back to its declared width. Like `zoomConfig`, this prop
   * alone does not create the toolbar.
   */
  columnWidthsReset?: boolean
  /**
   * Column header pin menu (batch BX, iris 独有 — vxe has no built-in
   * header pin menu): when true, right-clicking a column HEADER opens a
   * built-in menu — 固定左 (key `__iris-pin-left`) when the column is not
   * pinned, 取消固定 (key `__iris-unpin`) when it is pinned left OR right
   * (the item flips with the column's CURRENT pin state, single and mutually
   * exclusive — spec has no pin-right action). The menu is fully independent
   * of `contextMenu` (which only opens on body cells and never on headers):
   * `columnPinMenu` works with NO `contextMenu` configured, and the two are
   * separate floating instances — opening one closes the other. Every action
   * fires `onColumnPinnedChange` in BOTH controlled and uncontrolled modes
   * (`onColumnWidthsChange` dual-channel precedent, no optimistic flip when
   * controlled); without `pinnedColumns` the table holds the pin state
   * internally and the static `col.pinned` declaration seeds the fallback.
   * Additive — default off.
   */
  columnPinMenu?: boolean
  /**
   * Controlled per-column pin state (batch BX): column key → `'left'` /
   * `'right'` / `null` (unpinned). When set, the map is the ONLY read source
   * for the rendered pin state — an explicit `null` entry overrides a static
   * `col.pinned` declaration (controlled-null-wins); absent keys fall back to
   * the column's own declaration, so `{}` never unpins static pins.
   */
  pinnedColumns?: Record<string, 'left' | 'right' | null>
  /**
   * Fired on every pin-menu action with the column key and the next side
   * (`null` = unpin), in both controlled and uncontrolled modes (lift-ready).
   */
  onColumnPinnedChange?: (key: string, side: 'left' | 'right' | null) => void
  /**
   * Pinned-count boundary drag (batch CV, iris 独有 — vxe has no pinned
   * boundary handle): when true, the LAST left-pinned leaf header's trailing
   * edge carries a draggable separator handle (8px grip + 2px primary line,
   * sticky inside the pinned cell) that adjusts the number of left-pinned
   * columns — drag right pins more / drag left unpins, commit-on-release (a
   * translateX ghost follows the pointer while dragging); Arrow-Left/Right
   * nudge the count by one. The commit writes `setColumnPinned('left' |
   * null)` per CHANGED column (the SAME dual-channel throat as the pin menu —
   * `onColumnPinnedChange` fires per column in both modes, no optimistic
   * flip when controlled) and then fires `onPinnedCountChange` once; no-op
   * drags fire nothing. Left-only count: no handle without at least one
   * left-pinned column; the boundary never crosses the first right-pinned
   * index (hard cap); widths approximate via the pinnedOffsets fallback
   * chain (non-numeric → default, fiat). While on, the boundary column's
   * `resizableColumns` handle is suppressed (a resize grip on the same edge
   * would fight the boundary drag). Additive — default off.
   */
  pinnedDrag?: boolean
  /** Fired once per pinned-boundary commit with the new left-pinned column count (0 = none), AFTER the per-column `onColumnPinnedChange` calls. */
  onPinnedCountChange?: (count: number) => void
  /** Called when a data row is clicked. Interactive child controls stop propagation. */
  onRowClick?: (row: Row, rowIndex: number) => void
  /** Row double-click (vxe row-dblclick parity). */
  onRowDblClick?: (row: Row, rowIndex: number) => void
  /**
   * Column visibility (vxe-grid columnConfig.visible parity). Map of
   * column key → visible (default true). Hidden columns are not rendered.
   */
  columnVisibility?: Record<string, boolean>
  /** Fired when visibility changes (parent owns the map). */
  onColumnVisibilityChange?: (next: Record<string, boolean>) => void
  /** Controlled column order (vxe customConfig parity): the panel's drag list reorders these keys; unnamed keys follow in source order, unknown keys ignored. Top-level columns only. */
  columnOrder?: string[]
  /** Fired when the panel confirms a new order. `undefined` clears the order (parent drops `columnOrder`). */
  onColumnOrderChange?: (order: string[] | undefined) => void
  /** Client-side filters (vxe-grid filterConfig parity, local mode): column key → filter text; rows filtered with the core filterSort material (substring, case-insensitive). */
  filters?: Record<string, string>
  /** Fired when a filter value changes (parent owns the map). Batch T: this IS the text filter channel (vxe filter-change parity) — a separate `onFilterChange` prop was intentionally NOT added; checked sets use `onFilterValuesChange`. */
  onFiltersChange?: (next: Record<string, string>) => void
  /** Per-column checked filter sets (vxe filter-multiple parity): column key → values OR-matched against the raw `String(value)` of each row. Controlled via `onFilterValuesChange`; without a handler read-only. */
  filterValues?: import('./types').IrisTableFilterValues
  /** Fired when the filter panel confirms or clears a column's checked set. */
  onFilterValuesChange?: (next: import('./types').IrisTableFilterValues) => void
  /** Search form (vxe-grid formConfig parity). */
  formConfig?: IrisTableFormConfig
  /** Toolbar (vxe-grid toolbarConfig parity, minimal built-ins). */
  toolbar?: {
    title?: string
    /** Fired by the refresh button. */
    onRefresh?: () => void
    /** Show the column-visibility toggle button. */
    columnSettings?: boolean
    /** Custom column panel options (vxe customConfig parity): the columnSettings button opens the full panel (search + drag reorder + visibility toggles + reset) instead of the plain checkbox menu. */
    customConfig?: IrisTableCustomConfig
    /** Enable the CSV import button. Receives parsed rows (header → keys). */
    onImport?: (rows: Record<string, unknown>[]) => void
    /** Fired by the export button (vxe toolbar export parity, batch L). */
    onExport?: () => void
    /** Custom action buttons rendered after the built-ins (vxe toolbar buttons parity). */
    buttons?: Array<{ key: string; label: string; onClick: () => void; icon?: string }>
    /** Batch action (vxe toolbar batch parity, batch M): a primary button rendered after the built-ins while `selectable === 'multi'` and rows are selected; receives the current selection keys. When `edit` is true (iris 独有), the button instead opens the built-in batch edit panel — an editable-column select + value input + 应用: ONE `commitRowList` writes the value into every selected row (selection unchanged, editRules bypassed like paste). */
    batch?: {
      label: string
      onClick: (keys: Array<string | number>) => void
      icon?: string
      edit?: boolean
    }
  }
  /** Zoom overlay (vxe toolbar zoom parity, batch U): when `showButton`, the
   * toolbar renders a toggle (⛶ when not zoomed, ✕ when zoomed) that pins the
   * table root as a fullscreen overlay (fixed, inset 0, popover z-index);
   * Esc exits. Local state — no parent props needed. */
  zoomConfig?: { showButton?: boolean }
  /** Import preview (iris 独有 — vxe has no pre-import preview): when true,
   * the toolbar ⇪ CSV import shows a centered modal previewing the first 5
   * parsed rows (plus a total-count note when more) before anything lands;
   * 确认 calls `toolbar.onImport` with ALL parsed rows, 取消 / Esc / backdrop
   * close with zero calls. Default false — the import lands directly (vxe
   * parity). */
  importPreview?: boolean
  /** Section layouts (vxe-grid layouts parity, batch U, suppression-only):
   * `form`/`toolbar` `'hidden'` skips that section (the config stays
   * accepted); `pager` `'hidden'` skips the proxy pager. Defaults render
   * every section exactly as before. */
  layouts?: { form?: 'top' | 'hidden'; toolbar?: 'top' | 'hidden'; pager?: 'bottom' | 'hidden' }
  /** Render with print-friendly styles (hides the toolbar, keeps rows). */
  printable?: boolean
  /**
   * Column drag-sort (vxe-grid columnDragConfig parity). Reorders leaf
   * columns on drop; parent owns columns (pass the reordered array back).
   * Batch CH (iris 独有 — vxe has no drag-out pin): when `columnPinMenu` is
   * ALSO on, dragging a column header past the table's LEFT edge pins it
   * left on release (drag-out pin) instead of reordering — a second gesture
   * into the pin menu's state channel (same `onColumnPinnedChange` contract,
   * both controlled/uncontrolled modes, never a reorder). Plain `columnDrag`
   * without `columnPinMenu` keeps the vxe reorder-only behavior.
   */
  columnDrag?: {
    /** Called with the reordered column array after a drop. */
    onReorder: (columns: IrisTableColumn<Row>[]) => void
  }
  /** Render a leading sequence-number column (vxe-grid seqConfig parity). */
  seq?: boolean
  /**
   * Excel-style row/column references (batch AO, iris 独有 — vxe seqConfig
   * shows numbers only, no column letters): muted A/B/C… letter badges
   * (`data-iris-cell-ref`) after every LEAF header title (A = first leaf;
   * seq/selection/detail/drag columns are skipped, grouped leaves follow
   * source order) plus a leading row-number column 1, 2, 3…
   * (`data-iris-row-ref`). When `seq` is on the seq column IS the row
   * number — no duplicate column. Additive — default off.
   */
  showCellRefs?: boolean
  /**
   * Cell merge (vxe-grid spanMethod parity): return `{ rowspan, colspan }`
   * for a cell at (rowIndex, columnIndex); both default 1. Values > 1 make
   * the cell span adjacent cells (the spanned cells are skipped).
   */
  spanMethod?: (params: {
    rowIndex: number
    columnIndex: number
  }) => { rowspan?: number; colspan?: number } | null | undefined
  /**
   * Header merge (vxe-grid mergeHeaderCells parity, batch P): merge entries
   * keyed by leaf-column index of the FLAT header row (`row` 0 only — rows
   * > 0 are ignored). A merge cell renders with `gridColumnEnd: span
   * colspan` / `gridRowEnd: span rowspan`; the covered cells render null.
   * Grouped headers and `columnVirtualization` are not merged (documented
   * simplification).
   */
  mergeHeaderCells?: IrisTableMergeCell[]
  /**
   * Footer merge (vxe-grid mergeFooterItems parity, batch R): declarative
   * span entries in the SAME coordinate space as `footerSpanMethod` — `row`
   * is the 0-based index over the rendered footer stack (footerMethod rows →
   * summary row → footerData rows, whichever render) and `col` the
   * leaf-column index; both start at 0. A merge cell renders `gridColumnEnd:
   * span colspan`; the covered cells of the same row render null. `rowspan`
   * is inert (each footer row is its own grid container — covered cells of
   * later rows keep their own data; mirrors `footerSpanMethod`'s rowspan).
   * The function wins: when `footerSpanMethod` is provided,
   * `mergeFooterItems` is ignored. Entries outside the rendered stack are
   * no-ops.
   */
  mergeFooterItems?: IrisTableMergeFooterItem[]
  /**
   * Row key fallback (vxe-grid deprecated string `rowId` parity, re-typed as
   * a function, batch R): when a row lacks the `rowKey` field, this callback
   * supplies the row's key — used by selection, expansion, dirty tracking,
   * editing and tree flattening. `rowKey` wins over `rowId`; without either,
   * the row index is used at index-bearing call sites (unchanged). The
   * imperative handle's row ops, clipboard paste and find&replace write-backs
   * still address rows by the `rowKey` field only (keyless rows are skipped
   * there). */
  rowId?: (row: Row, rowIndex: number) => string | number
  /** Row drag-sort configuration (composed over core createSortable). */
  rowDrag?: {
    /** Reorder callback — receives the reordered row array (parent owns data). */
    onReorder: (rows: Row[]) => void
  }
  /** Inline-edit configuration (vxe-grid editConfig parity). */
  editConfig?: {
    /** What opens the editor. Default `'dblclick'`. */
    trigger?: 'click' | 'dblclick' | 'manual'
    /** Show a required asterisk next to headers of columns with rules. */
    showAsterisk?: boolean
    /** Drop the draft when opening another cell without committing. */
    autoClear?: boolean
    /** Edit mode (vxe editConfig.mode parity, batch K): `'cell'` (default) edits one cell at a time; `'row'` opens every editable column of the clicked row together — Enter/blur commits THAT column, Escape cancels the whole row, clicking another row commits the current row's open editors first. */
    mode?: 'cell' | 'row'
  }
  /** Edit-validation presentation (vxe-grid ValidConfig parity). */
  validConfig?: IrisTableValidConfig
  onCellEdit?: (event: IrisTableCellEditEvent<Row>) => void
  /** Edit start (vxe edit-activated parity, batch V): fired when an inline editor opens (cell double-click; cell mode only). */
  onEditStart?: (params: IrisTableEditStartParams<Row>) => void
  /** Edit close (vxe edit-closed parity, batch V): fired when an edit session ends — `cancelled: false` carries the committed value, `cancelled: true` when Escape discarded it. Cell mode only (see `IrisTableEditClosedParams`). */
  onEditClosed?: (params: IrisTableEditClosedParams<Row>) => void
  /** Batch BQ (iris 独有): auto-save committed inline edits — after a successful commit, fire `onAutosave` with the post-commit row list (parent persistence hook; orthogonal to `onDataChange`, which inline edits never trigger). `editAutosave` is the feature switch — `onAutosave` alone is inert (keymap precedent). No-op commits (same value), cancelled (Escape) and validation-failed edits never fire; row edit mode fires per committed column. */
  editAutosave?: boolean
  /** Batch BQ (iris 独有): parent persistence hook fired by `editAutosave` with the post-commit row list. */
  onAutosave?: (rows: Row[]) => void
  /** Batch CC (iris 独有): textarea editors auto-grow their height with content — 1 row to start, up to a 6-row cap, then scroll inside the editor (measured via scrollHeight on input, no re-render loop). Off by default (fail-closed; batch I's rows=3 stays). */
  editAutoHeight?: boolean
  /** Batch CG (iris 独有 — vxe has no equivalent; Excel-style status-bar parity):
   * a live character count in the editing cell's bottom-right corner (cell AND
   * row edit modes, recomputed per keystroke from the session draft) plus a
   * cell-count/sum badge at the selected range's bottom-right cell when
   * `cellRange` has a live selection (a pure reduction over the rangeStats
   * material — count = Σ column non-null counts, sum = Σ numeric column sums,
   * `null` = no numeric data — rounded via the same `aggregateAccuracy` gate as
   * the summary row). Additive; default off (fail-closed).
   */
  charCount?: boolean
  /** Batch CQ (iris 独有 — vxe has no equivalent): show a live preview of the
   * formatter-applied result below the editing cell — recomputed per keystroke
   * from the session draft through the SAME display chain as the committed cell
   * (mask → formatter, with the commit path's draft coercion for number/select
   * editors), rendered as a muted small line (`data-iris-edit-preview`). Only
   * columns with a `formatter` render a preview. Additive; default off
   * (fail-closed).
   */
  editPreview?: boolean
  /** Batch CR (iris 独有 — vxe has no equivalent; Excel status-bar parity):
   * show a full-width horizontal strip directly below the toolbar
   * (`data-iris-column-totals`) with the column totals for every
   * `summary === 'sum'` column — aggregated over the CURRENT body rows with
   * the exact summary-row value pipeline (`aggregate` + the
   * `aggregateAccuracy` rounding gate + `renderSummary` fallback), one grid
   * cell per leaf column (`data-iris-column-totals-cell`) so tracks stay
   * aligned; non-sum columns render empty placeholders. The strip shows even
   * with an empty body (`0`). Additive; default off (fail-closed).
   */
  columnTotals?: boolean
  /** Batch CS (iris 独有 — vxe has no equivalent; vxe keeps the pixel offset, never re-anchors).
   * In virtual mode, an expansion commit re-locates the first visible row
   * (the content anchor, with its partial offset) in the NEW plan and
   * writes `newIndex × slotHeight + relativeTop` — the rows under the
   * cursor stay put across tree/detail expand AND collapse. Uniform slot
   * heights only (`rowHeight`/`virtualScroll.itemHeight` functions are
   * pixel-only — the variable-height offset tree is child-internal);
   * non-virtual tables are inert (documented fiat); full-set restores
   * (`expandAll` / `persistState` replay) fall back to the virtualizer's
   * re-clamp; a single-key commit stays exact. Additive; default off
   * (fail-closed).
   */
  expandScrollPreserve?: boolean
  /** Batch CJ (iris 独有 — vxe has no shortcut help): show a `?` toolbar
   * trigger that opens a floating panel listing every built-in keyboard
   * shortcut with its EFFECTIVE key — the same normalized map every handler
   * matches against, so `keymap` remaps reflect live and a listed key always
   * actually works. Read-only reference (no rebind UI). Additive; default
   * off (fail-closed).
   */
  shortcutHints?: boolean
  /** Header select-all toggle (additive — not in vxe's emits, batch V): fired with the PRE-toggle header state and the current selection keys. */
  onSelectAllChange?: (state: boolean | 'indeterminate', selection: Array<string | number>) => void
  /** Root scroll (vxe scroll parity, batch V): `{ scrollTop, scrollLeft }` of the root container; fires in column-virtualization mode and via a native listener otherwise (only meaningful with `height`, else overflow is hidden). */
  onScroll?: (params: IrisTableScrollParams) => void
  /** Render an expandable detail panel beneath a row. */
  renderDetail?: IrisTableRenderDetail<Row>
  /** Which rows can expand a detail panel. */
  rowExpandable?: IrisTableRowExpandable<Row>
  /** Initially-expanded row keys (uncontrolled). Shared by detail rows + tree rows. */
  defaultExpandedRowKeys?: Array<string | number>
  /** Expand every tree row that has children on mount (vxe expand-config
   * expandAll parity). One-shot: seeds the expansion model with all tree keys
   * on the first data arrival (proxy pages load async). Default false. */
  expandAll?: boolean
  /** Notified with the expanded row keys whenever they change (batch BY: also the restore channel for `persistState`'s `expandedKeys` piece — the model commit replays this callback). */
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /** Detail expand toggle (vxe toggle-row-expand parity): `expanded` is the NEW state after the toggle. */
  onExpandChange?: (row: Row, expanded: boolean) => void
  /** Tree expand toggle (vxe toggle-tree-expand parity): `expanded` is the NEW state after the toggle. */
  onTreeExpandChange?: (row: Row, expanded: boolean) => void
  /** Read a row's child rows to render the table as a tree. */
  getSubRows?: (row: Row) => Row[] | undefined
  /** Lazy tree (vxe lazyLoad parity): a row with no `getSubRows` children still renders a caret; the first expand calls this and `load` resolves the children (expanding the row). */
  lazyLoad?: (row: Row, load: (children: Row[]) => void) => void
  /** Batch CL (iris 独有 — vxe has no expand animation):
   * animate detail-panel and tree-row expansion with a max-height + opacity
   * enter transition (token-driven — `--iris-table-expand-max` cap and
   * `--iris-duration-md` duration, both with fallbacks;
   * `prefers-reduced-motion: reduce` turns the animation off entirely).
   * Pure CSS entrance — zero state/effect; root tree rows (depth 0) stay
   * static. Inert in virtual mode (lazy slots would replay the animation on
   * scroll-mount). Additive; default off (fail-closed).
   */
  expandAnimation?: boolean
  /**
   * Enable WAI-ARIA grid keyboard navigation (single-tabstop roving cell
   * focus). Arrow keys move one cell; Home/End jump to the row's first/last
   * cell; PageUp/PageDown jump 10 rows (clamped; virtual tables also scroll
   * the viewport ±10 × row height); Tab/Shift+Tab move row-major to the
   * next/prev cell (clamped at the bounds — no wrap, focus never leaves the
   * table); Enter is an alias of ArrowDown (F2 stays the edit-start key).
   * While an inline editor is open the editor's own keys win — Tab commits
   * and moves to the next editable column (batch J), unchanged.
   */
  keyboardNavigation?: boolean
  /** Batch AN shortcuts (iris 独有 — vxe keyboardConfig has no edit/clear
   * keys): F2 begins editing the focused cell's column (when editable),
   * Delete/Backspace clears it to `''` — one batched `commitRowList`
   * (undo-covered via the undo funnel). Requires `keyboardNavigation`'s
   * focused-cell state (single-tabstop roving cell focus); without it the
   * shortcuts are inert. While an inline editor is open the editor's own
   * keys win. Additive — default off. */
  tableShortcuts?: boolean
  /** Batch BG (iris 独有 — vxe keyboardConfig has no rebinding): rebind the
   * built-in shortcut keys. ONE key spec string per action
   * (`Modifier+Key`, case-insensitive; `Ctrl`/`Cmd`/`Meta` share one
   * ctrl-or-meta flag — `Ctrl+C` matches Ctrl OR Cmd). Actions:
   * `edit` (default F2) / `clear` (Delete, Backspace) need `tableShortcuts`;
   * `undo` (Ctrl+Z) / `redo` (Ctrl+Y, Ctrl+Shift+Z) need `undo`;
   * `copy` (Ctrl+C) / `paste` (Ctrl+V) need `clipConfig`;
   * `fill` (Ctrl+D — one-step drag-down) needs `rangeFill` + a live range;
   * `query` (Ctrl+K — focuses the query input) needs the controlled `query`.
   * An override REPLACES that action's bindings wholesale (aliases included);
   * invalid specs (`''` / `'Meta'` / `'Ctrl+'` …) are dropped fail-closed —
   * the action keeps its default. Modifiers match exactly: `Ctrl+Shift+Z`
   * redoes, `Alt+Ctrl+Z` is inert. Additive — default off (defaults unchanged). */
  keymap?: Partial<Record<IrisTableKeyAction, string>>
  /** Batch BS (iris 独有 — vxe group-config has no multi-column grouping): table-level NESTED multi-column grouping. Array elements are leaf column `key`s; their order defines the nesting levels (`['dept','status']` → `dept` level 0 → `status` level 1). Every level renders its own collapsible group header (indented by depth, `data-iris-group-depth`); a parent group's count is the subtree row total; the per-group summary row (`summary` ops) appears only on the innermost level. Composite group keys join the level values with `::` (`data-iris-group-key`), so `groupCollapsed`/`defaultGroupCollapsed` address nested groups directly (`'Engineering::Active'`) and a collapsed parent hides its whole subtree. When set, the array WINS over any column-level `groupBy: true` flag; absent/empty/unknown-only → the single-column batch M/BH path runs byte-identical (the array's level-0 fallback). Unknown keys are dropped, duplicates keep the first occurrence. Inert in tree mode (fail-closed, like column grouping). */
  groupBy?: string[]
  /** Batch BH (iris 独有 — vxe group-config has no collapse): controlled set of
   * collapsed group keys. Keys are `String(cell value)` of the `groupBy` column —
   * the same identity `data-iris-group-key` carries. When set, the rendered body
   * only changes after the parent writes the prop back (no optimistic flip).
   * Inert without `groupBy` / in tree mode. */
  groupCollapsed?: Array<string | number>
  /** Default collapsed group keys (uncontrolled mode). */
  defaultGroupCollapsed?: Array<string | number>
  /** Fired on every group-header toggle with the next collapsed keys, in BOTH
   * controlled and uncontrolled modes (lift-ready). */
  onGroupCollapseChange?: (next: Array<string | number>) => void
  /** Enable virtual scrolling for the body. */
  virtualScroll?: IrisTableVirtualOptions
  /** Per-row height (batch BN, iris 独有 — vxe row-height is a fixed config value). Number → uniform height (overrides the default AND `virtualScroll.itemHeight` in virtual mode); `(index) => number` → per-row heights — in virtual mode the fn feeds the variable-height virtualizer (virtual PLAN index, prefix-sum offsets, like `virtualScroll.itemHeight`), otherwise each body row gets its inline height (bodyData index). `rowStyle` stays the per-row escape hatch (it wins). */
  rowHeight?: number | ((index: number) => number)
  /** Persist view state across remounts (batch AG, iris 独有 — vxe has no built-in persistence). Loads sort / multiSortState / filters / filterValues / columnVisibility / columnOrder / columnWidths / pageSize / expandedKeys on mount (replayed through the matching change callbacks) and saves the CURRENT props on every change (the table is controlled). pageSize is only meaningful with proxyConfig.onPageChange (restored via onPageChange(1, restored) before the first query); expandedKeys (batch BY) needs onExpandedRowsChange + an expandable table (renderDetail or tree) — restored through the expansion model, which replays the callback (full-set replace); storage: false fully disables persistence (no reads, no writes); default key 'iris-table-state'. */
  persistState?: import('./types').IrisTablePersistConfig
  /** Named view presets (batch AH, iris 独有) — toolbar select of saved snapshots. */
  views?: import('./types').IrisTableViewConfig
  /** Fired when the active view changes (select / save / delete clears null). */
  onActiveViewChange?: (key: string | null) => void
  /** Batch CT — iris 独有 (vxe has no parity).
   * A `role=tablist` strip rendered ABOVE the toolbar: clicking a tab applies
   * each name in `views` IN ORDER through the same selectView path the toolbar
   * select uses (unknown names are skipped fail-inert; when several views touch
   * the same piece the last applied view wins and the toolbar select mirrors
   * that last view). Fail-closed: without the prop nothing renders, and no tab
   * is active until the first click. */
  tableTabs?: import('./types').IrisTableTab[]
  /** Natural-language query (iris 独有): controlled string parsed by core
   * `parseTableQuery` (`age > 25 and role in (Test, PM) sort by name asc`);
   * the toolbar query input shows while present, parsed filters AND-merge
   * (`=`/`contains` → substring, `in` → filterValues OR-match, relational →
   * rules); `sort by` seeds only with no sort prop set; proxy comma-joins
   * substring/in into the remote filter map. Controlled-only. */
  query?: string
  /** Fired on every keystroke (parent owns the string). */
  onQueryChange?: (next: string) => void
  /** Render only the horizontally-visible columns plus pinned columns and overscan. */
  columnVirtualization?: boolean
  /**
   * Selection summary (batch AP, iris 独有 — vxe has no parity feature, the
   * header count is its closest cousin): when `selectable === 'multi'` and
   * rows are selected, the toolbar renders `已选 N 行`
   * (`data-iris-selection-summary`, i18n `table.selectionSummary`) plus a
   * `· 合计 X` per leaf column with `summary === 'sum'` (the SAME aggregate
   * material + `aggregateAccuracy` rounding + `String(value)` formatting the
   * summary row uses, computed over the SELECTED rows in bodyData order) and
   * a clear button (`data-iris-selection-clear`) that runs the shared
   * `clearSelection` path. Additive — default off.
   */
  selectionSummary?: boolean
  /** Enable rectangular cell-range selection. */
  cellRange?: boolean
  /**
   * Excel-style drag fill (batch AQ, iris 独有 — vxe has no fill parity):
   * when `cellRange` has a live selected range (≥1 cell), a fill handle
   * (`data-iris-range-fill`, 6px primary square at the range's bottom-right
   * cell) appears; dragging it DOWN or RIGHT cyclically fills the target
   * rectangle from the source range values (`(r, c)` ← source
   * `((r - start.row) % rangeRows + start.row, …)`), formula columns and
   * keyless rows skipped, through ONE batched `commitRowList`, then extends
   * the range to the drag end (Excel parity). Dragging UP/LEFT is ignored
   * (the handle only grows the range). Additive — default off.
   */
  rangeFill?: boolean
  /**
   * Cell drag-move (batch CN, iris 独有 — vxe has no cell-move parity): when
   * `cellRange` has a live selected range (≥1 cell), a move grip
   * (`data-iris-range-move`, 12×4 primary pill on the range's top edge at its
   * top-left cell) appears; dragging it to another cell CUT-MOVES the whole
   * block there (剪切移动 — source cells not covered by the destination rect
   * are cleared; locked/readonly and formula cells survive both phases) and
   * the selection follows the moved block (Excel parity). The drag end clamps
   * so the block always fits (down/up/right/left 越界). Zero-commit no-op
   * when the drag stays on the source block. Inert without `cellRange`.
   * Additive — default off.
   */
  cellDrag?: boolean
  /** Clipboard batch (vxe-grid clipboard-config parity, batch O): Ctrl/Cmd+C copies the selected cell range; Ctrl/Cmd+V pastes TSV text into the range anchor onward (overflow beyond the last row/col is ignored). Requires `cellRange` to have a live selected range; additive — default off.
   * Batch BP (iris 独有 — vxe clipboard-config has no output-format switch): `copyFormat` selects the copy OUTPUT format for BOTH consumption points (Ctrl/Cmd+C and the range toolbar 复制 button) — `'tsv'` (default, byte-identical to batch O) / `'csv'` (RFC-4180, headerless range fiat like the 导出 CSV download) / `'html'` (a `<table>` fragment via core `toHtml`, with a header row of column titles — the toHtml contract — and the masked cell values, the batch-AY invariant across all three formats). Paste is unaffected — it always reads `\t`-delimited text. Invalid runtime values fail-closed to `'tsv'`.
   * Batch CU (iris 独有 — vxe clipboard-config always copies raw values, no format-preserving copy): `copyWithFormat` copies the FORMATTED text of formatter columns (the `contextCellText` display chain — mask → formatter → String, the same chain as the context-menu 复制值) instead of the raw/masked value, across ALL THREE `copyFormat` serializers. Only `col.formatter` columns switch chains — non-formatter columns stay byte-identical — and the formatted STRING still flows through the same serializers (RFC-4180 quoting + OWASP neutralization still apply). `exportRaw`'s copy-path skip is superseded on formatter columns (mask → formatter always); exports are untouched.
   */
  // NOTE: keep the inline object single-line — the manifest scanner reads member types line-wise (multi-line object props degrade to a bare object type, rowDrag precedent).
  // prettier-ignore
  clipConfig?: { copy?: boolean; paste?: boolean; copyFormat?: 'tsv' | 'csv' | 'html'; copyWithFormat?: boolean }
  /** Find & replace (vxe-grid find parity, batch O): Ctrl/Cmd+F (when not editing) opens a find/replace bar above the table; Enter/Shift+Enter step through matches; Esc closes and clears highlights. Matches over bodyData (flat mode), case-insensitive substring. Additive — default off. */
  fnr?: boolean
  /** Batch CK (iris 独有 — vxe has no inline search highlight): a
   * case-insensitive literal-substring search over each text cell's display
   * chain (mask → formatter ?? raw — the same text autoLink consumes); every
   * occurrence renders as an inline `<mark data-iris-search-hit>` (the
   * surface-selected token — the same search-highlight language fnr uses for
   * matched cells). Display-only: no bar, no match state, no write-back —
   * the distinction from fnr is the mechanism, not the query.
   * `render`/`html`/`link`/`autoLink`/sparkline cells are untouched
   * (documented fiats). Additive; default off (fail-closed).
   */
  searchHighlight?: string
  /** Built-in undo/redo (iris 独有 — vxe has no built-in undoRedoHistory): when enabled, every data mutation (row ops, paste, find&replace, range clear, cell/row edits, batch edit) records the POST-change row list; Ctrl/Cmd+Z undoes and Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) redoes — never while an inline editor is open. The toolbar renders ↶/↷ buttons after the title (disabled from canUndo/canRedo); restores prune selection keys that no longer exist. Additive — default off. */
  undo?: boolean
  /** Shift-click checkbox range selection (vxe checkboxConfig `isShiftKey`
   * parity, batch G): shift-clicking a row checkbox toggles every
   * checkMethod-eligible row between the last-clicked anchor row and the
   * target (in body order); a plain click just moves the anchor. The header
   * select-all resets the anchor. Default false. */
  checkboxRange?: boolean
  /** Row-selection drag range (batch BT, iris 独有 — vxe has no mouse-drag
   * checkbox range): pressing the row-selection cell in multi mode and
   * dragging past the 4px threshold continuously checks every
   * checkMethod-eligible row between the pressed anchor row and the hovered
   * row (closed interval in body order); checkMethod-disabled rows are
   * skipped. The applied set only ever grows during one drag (reverse drags
   * shrink the interval but never uncheck); a plain click still toggles a
   * single row. Default false. */
  selectionDrag?: boolean
  /** Empty state node (replaces the row body when `data` is empty). Also accepts
   * an `IrisTableEmptyState` descriptor (iris 独有 — vxe has no empty-state
   * action button): `{ text?, action? }` renders the text plus an inline action
   * button on the same row. */
  emptyState?: ReactNode | IrisTableEmptyState
  /** Show the loading state instead of rows. */
  loading?: boolean
  /** Show the error state instead of rows (takes precedence over loading). */
  error?: boolean
  /** Custom loading-state node. */
  loadingState?: ReactNode
  /** Custom error-state node. */
  errorState?: ReactNode
  /** Fired by the built-in Retry button in the error state row. */
  onRetry?: () => void
  /**
   * Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
   * set, rows come from the proxy `query` (paged) and a pager renders below
   * the body; `loading`/`error` are driven by the proxy state.
   */
  proxyConfig?: IrisTableProxyConfig<Row>
  /** Cell tooltips (vxe-grid tooltipConfig parity, title mode, batch G): a
   * native `title` on every body cell, content from the callback or the raw
   * cell value; editing cells are exempt and empty content drops the tooltip.
   * Truncation gating is not implemented — titles render on every cell
   * regardless of `showAll` (documented simplification, kept simple and
   * explicit). */
  tooltipConfig?: IrisTableTooltipConfig<Row>
  /** Cell annotations (iris 独有, batch AZ — vxe has no cell-note concept): a
   * static map of notes keyed `${rowKey}::${columnKey}` — the same `::`
   * delimiter as the internal `cellId` (`annotations[cellId(k, col.key)]`).
   * A noted cell renders a corner badge (`data-iris-cell-note-badge`) + gets
   * `data-iris-cell-note` + the note as its title (beats `tooltipConfig`);
   * the dynamic `cellNote` callback wins over this map when both are set. */
  annotations?: Record<string, string>
  /** Dynamic per-cell note (iris 独有, batch AZ): computed from the row +
   * column — wins over the static `annotations` map. With a note the cell
   * gets `data-iris-cell-note` + a corner badge + the note as its title
   * (beats `tooltipConfig`); a null/'' note renders nothing. */
  cellNote?: (row: Row, column: IrisTableColumn<Row>) => string | null
  /** Hover note preview (batch BM, iris 独有 — vxe has no cell-note concept,
   * and its tooltip can only show the cell value): with `notePopover`, hovering
   * a noted cell shows a floating popover (`data-iris-note-popover`, role
   * tooltip, pure display — pointer-events none) anchored to the cell's badge
   * corner INSTEAD of the native `title`; Escape / outside pointer-down /
   * any scroll close it. Content-only: zero i18n / core. */
  notePopover?: boolean
  /**
   * Annotation editing (batch BB, iris 独有 — vxe has no note editing): when
   * true, the context menu gains built-in items 添加批注 / 编辑批注 / 删除批注
   * (keys `__iris-annotate` / `__iris-annotate-edit` / `__iris-annotate-remove`,
   * i18n `table.annotate(.edit/.remove)`) appended AFTER the summary item,
   * chosen by the clicked cell's existing note (add when none, edit+remove
   * when one). The add/edit items open a floating annotate panel
   * (`data-iris-annotate-panel`) — textarea seeded from
   * `annotations[cellId(rowKey, col.key)]` + 保存 (`data-iris-annotate-save`)
   * + 删除 (`data-iris-annotate-remove`, only when a note exists); the remove
   * item deletes the cell's annotation directly. Requires `contextMenu`;
   * writes flow through `onAnnotationsChange` — without it the items still
   * show but save/remove are inert (documented).
   */
  annotationEditing?: boolean
  /**
   * Annotation write channel (batch BB, iris 独有): receives the NEXT
   * annotations map on every annotate-panel save — empty text removes the
   * cell's key, non-empty sets it — and on remove (menu item or panel
   * button). The map stays fully controlled: `annotations` remains the read
   * source and the table holds no internal annotation state (same shape and
   * ownership as `onFiltersChange`).
   */
  onAnnotationsChange?: (next: Record<string, string>) => void
  /**
   * Collaborative-presence cursors (batch BD, iris 独有 — vxe has no cursor
   * sharing): remote participants' selected cells. Each entry draws a 2px
   * colored outline on its cell (`data-iris-presence="true"`, outline in the
   * entry's `color` — first entry wins when several share a cell) plus a
   * corner label with the participant's name (`data-iris-presence-label`
   * with `-id`/`-name`). Pure display: the table holds no collaboration
   * state, so a NEW array reference re-renders while in-place mutation does
   * not (same controlled contract as `data` / `annotations`).
   */
  presence?: IrisTablePresenceEntry[]
  /** Header cell tooltips (vxe header-tooltip-config parity, batch P): a
   * native `title` on flat + grouped header cells; empty content drops the
   * tooltip. */
  headerTooltipConfig?: { content?: (column: IrisTableColumn<Row>) => string }
  /** Footer cell tooltips (vxe footer-tooltip-config parity, batch P): a
   * native `title` on summary / footer-method / footer-data cells; empty
   * content drops the tooltip. */
  footerTooltipConfig?: { content?: (column: IrisTableColumn<Row>) => string }
  /**
   * Right-click context menu (vxe-grid contextMenu parity, batch H). Opens on
   * body leaf cells only — header, seq, selection, expand, summary and footer
   * cells never open it. The menu floats at the cursor (virtual anchor),
   * closes on Escape / outside pointer-down / any scroll, and fires `onSelect`
   * with the clicked item's key and the cell's grid coordinates.
   *
   * Batch BW (iris 独有): EVERY menu unconditionally gains two built-in quick
   * actions after the user items (and after the value-distribution / summary
   * items when those props are on, before the annotate items) — 复制值
   * (key `__iris-copy-value`, i18n `table.copyValue`, copies the cell's
   * display text — mask → formatter → String — to the clipboard) and 清空
   * (key `__iris-clear-cell`, i18n `table.clearCell`, writes the cell to ''
   * through the same commitRowList funnel as the Delete shortcut — undo /
   * audit / onDataChange covered; locked/readonly cells no-op). Both keys are
   * intercepted at the onSelect wiring, so the user callback never sees them;
   * without a clipboard the copy no-ops safely.
   */
  contextMenu?: {
    items: (
      params: IrisTableContextMenuParams<Row>,
    ) => Array<{ key: string; label: string; disabled?: boolean }>
    onSelect: (key: string, params: IrisTableContextMenuParams<Row>) => void
  }
  /**
   * Value distribution panel (batch AM, iris 独有): when true, the context
   * menu gains a built-in item (key `__iris_distribution`, i18n
   * `table.distribution`) that opens a floating panel counting each distinct
   * value of the CLICKED column over the current body rows — top 20 + a
   * muted "其余 N 个" fold — computed by the core `valueDistribution`
   * material over `bodyData` with the `dataIndex ?? key` indirection.
   * Requires `contextMenu` to be set (the item appends to its items). */
  valueDistribution?: boolean
  /**
   * NL column summary (batch AW, iris 独有 — vxe has no equivalent; its
   * closest analog is a hand-built aggregate footer, which never tells you in
   * one line what a column IS): when true, the context menu gains a built-in
   * item (key `__iris-summary`, i18n `table.summary`) appended AFTER the
   * value-distribution item; selecting it opens a floating panel
   * (`data-iris-summary-panel`) showing the core `summarizeColumn`
   * natural-language summary of the clicked column's values over `bodyData`
   * — a
   * numeric column gets `共 N 个值，范围 min–max，平均 avg，M 个缺失`, a
   * categorical one its top-3 shares (`,` percentages) + a muted
   * `，其余 R 个` fold. Requires `contextMenu` (pairs naturally with
   * `valueDistribution`); Esc / outside / scroll close it like the
   * distribution panel.
   */
  nlSummary?: boolean
  /**
   * Mini chart preview (batch AR, iris 独有): when true, the toolbar gains a
   * chart trigger (`data-iris-chart-trigger`) opening a floating panel
   * (`data-iris-chart-panel`) that charts the CURRENT filtered rows: a
   * numeric-column select (columns where `typeof getCellValue(row, col) ===
   * 'number'` for some row, or `col.summary === 'sum'`) plus a bar/line kind
   * toggle. The SVG (viewBox 0 0 300 120) is built from the core
   * `buildChartData` material over the first 20 values (a muted "共 N 行"
   * note when truncated) — structured JSX only, no SVG strings. Token colors
   * only; Esc / outside / scroll close it. Requires a toolbar render (the
   * gate admits `chartPreview` like `undo`).
   */
  chartPreview?: boolean
  /**
   * Auto-refresh (batch AS, iris 独有 — vxe has no interval refresh): when
   * set, the table re-queries the proxy every `intervalMs` ms while in proxy
   * mode (non-proxy `data` tables are inert — there is nothing to refetch).
   * Each tick calls the SAME refetch the built-in ↻ button uses — the
   * standard refetch path, so `loading` flips true for the duration of the
   * request (the core source has no silent-refresh option; documented
   * behavior, not suppressed). `intervalMs` ≤ 0 disables the timer
   * (fail-closed). The interval restarts whenever `intervalMs` changes
   * (keyed on the scalar, so an inline object doesn't reset the timer every
   * render) and is cleared on unmount / proxy removal. Additive — default
   * off.
   */
  autoRefresh?: { intervalMs: number }
  /**
   * Freshness stamp (batch AS, iris 独有 — vxe shows no data-arrival time):
   * when true, the toolbar renders `Updated at HH:MM:SS`
   * (`data-iris-freshness`, i18n `table.freshness`, 24h local `formatClock`)
   * re-stamped on EVERY live-data change — initial arrival, refetch, edit
   * commit, row ops / paste / batch / range clear, undo/redo (everything
   * that funnels through `setLiveData`). Hidden until the first row exists
   * (`liveData.length === 0`). Requires a toolbar render. Additive — default
   * off.
   */
  freshness?: boolean
  /**
   * Validation summary (batch BR, iris 独有 — vxe shows no editRules outcome
   * counts): when true, the toolbar renders a muted commit-outcome ledger
   * (`data-iris-validation-summary`, i18n `table.validationSummary`, en
   * `Passed {ok} · Failed {fail}` / zh `通过 {ok} · 失败 {fail}`) for columns
   * with declarative `editRules`: ok = a commit that passed editRules and
   * landed (cell and row edit modes), fail = a commit attempt rejected by
   * editRules. Typing-time validation, legacy `validate` columns, paste/fill/
   * FNR/batch bypasses and Escape cancels never count. Hidden until at least
   * one outcome is counted; re-enabling the switch resets the ledger.
   * Requires a toolbar render (the gate admits `validationSummary` like
   * `freshness`). Additive — default off.
   */
  validationSummary?: boolean
  /**
   * Audit log (batch AT, iris 独有 — vxe has no audit trail): when true, every
   * mutation commit appends ONE entry to a bounded (200) ring — inline/row
   * edits, insert/remove row ops, paste, fill, batch edit, undo/redo replay
   * (type hint per site; rowKey + first-changed-cell context from a light
   * diff of the row lists, documented simplification). The toolbar gains an
   * audit trigger (`data-iris-audit-trigger`) opening a floating panel
   * (`data-iris-audit-panel`, like the chart/stats panels — Esc / outside /
   * scroll close) listing newest-first entries (seq + `formatClock` time +
   * type + rowKey + column + muted old→new). `tableRef.getAuditLog()` /
   * `clearAuditLog()` expose the trail programmatically (the seq never
   * resets on clear — audit integrity). Requires a toolbar render (the gate
   * admits `auditLog` like `undo`). Additive — default off.
   */
  auditLog?: boolean
  /**
   * Performance panel (batch BL, iris 独有 — vxe has no perf stats): when
   * true, every render commit samples `nowMs()` (render-top mark →
   * dependency-less `useLayoutEffect` run) into a core `createPerfStats`
   * latest-snapshot controller (`@iris-ui-kit/core/perf-stats` — own
   * subpath). Duration = render + layout phase, excludes paint
   * (documented). The toolbar gains a ⚡ trigger (`data-iris-perf-trigger`)
   * opening a floating panel (`data-iris-perf-panel`, like the audit panel
   * — Esc / outside / scroll close) showing the last render duration,
   * row count, leaf-column count and the audit-trail depth — live: the
   * panel subscribes to BOTH controllers, so `tableRef.clearAuditLog()`
   * refreshes the changes count in place; `auditLog` off → muted `—`. The
   * push notifies only the panel (separate portal root) — the table never
   * re-renders from its own measurement. Requires a toolbar render (the
   * gate admits `perfStats` like `auditLog`). Off = zero cost. Additive —
   * default off.
   */
  perfStats?: boolean
  /**
   * Version history (batch BA, iris 独有 — vxe has no time-travel): when set,
   * every row-list commit (`commitRowList` — row ops, paste, fill, range
   * clear, batch edit, undo/redo replay) pushes the PRE-change rows into a
   * bounded ring (core `createVersionHistory`, default max 20; `max: 0`
   * unlimited; `max` read once at mount). The toolbar gains a history trigger
   * (`data-iris-history-trigger`) opening a floating panel
   * (`data-iris-history-panel`, like the audit panel — Esc / outside / scroll
   * close) listing versions newest-first (#index + `formatClock` time + commit
   * type); clicking an entry restores those rows through the normal write-back
   * channel (`commitRowList(rows, 'undo')` — auditable and undoable) WITHOUT
   * pushing a new version. Inline cell/row edits (the `commitValue` funnel)
   * don't create versions (documented — restore replaces the whole row list,
   * so row-level commits are the coherent unit). `tableRef.getVersions()`
   * (lightweight — no rows) / `restoreVersion(index)` expose the ring
   * programmatically. Requires a toolbar render (the gate admits
   * `versionHistory` like `undo`). Additive — default off.
   */
  versionHistory?: { max?: number }
  /**
   * Compare view (batch AU, iris 独有 — vxe has no compare capability): a
   * snapshot the live rows are diffed against by `rowKey`. Every live row
   * absent from the snapshot renders `data-iris-row-removed`, every live row
   * present in both with ≥1 differing cell renders `data-iris-row-changed`
   * with `data-iris-cell-changed` on the changed cells and a title tooltip
   * `旧值: X → 新值: Y` (old = live value, new = snapshot value) that
   * overrides the tooltipConfig title (compare wins, documented); snapshot-
   * only rows are `added` in the core diff but have no rendered slot — the
   * compare view renders the live dataset (documented). Core `diffRows` is
   * framework-free; the memo is null without `compareWith` or `rowKey` —
   * additive, default off.
   */
  compareWith?: Row[]
  /**
   * Cell auto-link (batch CA, iris 独有 — vxe has no URL/email auto-
   * detection): when true, text cells run their display chain
   * (mask → formatter ?? raw) through core `detectAutoLink`; a whole-text
   * URL/email match renders an `<a data-iris-auto-link>` (_blank +
   * noreferrer) instead of plain text. Non-matching text falls through to
   * the formatter/raw branch unchanged; an explicit `col.link` column still
   * wins (evaluated before autoLink). Additive — default off.
   */
  autoLink?: boolean
  /**
   * Recent filters (batch CB, iris 独有 — vxe has no "recent filters"
   * concept): when true, every filter-panel confirm (non-empty checked
   * set) records `{ key, values, ts }` into a core `createRecentFilters`
   * ring (newest-first, 10 entries, MRU — re-confirming the same set
   * bumps it to the top). The filter panel shows the recent entries
   * above the options; clicking one applies it immediately (across
   * columns) and closes. Additive — default off.
   */
  recentFilters?: boolean
  /**
   * Imperative handle (vxe-grid edit insert/remove/setRow parity + iris-only
   * additions): row ops, proxy/view/selection methods, and (batch BZ) the
   * full view-state JSON export/import — `exportStateJson()` /
   * `importStateJson(json)` (sort / filters / filterValues /
   * columnVisibility / columnOrder / columnWidths / pageSize / expandedKeys /
   * query — the same collector as `persistState`).
   */
  tableRef?: MutableRefObject<IrisTableHandle<Row> | null>
  /** Fired after any internal row operation / edit write-back, with the new row list. */
  onDataChange?: (rows: Row[]) => void
  /** Veto rows from selection (vxe-grid checkboxConfig.checkMethod parity). */
  checkMethod?: (row: Row, rowIndex: number) => boolean
  /** Pager options (vxe-grid pagerConfig parity). */
  pagerConfig?: IrisTablePagerConfig
  /** Fixed height (vxe-grid height parity, batch N): makes the root a vertical
   * scroll container with a sticky header row. Number → px; string → CSS length. */
  height?: number | string
  /** Minimum height of the fixed-height container (with `height`/`maxHeight`). */
  minHeight?: number | string
  /** Maximum height of the fixed-height container (with `height`/`minHeight`). */
  maxHeight?: number | string
  /** Thin scrollbars (vxe-grid scrollbarConfig parity, batch Q): when
   * `theme: 'thin'`, the root and its virtual-scroll descendant get 6px
   * webkit scrollbars plus Firefox `scrollbar-width: thin` via
   * `data-iris-scrollbar-thin`. Default: browser scrollbars. */
  scrollbarConfig?: { theme?: 'default' | 'thin' }
  /** Dirty-cell tracking (vxe-grid editDirtyConfig parity, batch Q): a cell
   * whose committed value differs from its pre-edit original renders a
   * primary dot (`data-iris-cell-dirty`, cell gets `position: relative`);
   * committing the original value clears it. `indicator: false` suppresses
   * the dot (tracking stays); `className: true` also adds an
   * `iris-table-cell-dirty` class for custom styling. */
  editDirtyConfig?: { indicator?: boolean; className?: boolean }
  /** Fill the parent (vxe-grid auto-resize parity, batch Q): a
   * ResizeObserver measures the root and, when no explicit `height` is set,
   * renders `height: 100%` so the table fills AND tracks its parent (the
   * fixed-height scroll machinery engages after the first positive
   * measure). When `height` IS set the measured size is kept internally and
   * the explicit height wins (no visible change). Without ResizeObserver
   * (jsdom/SSR) the scroll engagement is a no-op. Default false. */
  autoResize?: boolean
  /**
   * Re-measure on content changes (vxe-grid syncResize parity, batch R):
   * when true, `autoResize` is off and NO explicit `height` is set, an
   * effect keyed on data / loading / error / footerData / size / bordered
   * runs the SAME root measure autoResize uses (plus on
   * `visibilitychange`), so the fixed-height machinery tracks
   * content-driven size changes without a ResizeObserver. Same application
   * rules as `autoResize`: with `height` set the explicit height wins and
   * the effect does nothing. Default false. */
  syncResize?: boolean
  /**
   * Seed the live row list with a COPY of `data` (vxe-grid keepSource
   * parity, batch R): `liveData` initializes to `[...data]` instead of the
   * `data` reference, so mutating the original array after mount cannot
   * change the table. The table is immutable either way — it never mutates
   * the rows it receives; `keepSource` just decouples the initial seed.
   * Later controlled re-feeds (new `data` reference) keep the hand-off. */
  keepSource?: boolean
  /**
   * Root stacking (vxe-grid zIndex parity, batch R): sets `z-index` on the
   * root with `position: relative` (CSS z-index is inert on static
   * elements). Rendered before `style` — a caller-provided style can still
   * override. */
  zIndex?: number
  /** Highlight rows on hover (vxe highlight-hover-row parity, batch N). Default true. */
  highlightHoverRow?: boolean
  /** Header overflow (vxe showHeaderOverflow parity, batch W): when false, header cells switch to `whiteSpace: 'normal'` + `overflow: 'visible'` (text wraps instead of the ellipsis). Default true. */
  showHeaderOverflow?: boolean
  /** Footer overflow (vxe showFooterOverflow parity, batch W): when false, summary / footerMethod / footerData cells switch to `whiteSpace: 'normal'` + `overflow: 'visible'` (text wraps instead of the ellipsis). Default true. */
  showFooterOverflow?: boolean
  /** Background watermark text (iris 独有 — vxe has no watermark concept): when set, a rotated tiled watermark layer (wrapper `data-iris-watermark` → overlay `data-iris-watermark-overlay` → tiles `data-iris-watermark-tile`, same DOM shape as the standalone IrisWatermark primitive) overlays the table's static rows / footer / pager — below the sticky header, pinned columns and floating panels. The wrapper is a sticky first child of the root (the scroll container), so in fixed-height mode it pins to the scroll viewport and stays put while rows scroll beneath. Pure display: `aria-hidden` + `pointer-events: none` + `user-select: none`, token-driven (`--iris-muted` / `--iris-space-xl` / `--iris-font-size-lg`). Empty string hides the layer. */
  watermark?: string
  style?: CSSProperties
  className?: string
}
