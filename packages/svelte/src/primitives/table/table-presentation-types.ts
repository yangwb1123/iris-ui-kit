import type {
  GridSpanPlan,
  HeaderCell,
  I18n,
  RemoteTableParams,
  RemoteTableSourceState,
  TreeRow,
} from '@iris-ui-kit/core'
import type { IrisTableProps } from './props'
import type { TableColumnFadeController } from './table-column-fade.svelte'
import type { TableFilterController } from './table-filter.svelte'
import type { TableRowEditController } from './table-row-edit.svelte'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableDensity,
  IrisTableFilterValues,
  IrisTableNamedView,
  IrisTableSortState,
} from './types'

export type Translate = I18n['t']
export type HeaderMatrix = HeaderCell<IrisTableColumn>[][]

export type SortingModel = {
  syncSort: (sort: IrisTableSortState | null) => void
  syncMultiSort: (sorts: IrisTableSortState[]) => void
  cycleSort: (key: string) => void
  cycleMultiSort: (key: string) => void
}

export type TableViewsController = {
  readonly viewList: IrisTableNamedView[]
  readonly activeViewKey: string | null
  readonly activeTab: string | null
  selectView: (key: string) => void
  saveView: (name: string) => void
  deleteView: (key: string) => void
  applyTableTab: (tab: NonNullable<IrisTableProps['tableTabs']>[number]) => void
}

export type UndoController = {
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => void
  redo: () => void
}

export interface TablePresentationProps {
  rest: Record<string, unknown>
  rootRef?: (node: HTMLDivElement | null) => void
  style: IrisTableProps['style']
  keyboardNavigation: boolean
  treeMode: boolean
  cellRange: boolean
  clipConfig: IrisTableProps['clipConfig']
  activeCellRange: () => unknown
  copyActiveRange: () => void
  handleRootKeyDown: (event: KeyboardEvent) => void
  dragEnabled: boolean
  handleDragPointerMove: (event: PointerEvent) => void
  handleDragPointerUp: () => void
  handleDragPointerCancel: () => void
  columnVirtualization: boolean
  responsive: boolean
  responsiveOverflow: boolean
  handleRootScroll: (event: Event) => void
  bordered: boolean
  printable: boolean
  scrollToTop: boolean
  effectiveDensity: IrisTableDensity
  tableTabs: IrisTableProps['tableTabs']
  tableViews: TableViewsController
  views: IrisTableProps['views']
  formConfig: IrisTableProps['formConfig']
  formDraft: Record<string, string>
  setFormValue: (key: string, value: string) => void
  handleFormSubmit: (event: Event) => void
  handleFormReset: (event: Event) => void
  toolbar: IrisTableProps['toolbar']
  undo: boolean
  undoController: UndoController
  selectable: 'none' | 'single' | 'multi'
  displaySelection: Array<string | number>
  refreshProxy: () => void
  setProxyParams: (partial: Partial<RemoteTableParams>) => boolean | void
  hasProxy: boolean
  pagerConfig: IrisTableProps['pagerConfig']
  proxyState: RemoteTableSourceState<Record<string, unknown>>
  proxyConfig: IrisTableProps['proxyConfig']
  importPreview: boolean
  densityToggle: boolean
  cycleDensity: () => void
  displayColumns: IrisTableColumn[]
  columnFade: TableColumnFadeController
  grouped: boolean
  headerMatrix: HeaderMatrix | null
  rowDrag: IrisTableProps['rowDrag']
  rowDragSnapshot: { activeId: string | null; overId: string | null }
  handleRowDragPointerDown: (event: PointerEvent, id: string) => void
  columnDrag: IrisTableProps['columnDrag']
  columnDragSnapshot: { activeId: string | null; overId: string | null }
  handleColumnDragPointerDown: (event: PointerEvent, key: string) => void
  seq: boolean
  hasDetail: boolean
  selection: IrisTableProps['selection']
  allSelected: boolean
  someSelected: boolean
  toggleAll: () => void
  multiSort: boolean
  effectiveMultiSort: IrisTableSortState[]
  effectiveSort: IrisTableSortState | null
  sortingModel: SortingModel
  sort: IrisTableProps['sort']
  multiSortState: IrisTableProps['multiSortState']
  filterValues: IrisTableFilterValues
  filterController: TableFilterController
  leafColumns: IrisTableColumn[]
  contextMenu: IrisTableProps['contextMenu']
  bodyData: Record<string, unknown>[]
  flatTree: Array<TreeRow<Record<string, unknown>>> | null
  virtualScroll: IrisTableProps['virtualScroll']
  rowId: (row: Record<string, unknown>, index: number) => string | number
  liveRowFor: (row: Record<string, unknown>, index: number) => Record<string, unknown>
  isSelected: (id: string | number) => boolean
  toggleRow: (id: string | number) => void
  rowMode: boolean
  rowEdit: TableRowEditController
  editConfig: IrisTableProps['editConfig']
  editingCellId: string | null
  editingColumnKey: string | null
  editingDraft: string
  editError: string | null
  pattern: boolean
  patternFill: boolean
  striped: boolean
  spanPlan: GridSpanPlan | null
  visibleColSet: Set<number> | null
  gridTemplate: () => string
  resizableColumns: boolean
  registerResizeHandle: (node: HTMLElement, key: string) => { destroy: () => void }
  effectiveWidths: IrisTableColumnWidths
  onResizeHandleKeydown: (event: KeyboardEvent, column: IrisTableColumn) => void
  pinnedDrag: boolean
  pinnedBoundaryKey: string | null
  pinOf: (column: IrisTableColumn) => 'left' | 'right' | null
  pinnedStyle: (key: string) => string
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
  loading: boolean
  error: boolean
  errorState: IrisTableProps['errorState']
  loadingState: IrisTableProps['loadingState']
  emptyState: IrisTableProps['emptyState']
  onRetry?: () => void
  seqStartIndex: number
  seqMethod: IrisTableProps['seqMethod']
  renderDetail: IrisTableProps['renderDetail']
  onRowClick: IrisTableProps['onRowClick']
  isRowExpandable: (row: Record<string, unknown>, index: number) => boolean
  expandedKeys: string[]
  expansionToggle: (key: string) => void
  lazyLoad: IrisTableProps['lazyLoad']
  hasLazyChildren: (row: Record<string, unknown>, key: string) => boolean
  lazyLoading: Set<string>
  loadLazyChildren: (
    row: Record<string, unknown>,
    key: string,
    effectiveKey: string | number,
  ) => void
  getCellValue: (row: Record<string, unknown>, column: IrisTableColumn) => unknown
  beginEdit: (row: Record<string, unknown>, column: IrisTableColumn, rowId: string | number) => void
  setCellDraft: (value: string) => void
  commitEdit: (row: Record<string, unknown>, column: IrisTableColumn, rowIndex: number) => void
  cancelEdit: () => void
  startRange: (row: number, col: number) => void
  extendRange: (row: number, col: number) => void
  cellTabIndex: (row: number, col: number) => number
  isInRange: (row: number, col: number) => boolean
  setFocusedCell: (cell: { row: number; col: number }) => void
  formulaTables: IrisTableProps['formulaTables']
  editPreview: boolean
  t: Translate
}
