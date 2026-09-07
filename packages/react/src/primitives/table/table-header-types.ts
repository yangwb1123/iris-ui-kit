import type * as React from 'react'
import type { GridLeadingTrack, HeaderCell } from '@iris-ui-kit/core'
import type { UseI18nReturn } from '../../i18n'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableFilterValues,
  IrisTableAlign,
  IrisTableSortState,
} from './types'

export type TableTranslate = UseI18nReturn['t']

export interface TableHeaderBaseProps<Row extends Record<string, unknown>> {
  gridTemplateColumns: string
  borderStyle: string
  baseCellStyle: React.CSSProperties
  cellOverflowOverride: React.CSSProperties
  rowDragEnabled: boolean
  showRowNumbers: boolean
  seq: boolean
  hasDetail: boolean
  selectable: 'none' | 'single' | 'multi'
  allSelected: boolean
  someSelected: boolean
  displaySelection: Array<string | number>
  toggleAll: () => void
  t: TableTranslate
  headerAlign?: IrisTableAlign
  headerCellClassName?: (column: IrisTableColumn<Row>) => string
  headerCellStyle?: (column: IrisTableColumn<Row>) => React.CSSProperties
  headerTooltip: (column: IrisTableColumn<Row>) => string | undefined
  columnFadeAttr: (column: IrisTableColumn<Row>) => 'in' | 'out' | undefined
  columnFadeStyle: (column: IrisTableColumn<Row>) => React.CSSProperties | null
  pinOf: (column: IrisTableColumn<Row>) => 'left' | 'right' | null
  pinnedStyle: (key: string) => React.CSSProperties | null
  showHeaderOverflow: boolean
  columnDrag?: unknown
  handleColDragPointerDown: (event: React.PointerEvent, key: string) => void
  colDragActive: string | null
  colDragOver: string | null
  cycleHeaderSort: (column: IrisTableColumn<Row>) => void
  onHeaderClick?: (column: IrisTableColumn<Row>) => void
  onHeaderKeyDown: (
    event: React.KeyboardEvent<HTMLDivElement>,
    column: IrisTableColumn<Row>,
  ) => void
  columnPinMenu?: boolean
  handleHeaderContextMenu: (event: React.MouseEvent, column: IrisTableColumn<Row>) => void
  multiSort: boolean
  multiSortState?: IrisTableSortState[]
  sort?: IrisTableSortState | null
  showCellRefs: boolean
  headerStats: boolean
  headerStatsByKey: Record<string, { count: number; average: number }>
  filterValues?: IrisTableFilterValues
  filterPanelOpenKey?: string
  openFilterPanel: (event: React.MouseEvent<HTMLButtonElement>, key: string) => void
  pinnedBoundaryCol?: IrisTableColumn<Row> | null
  resolvePinnedCount: (delta: number) => number
  commitPinnedCount: (count: number) => void
  utilityTrack?: (track: GridLeadingTrack) => number
}

export interface GroupedTableHeaderProps<
  Row extends Record<string, unknown>,
> extends TableHeaderBaseProps<Row> {
  showHeader: boolean
  grouped: boolean
  headerMatrix: HeaderCell<IrisTableColumn<Row>>[][] | null
  leadingTrackCount: number
}

export interface FlatTableHeaderProps<
  Row extends Record<string, unknown>,
> extends TableHeaderBaseProps<Row> {
  showHeader: boolean
  grouped: boolean
  responsiveDisplayColumns: IrisTableColumn<Row>[]
  visibleColSet: Set<number> | null
  mergeHeaderCells?: unknown
  columnVirtualization: boolean
  headerMergePlan: {
    byCol: Map<number, { rowspan?: number; colspan?: number }>
    occupied: Set<string>
  }
  colTrack: (index: number) => number
  currentColumnKey?: string
  setCurrentColumn: (column: IrisTableColumn<Row>) => void
  editShowAsterisk: boolean
  resizableColumns: boolean
  columnWidths: IrisTableColumnWidths
  setColumnWidth: (key: string, width: number) => void
  widthHint: boolean
  autoResizeColumns: boolean
  onAutoFitColumn?: (column: IrisTableColumn<Row>) => void
}
