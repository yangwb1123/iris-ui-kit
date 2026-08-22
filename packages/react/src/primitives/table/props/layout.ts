import type * as React from 'react'
import type * as TableTypes from '../types'
import type { IrisTableDensity, IrisTableFormConfig } from '../props'
export interface IrisTableLayoutProps<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  columns: TableTypes.IrisTableColumn<Row>[]
  /** Table data. Optional when `proxyConfig` is set (server-side source). */
  data?: Row[]
  /** Field to use as the row key. */
  rowKey?: string
  /** Selection mode. */
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  defaultSelection?: Array<string | number>
  onSelectionChange?: (next: Array<string | number>) => void
  sort?: TableTypes.IrisTableSortState | null
  defaultSort?: TableTypes.IrisTableSortState | null
  onSortChange?: (next: TableTypes.IrisTableSortState | null) => void
  /** Multi-column sort (vxe sort-config.multiple parity): header clicks
   * append/cycle columns in click order instead of replacing. Default false. */
  multiSort?: boolean
  /** Controlled multi-column sort state (multiSort mode). */
  multiSortState?: TableTypes.IrisTableSortState[]
  /** Default multi-column sort (multiSort mode, uncontrolled). */
  defaultMultiSort?: TableTypes.IrisTableSortState[]
  onMultiSortChange?: (next: TableTypes.IrisTableSortState[]) => void
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
  seqMethod?: (params: TableTypes.IrisTableSeqMethodParams) => string | number
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
  onHeaderClick?: (column: TableTypes.IrisTableColumn<Row>) => void
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
  footerMethod?: (params: TableTypes.IrisTableFooterMethodParams<Row>) => Row[]
  /** Footer cell merge (vxe footer-span-method parity, batch P): `colspan` > 1 spans adjacent cells (covered cells skipped, same occupy pattern as `spanMethod`); `rowspan` inert (each footer row is its own grid container). Applies over the footer stack in order: footerMethod rows → summary row → footerData rows; `rowIndex` is 0-based over that stack, `columns` = leaf columns, `data` = full filtered body rows. Group summary rows are not part of the stack. */
  footerSpanMethod?: TableTypes.IrisTableFooterSpanMethod<Row>
  /** Header cell alignment (vxe header-align parity): `headerAlign` wins over
   * the column's `align`, then 'left'. Applies to flat + grouped headers. */
  headerAlign?: TableTypes.IrisTableAlign
  /** Footer/summary cell alignment (vxe footer-align parity): `footerAlign`
   * wins over the column's `align`. Applies to summary, footer-method, footer-data. */
  footerAlign?: TableTypes.IrisTableAlign
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
  cellClassName?: (row: Row, column: TableTypes.IrisTableColumn<Row>, rowIndex: number) => string
  /** Per-header-cell class hook (vxe header-cell-class-name parity). */
  headerCellClassName?: (column: TableTypes.IrisTableColumn<Row>) => string
  /** Per-footer-cell class hook (vxe footer-cell-class-name parity). */
  footerCellClassName?: (column: TableTypes.IrisTableColumn<Row>, rowIndex: number) => string
  /** Per-row inline style hook (vxe row-style parity). */
  rowStyle?: (row: Row, rowIndex: number) => React.CSSProperties
  /** Per-cell inline style hook (vxe cell-style parity). */
  cellStyle?: (
    row: Row,
    column: TableTypes.IrisTableColumn<Row>,
    rowIndex: number,
  ) => React.CSSProperties
  /** Conditional cell styles (batch AX, iris 独有): an ordered rule list merged onto matching body cells AFTER `cellStyle` — later matching rules win on conflicting keys. A rule matches when its `column` filter (omitted → every column) equals the cell's column key AND `when(row, value)` is true; `value` is the RAW cell value (dataIndex ?? key resolved, formula columns computed). Rules evaluate inline per visible cell (cost = visibleCells × rules; virtual scroll bounds it — memoize the array in the caller). */
  conditionalStyles?: TableTypes.IrisTableConditionalStyle<Row>[]
  /** External table data for cross-table formula refs (batch BC, iris 独有): `=other!col` reads `formulaTables['other'][0]['col']` (the FIRST row of the named table). Missing tables arg / unknown table / EMPTY table / unknown field → the whole formula null (fail-closed); a known nullish field coerces (Excel parity). Immutable contract: pass a NEW object when referenced tables change. */
  formulaTables?: Record<string, Row[]>
  /** Extra row sets appended to `handle.exportMultiCsv()` (batch DI, iris 独有 — vxe has no multi-file export): each entry names a referenced table whose BARE rows (`Row[]`, no column definitions — they're not IrisTable column configs) are serialized by their OWN enumerable keys (first row's keys are the header), NOT by this table's columns. `key` is both the `# <key>` segment header and (documented) the section name; `ref` is called lazily at export time (handle call, not render) so it can read the live source rows of that table. Empty/absent `exportNames` → `exportMultiCsv()` falls back to the bare current-table CSV, byte-identical to `exportCurrentViewCsv()`. An entry with an empty `key` is skipped entirely; an empty ref row set emits just the segment header. Immutable contract: pass a NEW array when the set changes. */
  exportNames?: Array<{ key: string; ref: () => Row[] }>
  /** Per-header-cell inline style hook (vxe header-cell-style parity). */
  headerCellStyle?: (column: TableTypes.IrisTableColumn<Row>) => React.CSSProperties
  /** Per-footer-cell inline style hook (vxe footer-cell-style parity). */
  footerCellStyle?: (
    column: TableTypes.IrisTableColumn<Row>,
    rowIndex: number,
  ) => React.CSSProperties
  /**
   * Unified event stream (batch DW, iris 独有 — vxe has no single event bus):
   * cell/row click, sort, filter, edit and expand events merged into ONE
   * subscription. The bus fires AFTER the matching dedicated callback (if
   * wired) — a bridge, not a behavior, so gate parity holds by construction
   * (no `onCellClick`/`rowMode` → no cell-click event). `type` is one of the
   * closed `IrisTableEvent` palette; `detail` carries the SAME params the
   * dedicated callback receives (reference-identical `detail.row`/`column`).
   * Controllable proxy `sort` updates, snapshot restores and `expandAll` fire
   * no bus event.
   */
  onTableEvent?: (event: { type: string; detail: unknown }) => void
  /** Cell click (vxe cell-click parity). Fired after internal handlers. */
  onCellClick?: (params: TableTypes.IrisTableCellClickParams<Row>) => void
  /** Cell double-click (vxe cell-dblclick parity). Fired AFTER the inline edit starts on editable columns; non-editable columns fire it too. */
  onCellDblClick?: (params: TableTypes.IrisTableCellClickParams<Row>) => void
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
  /** Batch DS (iris 独有): show the live pixel width while a resize drag is active. */
  widthHint?: boolean
  /**
   * Auto-fit column widths on double-click (iris 独有, batch DG — vxe has no
   * auto-resize): when true (WITH `resizableColumns`, so the handle exists),
   * double-clicking a column boundary measures the widest rendered content
   * (header + body cells, `scrollWidth` already includes both-side padding)
   * and writes the clamped width via `onColumnWidthsChange` (the same duck
   * channel as drag/keyboard). Falls back fail-closed: no handle without
   * `resizableColumns`; virtual scrolling measures only the rendered window
   * (vxe autoResize behavior). Additive — default off.
   */
  autoResizeColumns?: boolean
  /** Controlled per-column pixel widths, keyed by column `key`. */
  columnWidths?: TableTypes.IrisTableColumnWidths
  defaultColumnWidths?: TableTypes.IrisTableColumnWidths
  onColumnWidthsChange?: (next: TableTypes.IrisTableColumnWidths) => void
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
  filterValues?: TableTypes.IrisTableFilterValues
  /** Fired when the filter panel confirms or clears a column's checked set. */
  onFilterValuesChange?: (next: TableTypes.IrisTableFilterValues) => void
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
    customConfig?: TableTypes.IrisTableCustomConfig
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
}
