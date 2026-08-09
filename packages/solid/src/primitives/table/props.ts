import type { JSX } from 'solid-js'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
  IrisTableSortState,
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
  striped?: boolean
  bordered?: boolean
  loading?: boolean
  error?: boolean
  emptyState?: JSX.Element
  loadingState?: JSX.Element
  errorState?: JSX.Element
  /** Fired by the built-in Retry button in the error state row. */
  onRetry?: () => void
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
