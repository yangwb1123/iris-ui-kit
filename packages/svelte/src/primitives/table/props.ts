import type { Snippet } from 'svelte'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableFormConfig,
  IrisTablePagerConfig,
  IrisTableProxyConfig,
  IrisTableSeqMethodParams,
  IrisTableSortState,
  IrisTableSpan,
  IrisTableSpanMethodParams,
  IrisTableToolbarConfig,
  IrisTableVirtualOptions,
} from './types'

/** Public input surface for the Svelte table adapter. */
export interface IrisTableProps {
  columns: IrisTableColumn[]
  /** Table data. Optional (server-side sources may omit it). */
  data?: Array<Record<string, unknown>>
  rowKey?: string
  selectable?: 'none' | 'single' | 'multi'
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
  loading?: boolean
  error?: boolean
  emptyState?: Snippet
  loadingState?: Snippet
  errorState?: Snippet
  /** Fired by the built-in Retry button in the error state row. */
  onRetry?: () => void
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
  keyboardNavigation?: boolean
  cellRange?: boolean
  onUpdateSelection?: (value: Array<string | number>) => void
  onUpdateSort?: (value: IrisTableSortState | null) => void
  onRowClick?: (row: Record<string, unknown>, index: number) => void
  onCellEdit?: (event: IrisTableCellEditEvent) => void
  style?: string
  [key: string]: unknown
}
