import type { JSX } from 'solid-js'
import type {
  IrisTableCellEditEvent,
  IrisTableClipConfig,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableContextMenuItem,
  IrisTableContextMenuParams,
  IrisTableEditConfig,
  IrisTableFilterValues,
  IrisTableFormConfig,
  IrisTableHandle,
  IrisTableLazyLoad,
  IrisTablePagerConfig,
  IrisTableProxyConfig,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
  IrisTableSeqMethodParams,
  IrisTableSortState,
  IrisTableDensity,
  IrisTableToolbarConfig,
  IrisTableVirtualOptions,
  IrisTableTab,
  IrisTableViewConfig,
} from './types'

/** Public input surface for the Solid table adapter. */
export interface IrisTableProps<Row extends Record<string, unknown> = Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  /** Table data. Optional (server-side sources may omit it). */
  data?: Row[]
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  defaultSelection?: Array<string | number>
  onSelectionChange?: (selection: Array<string | number>) => void
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  onSortChange?: (sort: IrisTableSortState | null) => void
  /** Multi-column sort (vxe sort-config.multiple parity): header clicks
   * append/cycle columns in click order instead of replacing. Default false. */
  multiSort?: boolean
  /** Controlled multi-column sort state (multiSort mode). */
  multiSortState?: IrisTableSortState[]
  /** Default multi-column sort (multiSort mode, uncontrolled). */
  defaultMultiSort?: IrisTableSortState[]
  onMultiSortChange?: (next: IrisTableSortState[]) => void
  /** Render a leading sequence-number column (vxe-grid seqConfig parity). */
  seq?: boolean
  /** First sequence number (vxe seq-config.startIndex parity). Default 1. */
  seqStartIndex?: number
  /** Custom sequence renderer (vxe seq-config.seqMethod parity). */
  seqMethod?: (params: IrisTableSeqMethodParams) => string | number
  /**
   * Cell merge (vxe-grid spanMethod parity): return `{ rowspan, colspan }`
   * for a cell at (rowIndex, columnIndex); both default 1. Values > 1 make
   * the cell span adjacent cells (the spanned cells are skipped).
   */
  spanMethod?: (params: {
    rowIndex: number
    columnIndex: number
  }) => { rowspan?: number; colspan?: number } | null | undefined
  /** Column visibility (vxe columnConfig.visible parity): map of column key →
   * visible (default true). Hidden columns are not rendered. */
  columnVisibility?: Record<string, boolean>
  /** Fired when visibility changes (parent owns the map). */
  onColumnVisibilityChange?: (next: Record<string, boolean>) => void
  /** Animate column show/hide as a token-backed opacity and grid-track overlay. Off by default and disabled by prefers-reduced-motion. */
  columnFade?: boolean
  /** Client-side filters (vxe filterConfig parity, local mode): column key →
   * filter text; rows filtered with substring, case-insensitive matching
   * ('' entries ignored). Combines with `formConfig` values when both exist. */
  filters?: Record<string, string>
  /** Fired when a filter value changes (parent owns the map). */
  onFiltersChange?: (next: Record<string, string>) => void
  /** Per-column checked filter sets (vxe filter-multiple parity): column key →
   * values OR-matched against the raw `String(value)` of each row. Controlled
   * via `onFilterValuesChange`; without a handler read-only. */
  filterValues?: IrisTableFilterValues
  /** Fired when the filter panel confirms or clears a column's checked set. */
  onFilterValuesChange?: (next: IrisTableFilterValues) => void
  /** Search form (vxe-grid formConfig parity). */
  formConfig?: IrisTableFormConfig
  /** Toolbar (vxe-grid toolbarConfig parity, minimal built-ins). */
  toolbar?: IrisTableToolbarConfig
  /** Built-in row-list undo/redo history; Ctrl/Cmd+Z undoes and Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) redoes. Default off. */
  undo?: boolean
  /** Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
   * set, rows come from the proxy `query` (paged) and a pager renders below
   * the body. */
  proxyConfig?: IrisTableProxyConfig<Row>
  /** Pager options (vxe-grid pagerConfig parity). */
  pagerConfig?: IrisTablePagerConfig
  striped?: boolean
  bordered?: boolean
  /** Row-density preset; invalid runtime values fail closed to comfortable. */
  density?: IrisTableDensity
  /** Show the local density cycle button in the table toolbar. */
  densityToggle?: boolean
  /** Show a live formatter preview while an editor is open. */
  editPreview?: boolean
  /** Highlight committed cells matching the active inline draft. */
  pattern?: boolean
  /** Alias for pattern feedback. */
  patternFill?: boolean
  /** Named snapshots available in the table toolbar. */
  views?: IrisTableViewConfig
  /** Controlled active named view notification. */
  onActiveViewChange?: (key: string | null) => void
  /** Optional tab strip; tab clicks apply listed view names in order. */
  tableTabs?: IrisTableTab[]
  /** Show a draggable boundary for the leading left-pinned columns. */
  pinnedDrag?: boolean
  /** Called for each column whose pin side changes. */
  onColumnPinnedChange?: (key: string, side: 'left' | 'right' | null) => void
  /** Called once after a pinned-boundary commit. */
  onPinnedCountChange?: (count: number) => void
  /** Below 480px, greedily hide the lowest-priority top-level columns until
   * the natural width fits; pinned columns survive. */
  responsive?: boolean
  /**
   * External rows for adapter-local cross-table formulas. `=other!field`
   * reads `formulaTables.other[0].field`; absent/unknown/empty references
   * fail closed. Pass a new record when a referenced table changes.
   */
  formulaTables?: Record<string, Row[]>
  /** Extra bare row sets appended as named CSV segments by the imperative handle. */
  exportNames?: Array<{ key: string; ref: () => Row[] }>
  /** Infer leaf-column value kinds from the first non-empty data arrival and
   * fill only missing alignment defaults. Disabled by default. */
  autoDetectTypes?: boolean
  loading?: boolean
  error?: boolean
  /** Print-friendly mode: marks the root so toolbar/form chrome is hidden by print CSS. */
  printable?: boolean
  /** Show a token-styled back-to-top button after the effective scroller passes 200px. */
  scrollToTop?: boolean
  /** Show a confirmation preview before the toolbar CSV import callback. */
  importPreview?: boolean
  emptyState?: JSX.Element
  loadingState?: JSX.Element
  errorState?: JSX.Element
  /** Fired by the built-in Retry button in the error state row. */
  onRetry?: () => void
  /**
   * Row drag-sort (composed over core createSortable, vxe-grid rowDragConfig
   * parity). Renders a leading drag handle per row; dropping past the press
   * threshold reorders the local row list and reports it through BOTH
   * `onReorder` and `onDataChange` (parent owns the canonical data).
   */
  rowDrag?: {
    /** Reorder callback — receives the reordered row array. */
    onReorder: (rows: Row[]) => void
  }
  /**
   * Column drag-sort (vxe-grid columnDragConfig parity). Reorders leaf
   * columns on drop; parent owns columns (pass the reordered array back).
   * Grouped header groups are never draggable (leaves only).
   */
  columnDrag?: {
    /** Called with the reordered column array after a drop. */
    onReorder: (columns: IrisTableColumn<Row>[]) => void
  }
  /** Inline-edit configuration (vxe-grid editConfig parity). */
  editConfig?: IrisTableEditConfig
  /**
   * Right-click context menu (vxe-grid contextMenu parity). Opens on body
   * leaf cells only — header, seq, selection, expand, summary and footer
   * cells never open it. The menu floats at the cursor (virtual anchor),
   * closes on Escape / outside pointer-down / any scroll, and fires
   * `onSelect` with the clicked item's key and the cell's grid coordinates.
   */
  contextMenu?: {
    items: (params: IrisTableContextMenuParams<Row>) => IrisTableContextMenuItem[]
    onSelect: (key: string, params: IrisTableContextMenuParams<Row>) => void
  }
  /** Imperative handle for proxy/view ops (vxe loadData/reloadData/commitProxy/getProxyInfo/clearSort/clearFilter parity). */
  tableRef?: { current: IrisTableHandle<Row> | null }
  /** Fired after an internal row-list write (rowDrag reorder / loadData) with the new row list. */
  onDataChange?: (rows: Row[]) => void
  /** Enable column resizing. */
  resizableColumns?: boolean
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  onRowClick?: (row: Row, index: number) => void
  onCellEdit?: (event: IrisTableCellEditEvent<Row>) => void
  /** Render an expandable detail panel beneath a row. */
  renderDetail?: IrisTableRenderDetail<Row>
  rowExpandable?: IrisTableRowExpandable<Row>
  defaultExpandedRowKeys?: Array<string | number>
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /** Return a row's children to enable tree mode. */
  getSubRows?: (row: Row) => Row[] | undefined
  /** Lazy tree (vxe lazyLoad parity): a row with no children still renders a caret; the first expand calls this and `load` resolves the children (expanding the row). */
  lazyLoad?: IrisTableLazyLoad<Row>
  keyboardNavigation?: boolean
  cellRange?: boolean
  /** Range clipboard copy; copyWithFormat uses column formatter output. */
  clipConfig?: IrisTableClipConfig
  virtualScroll?: IrisTableVirtualOptions
  columnVirtualization?: boolean
  style?: JSX.CSSProperties
}
