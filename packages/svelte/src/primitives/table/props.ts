import type { Snippet } from 'svelte'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortState,
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
