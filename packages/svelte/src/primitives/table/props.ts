import type { Snippet } from 'svelte'
import type {
  IrisTableCellEditEvent,
  IrisTableClipConfig,
  IrisTableColumn,
  IrisTableColumnDrag,
  IrisTableColumnWidths,
  IrisTableContextMenuConfig,
  IrisTableEditConfig,
  IrisTableFilterValues,
  IrisTableFormConfig,
  IrisTableHandle,
  IrisTablePagerConfig,
  IrisTableProxyConfig,
  IrisTableRowDrag,
  IrisTableSeqMethodParams,
  IrisTableSortState,
  IrisTableDensity,
  IrisTableSpan,
  IrisTableSpanMethodParams,
  IrisTableToolbarConfig,
  IrisTableVirtualOptions,
  IrisTableTab,
  IrisTableViewConfig,
} from './types'

/** Public input surface for the Svelte table adapter. */
export interface IrisTableProps {
  columns: IrisTableColumn[]
  /** Table data. Optional (server-side sources may omit it). */
  data?: Array<Record<string, unknown>>
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
  /** Inline edit behavior; row mode opens all editable cells in a row. */
  editConfig?: IrisTableEditConfig
  selection?: Array<string | number>
  defaultSelection?: Array<string | number>
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  /** Multi-column sort (vxe sort-config.multiple parity): header clicks
   * append/cycle columns in click order instead of replacing. Default false. */
  multiSort?: boolean
  /** Controlled multi-column sort state (multiSort mode). */
  multiSortState?: IrisTableSortState[]
  /** Default multi-column sort (multiSort mode, uncontrolled). */
  defaultMultiSort?: IrisTableSortState[]
  onUpdateMultiSort?: (next: IrisTableSortState[]) => void
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
  spanMethod?: (params: IrisTableSpanMethodParams) => IrisTableSpan | null
  /** Column visibility (vxe columnConfig.visible parity): map of column key →
   * visible (default true). Hidden columns are not rendered. */
  columnVisibility?: Record<string, boolean>
  /** Client-side filters (vxe filterConfig parity, local mode): column key →
   * filter text; rows filtered with substring, case-insensitive matching
   * ('' entries ignored). Combines with `formConfig` values when both exist. */
  filters?: Record<string, string>
  /** Fired when an imperative filter clear replaces the controlled text map. */
  onFiltersChange?: (next: Record<string, string>) => void
  /** Per-column checkbox filter sets (OR within a column, AND across columns). */
  filterValues?: IrisTableFilterValues
  /** Fired when a checkbox filter panel is applied or cleared. */
  onFilterValuesChange?: (next: IrisTableFilterValues) => void
  /** Right-click menu for body leaf cells. */
  contextMenu?: IrisTableContextMenuConfig
  /** Search form (vxe-grid formConfig parity). */
  formConfig?: IrisTableFormConfig
  /** Toolbar (vxe-grid toolbarConfig parity, minimal built-ins). */
  toolbar?: IrisTableToolbarConfig
  /** Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
   * set, rows come from the proxy `query` (paged) and a pager renders below
   * the body. */
  proxyConfig?: IrisTableProxyConfig
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
  /** Extra bare row sets appended as named CSV segments by the imperative handle. */
  exportNames?: Array<{
    key: string
    ref: () => Array<Record<string, unknown>>
  }>
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
  emptyState?: Snippet
  loadingState?: Snippet
  errorState?: Snippet
  /** Fired by the built-in Retry button in the error state row. */
  onRetry?: () => void
  /** Row drag-sort; the callback receives the reordered live row list. */
  rowDrag?: IrisTableRowDrag
  /** Column drag-sort; grouped header cells remain non-draggable. */
  columnDrag?: IrisTableColumnDrag
  /** Fired after an internal row reorder. */
  onDataChange?: (rows: Array<Record<string, unknown>>) => void
  /** Imperative proxy/view handle (vxe loadData/reloadData/commitProxy parity). */
  tableRef?: { current: IrisTableHandle | null }
  virtualScroll?: IrisTableVirtualOptions
  /** Render only horizontally-visible columns plus pinned columns and overscan. */
  columnVirtualization?: boolean
  /** Enable per-column resize handles. */
  resizableColumns?: boolean
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  /** Render an expandable detail panel beneath a row. */
  renderDetail?: (row: Record<string, unknown>, rowIndex: number) => unknown
  rowExpandable?: (row: Record<string, unknown>, rowIndex: number) => boolean
  defaultExpandedRowKeys?: Array<string | number>
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /** Read a row's children to enable tree mode. */
  getSubRows?: (row: Record<string, unknown>) => Array<Record<string, unknown>> | undefined
  /** Persist view state (sort/filters/column widths/page size) across remounts. */
  persistState?: import('./types').IrisTablePersistConfig
  keyboardNavigation?: boolean
  cellRange?: boolean
  /** Range clipboard copy; copyWithFormat uses column formatter output. */
  clipConfig?: IrisTableClipConfig
  onUpdateSelection?: (value: Array<string | number>) => void
  onUpdateSort?: (value: IrisTableSortState | null) => void
  onRowClick?: (row: Record<string, unknown>, index: number) => void
  onCellEdit?: (event: IrisTableCellEditEvent) => void
  style?: string
  [key: string]: unknown
}
