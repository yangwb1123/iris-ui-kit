import type { CSSProperties, ReactNode } from 'react'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
  IrisTableSortState,
  IrisTableVirtualOptions,
} from './types'

/** Public input surface for the React table adapter. */
export interface IrisTableProps<Row extends Record<string, unknown> = Record<string, unknown>> {
  columns: IrisTableColumn<Row>[]
  data: Row[]
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
  striped?: boolean
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
  onCellEdit?: (event: IrisTableCellEditEvent<Row>) => void
  /** Render an expandable detail panel beneath a row. */
  renderDetail?: IrisTableRenderDetail<Row>
  /** Which rows can expand a detail panel. */
  rowExpandable?: IrisTableRowExpandable<Row>
  /** Initially-expanded row keys (uncontrolled). Shared by detail rows + tree rows. */
  defaultExpandedRowKeys?: Array<string | number>
  /** Notified with the expanded row keys whenever they change. */
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /** Read a row's child rows to render the table as a tree. */
  getSubRows?: (row: Row) => Row[] | undefined
  /** Enable WAI-ARIA grid keyboard navigation. */
  keyboardNavigation?: boolean
  /** Enable virtual scrolling for the body. */
  virtualScroll?: IrisTableVirtualOptions
  /** Render only the horizontally-visible columns plus pinned columns and overscan. */
  columnVirtualization?: boolean
  /** Enable rectangular cell-range selection. */
  cellRange?: boolean
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
  style?: CSSProperties
  className?: string
}
