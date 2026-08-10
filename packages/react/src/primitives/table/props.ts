import type { CSSProperties, MutableRefObject, ReactNode } from 'react'
import type {
  IrisTableCellEditEvent,
  IrisTableAlign,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableContextMenuParams,
  IrisTableFooterMethodParams,
  IrisTableFormField,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
  IrisTableSortState,
  IrisTableTooltipConfig,
  IrisTableValidConfig,
  IrisTableVirtualOptions,
} from './types'

/**
 * vxe-grid proxyConfig parity — the server-side data proxy (query slice).
 * When set, `data` is ignored: rows come from `query` (paged), and the table
 * renders a pager below the body. Edit write-back keeps working — committed
 * edits update the live rows locally until the next refetch replaces them.
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
 * above the toolbar (or the table root). Submit merges the values into the
 * table filters: client-side via the existing `filteredData` path, or into the
 * proxy query (`setParams({ filters, page: 1 })`) when `proxyConfig` is set.
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

/**
 * Imperative row operations (vxe-grid insert/remove/setRow parity, simplified
 * to key addressing). Assigned to `tableRef.current` on mount; every op
 * applies a core pure helper to the live row list, commits through the same
 * write-back channel as cell edits, and fires `onDataChange` with the new
 * list. Not-found keys are silent no-ops (the core helpers return the
 * original reference).
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
  /** Snapshot (copy) of the current live row list (vxe getTableData parity). */
  getData: () => Row[]
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
}

/** Pager configuration (vxe-grid pagerConfig parity). */
export interface IrisTablePagerConfig {
  /** Rows-per-page options rendered as a size selector next to the pager. A
   * change re-queries with the new size and resets the page to 1. */
  pageSizes?: number[]
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
  /** Header cell alignment (vxe header-align parity): `headerAlign` wins over
   * the column's `align`, then 'left'. Applies to flat + grouped headers. */
  headerAlign?: IrisTableAlign
  /** Footer/summary cell alignment (vxe footer-align parity): `footerAlign`
   * wins over the column's `align`. Applies to summary, footer-method and
   * footer-data cells. */
  footerAlign?: IrisTableAlign
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
  bordered?: boolean
  /** Enable column resizing (drag the header's trailing edge or focus + arrow keys). */
  resizableColumns?: boolean
  /** Controlled per-column pixel widths, keyed by column `key`. */
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  /** Called when a data row is clicked. Interactive child controls stop propagation. */
  onRowClick?: (row: Row, rowIndex: number) => void
  /** Called when an inline-editable cell is committed with a changed value. */
  /**
   * Column visibility (vxe-grid columnConfig.visible parity). Map of
   * column key → visible (default true). Hidden columns are not rendered.
   */
  columnVisibility?: Record<string, boolean>
  /** Fired when visibility changes (parent owns the map). */
  onColumnVisibilityChange?: (next: Record<string, boolean>) => void
  /**
   * Client-side filters (vxe-grid filterConfig parity, local mode). Map of
   * column key → filter text; rows are filtered with the core filterSort
   * material (substring, case-insensitive).
   */
  filters?: Record<string, string>
  /** Fired when a filter value changes (parent owns the map). */
  onFiltersChange?: (next: Record<string, string>) => void
  /**
   * Per-column checked filter sets (vxe filter-multiple parity, batch I):
   * column key → values OR-matched against the raw `String(value)` of each
   * row. Controlled — updates flow through `onFilterValuesChange`; without a
   * handler the map is read-only (same pattern as `filters`).
   */
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
    /** Enable the CSV import button. Receives parsed rows (header → keys). */
    onImport?: (rows: Record<string, unknown>[]) => void
    /** Fired by the export button (vxe toolbar export parity, batch L). */
    onExport?: () => void
    /** Custom action buttons rendered after the built-ins (vxe toolbar buttons parity). */
    buttons?: Array<{ key: string; label: string; onClick: () => void; icon?: string }>
    /** Batch action (vxe toolbar batch parity, batch M): a primary button rendered after the built-ins while `selectable === 'multi'` and rows are selected; receives the current selection keys. */
    batch?: { label: string; onClick: (keys: Array<string | number>) => void; icon?: string }
  }
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
  /** Highlight rows on hover (vxe highlight-hover-row parity, batch N). Default true. */
  highlightHoverRow?: boolean
  style?: CSSProperties
  className?: string
}
