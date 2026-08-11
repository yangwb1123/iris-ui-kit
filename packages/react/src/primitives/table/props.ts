import type { CSSProperties, MutableRefObject, ReactNode } from 'react'
import type {
  IrisTableCellEditEvent,
  IrisTableEditStartParams,
  IrisTableEditClosedParams,
  IrisTableScrollParams,
  IrisTableAlign,
  IrisTableColumn,
  IrisTableColumnWidths,
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
   * prop, the seq cell renders `(page - 1) * pageSize + rowIndex + 1` instead of
   * `rowIndex + seqStartIndex` (seqStartIndex ignored). `seqMethod` still wins. */
  seq?: boolean
  /** Fired when the page changes. */
  onPageChange?: (page: number, pageSize: number) => void
}

/**
 * Search-form configuration (vxe-grid formConfig parity). Renders a field row
 * above the toolbar; submit merges values into the filters (client-side or
 * through the proxy query when `proxyConfig` is set).
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

/** Pager configuration (vxe-grid pagerConfig parity). */
export interface IrisTablePagerConfig {
  /** Rows-per-page options rendered as a size selector next to the pager. A
   * change re-queries with the new size and resets the page to 1. */
  pageSizes?: number[]
  /** Show the total-row count (i18n `table.total`) before the size selector (vxe pagerConfig.showTotal parity). */
  showTotal?: boolean
}

/** Public input surface for the React table adapter. */
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
  /**
   * Custom footer rows (vxe footer-method parity, batch N): when present,
   * REPLACES the summary op row with one grid row per returned entry — cell
   * value = `entry[col.key]` — with the same row styling as the summary row;
   * `footerData` still renders below. `columns` = leaf columns, `data` = the
   * full (sorted + filtered) body rows.
   */
  footerMethod?: (params: IrisTableFooterMethodParams<Row>) => Row[]
  /**
   * Footer cell merge (vxe footer-span-method parity, batch P): return
   * `{ rowspan, colspan }` for a footer cell — both default 1. `colspan` > 1
   * makes the cell span adjacent cells (the covered cells are skipped, same
   * occupy pattern as `spanMethod`); `rowspan` is inert — each footer row is
   * its own grid container, so `gridRowEnd` cannot cover another row and the
   * later rows' cells must not disappear (mirrors `mergeHeaderCells`).
   * Applies over the rendered footer stack
   * in this order: footerMethod rows → summary row → footerData rows
   * (whichever render); `rowIndex` is 0-based over that stack. `columns` =
   * leaf columns, `data` = the full (sorted + filtered) body rows. Group
   * summary rows are not part of the stack.
   */
  footerSpanMethod?: IrisTableFooterSpanMethod<Row>
  /** Header cell alignment (vxe header-align parity): `headerAlign` wins over
   * the column's `align`, then 'left'. Applies to flat + grouped headers. */
  headerAlign?: IrisTableAlign
  /** Footer/summary cell alignment (vxe footer-align parity): `footerAlign`
   * wins over the column's `align`. Applies to summary, footer-method and
   * footer-data cells. */
  footerAlign?: IrisTableAlign
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
    /** Batch action (vxe toolbar batch parity, batch M): a primary button rendered after the built-ins while `selectable === 'multi'` and rows are selected; receives the current selection keys. */
    batch?: { label: string; onClick: (keys: Array<string | number>) => void; icon?: string }
  }
  /** Zoom overlay (vxe toolbar zoom parity, batch U): when `showButton`, the
   * toolbar renders a toggle (⛶ when not zoomed, ✕ when zoomed) that pins the
   * table root as a fullscreen overlay (fixed, inset 0, popover z-index);
   * Esc exits. Local state — no parent props needed. */
  zoomConfig?: { showButton?: boolean }
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
   */
  columnDrag?: {
    /** Called with the reordered column array after a drop. */
    onReorder: (columns: IrisTableColumn<Row>[]) => void
  }
  /** Render a leading sequence-number column (vxe-grid seqConfig parity). */
  seq?: boolean
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
  /** Notified with the expanded row keys whenever they change. */
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /** Detail expand toggle (vxe toggle-row-expand parity): `expanded` is the NEW state after the toggle. */
  onExpandChange?: (row: Row, expanded: boolean) => void
  /** Tree expand toggle (vxe toggle-tree-expand parity): `expanded` is the NEW state after the toggle. */
  onTreeExpandChange?: (row: Row, expanded: boolean) => void
  /** Read a row's child rows to render the table as a tree. */
  getSubRows?: (row: Row) => Row[] | undefined
  /** Lazy tree (vxe lazyLoad parity): a row with no `getSubRows` children still renders a caret; the first expand calls this and `load` resolves the children (expanding the row). */
  lazyLoad?: (row: Row, load: (children: Row[]) => void) => void
  /** Enable WAI-ARIA grid keyboard navigation. */
  keyboardNavigation?: boolean
  /** Enable virtual scrolling for the body. */
  virtualScroll?: IrisTableVirtualOptions
  /** Render only the horizontally-visible columns plus pinned columns and overscan. */
  columnVirtualization?: boolean
  /** Enable rectangular cell-range selection. */
  cellRange?: boolean
  /** Clipboard batch (vxe-grid clipboard-config parity, batch O): Ctrl/Cmd+C copies the selected cell range as TSV; Ctrl/Cmd+V pastes TSV text into the range anchor onward (overflow beyond the last row/col is ignored). Requires `cellRange` to have a live selected range; additive — default off. */
  clipConfig?: { copy?: boolean; paste?: boolean }
  /** Find & replace (vxe-grid find parity, batch O): Ctrl/Cmd+F (when not editing) opens a find/replace bar above the table; Enter/Shift+Enter step through matches; Esc closes and clears highlights. Matches over bodyData (flat mode), case-insensitive substring. Additive — default off. */
  fnr?: boolean
  /** Shift-click checkbox range selection (vxe checkboxConfig `isShiftKey`
   * parity, batch G): shift-clicking a row checkbox toggles every
   * checkMethod-eligible row between the last-clicked anchor row and the
   * target (in body order); a plain click just moves the anchor. The header
   * select-all resets the anchor. Default false. */
  checkboxRange?: boolean
  /** Empty state node (replaces the row body when `data` is empty). */
  emptyState?: ReactNode
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
   */
  contextMenu?: {
    items: (
      params: IrisTableContextMenuParams<Row>,
    ) => Array<{ key: string; label: string; disabled?: boolean }>
    onSelect: (key: string, params: IrisTableContextMenuParams<Row>) => void
  }
  /** Imperative handle for row ops (vxe-grid edit insert/remove/setRow parity). */
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
  style?: CSSProperties
  className?: string
}
