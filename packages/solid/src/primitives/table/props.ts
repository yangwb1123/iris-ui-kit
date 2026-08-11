import type { JSX } from 'solid-js'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableContextMenuItem,
  IrisTableContextMenuParams,
  IrisTableEditConfig,
  IrisTableFilterValues,
  IrisTableFormConfig,
  IrisTableHandle,
  IrisTablePagerConfig,
  IrisTableProxyConfig,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
  IrisTableSeqMethodParams,
  IrisTableSortState,
  IrisTableToolbarConfig,
  IrisTableVirtualOptions,
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
  /** Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
   * set, rows come from the proxy `query` (paged) and a pager renders below
   * the body. */
  proxyConfig?: IrisTableProxyConfig<Row>
  /** Pager options (vxe-grid pagerConfig parity). */
  pagerConfig?: IrisTablePagerConfig
  striped?: boolean
  bordered?: boolean
  loading?: boolean
  error?: boolean
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
  keyboardNavigation?: boolean
  cellRange?: boolean
  virtualScroll?: IrisTableVirtualOptions
  columnVirtualization?: boolean
  style?: JSX.CSSProperties
}
