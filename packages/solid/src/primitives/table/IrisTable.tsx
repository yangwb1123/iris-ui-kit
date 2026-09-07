import {
  createEffect,
  createMemo,
  createSignal,
  For,
  mergeProps,
  on,
  onCleanup,
  onMount,
  Show,
  type Accessor,
  type JSX,
} from 'solid-js'
import {
  applyColumnOrder,
  applyDetectedColumnDefaults,
  computeSelectionFlags,
  createTableMultiSortComparator,
  createTableSortComparator,
  resolveTableSortInfo,
  sortTableRows,
  DEFAULT_COLUMN_MIN_WIDTH,
  columnGridTrack,
  buildFormValues,
  buildHeaderMatrix,
  applyTableMask,
  compareStates,
  computePinnedColumnOffsets,
  computeResponsiveColumnLayout,
  computeVisibleColumnIndices,
  countLeadingGridTracks,
  resolveColumnWidth,
  resolveGridSpan,
  detectColumnType,
  flattenLeafColumns,
  projectTableBodyRows,
  filterTableRows,
  mergeFormFilters,
  reconcileProjectedRows,
  reorderRowsInList,
  resolveRowDragProjection,
  resolveTableRowKey,
  reorderTreeRows,
  withSortedChildren,
  nextGridCell,
  seedFormValues,
  toCsvRows,
  type GridNavKey,
  type DetectedColumnType,
  type HeaderCell,
  type RemoteTableSource,
  type TreeRow,
  writeClipboardText,
} from '@iris-ui-kit/core'
import {
  useGridCore,
  useGridClipboard,
  useGridColumns,
  useGridEditing,
  useGridExpansion,
  useGridFiltering,
  useGridRange,
  useGridRows,
  useGridSelection,
  useGridSorting,
} from '../../grid'
import { useI18n } from '../../i18n'
import { IrisVirtualScroll } from '../virtual-scroll/IrisVirtualScroll'
import type { IrisTableProps } from './props'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableFilterValues,
  IrisTableDensity,
  IrisTableContextMenuItem,
  IrisTableContextMenuParams,
  IrisTableSortState,
  IrisTableViewSnapshot,
} from './types'
import { useTableProxy } from './useTableProxy'
import {
  TableContextMenu as TableOverlayContextMenu,
  TableFilterPanel as TableOverlayFilterPanel,
} from './table-overlay'
import { mergeFilterValues } from './table-helpers'
import { TableForm, TablePager, TableToolbar } from './table-chrome'
import { TableFlatHeader, TableGroupedHeader } from './table-header'
import { TableSummary } from './table-summary'
import { createTableDrag } from './table-drag'
import { TableScrollTop } from './table-scroll-top'
import { TableFilterTrigger } from './table-filter-trigger'
import { createTableRowTarget } from './table-row-target'
import { createTableColumnFade } from './table-column-fade'
import { createTableGridTemplate } from './table-grid'
import { ensureTableStyles } from './styles'
import { createPinnedDragMath } from './table-pinned-drag'
import { createTableViewsController, TableTabs, TableViews } from './table-views'
import { createTableUndoController } from './table-undo'
import { createTableRowEditController, type RowCellSession } from './table-row-edit'
import { createTableBodyRowRenderer } from './table-body-row'
import { getCellValue as getTableCellValue } from './utils'
import { isEditableColumn, withComputedFormulaCells } from './utils'
import { exportCsv as serializeTableCsv } from './exportCsv'

export type { IrisTableProps } from './props'

const DRAG_COL_WIDTH = 40
const PIN_LEFT_MENU_KEY = '__iris-pin-left'
const UNPIN_MENU_KEY = '__iris-unpin'

/** Read clipboard text; null when the browser API is unavailable or denied. */
async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { clipboard?: { readText?: () => Promise<string> } }
  if (!nav.clipboard?.readText) return null
  try {
    return await nav.clipboard.readText()
  } catch {
    return null
  }
}

/** Data table rendered as CSS grid with sorting, selection, editing, and
 * opt-in virtual windows for flat/tree rows. */
export function IrisTable<Row extends Record<string, unknown> = Record<string, unknown>>(
  props: IrisTableProps<Row>,
): JSX.Element {
  const merged = mergeProps(
    {
      rowKey: 'id',
      selectable: 'none' as 'none' | 'single' | 'multi',
      striped: false,
      bordered: true,
      loading: false,
      error: false,
      resizableColumns: false,
      keyboardNavigation: false,
      cellRange: false,
      editConfig: undefined as import('./types').IrisTableEditConfig | undefined,
      columnVirtualization: false,
      columnFade: false,
      multiSort: false,
      scrollToTop: false,
      seq: false,
      undo: false,
    },
    props,
  )

  /** Resolve values with this table's own external-table scope. Keeping the
   * scope in this component closure prevents multiple Solid tables from
   * leaking formula references into one another. */
  const resolveTableCellValue = (row: Row, column: IrisTableColumn<Row>): unknown =>
    getTableCellValue(row, column, props.formulaTables)

  const { t } = useI18n()
  const [densityState, setDensityState] = createSignal<IrisTableDensity>('comfortable')
  const densityProp = (): IrisTableDensity =>
    merged.density === 'compact' || merged.density === 'cozy' ? merged.density : 'comfortable'
  const effectiveDensity = (): IrisTableDensity =>
    merged.densityToggle ? densityState() : densityProp()
  const cycleDensity = (): void => {
    setDensityState((current) =>
      current === 'comfortable' ? 'compact' : current === 'compact' ? 'cozy' : 'comfortable',
    )
  }

  const [responsiveWidth, setResponsiveWidth] = createSignal(0)
  const gridCore = useGridCore<Row>()
  const columnsFeature = useGridColumns(gridCore, {
    // Use the same feature that owns subsequent table column mutations. The
    // values are only the initial snapshot; the effects below mirror later
    // Solid prop replacements without making the core emit an event.
    visibility: props.columnVisibility,
    order: props.columnOrder,
    widths: props.columnWidths,
    pinned: props.pinnedColumns,
    defaultWidths: props.defaultColumnWidths,
    onVisibilityChange: (next) => props.onColumnVisibilityChange?.(next),
    onOrderChange: (next) => props.onColumnOrderChange?.(next),
    onWidthsChange: (next) => props.onColumnWidthsChange?.(next),
    onPinnedChange: (key, side) => props.onColumnPinnedChange?.(key, side),
  })
  const [pinPropControlled, setPinPropControlled] = createSignal(props.pinnedColumns !== undefined)
  const [orderPropControlled, setOrderPropControlled] = createSignal(
    props.columnOrder !== undefined,
  )
  const [uncontrolledWidths, setUncontrolledWidths] = createSignal<IrisTableColumnWidths>({
    ...(props.defaultColumnWidths ?? {}),
  })
  const [widthPropControlled, setWidthPropControlled] = createSignal(
    props.columnWidths !== undefined,
  )

  // Solid hook options are evaluated when the helper is called, so table props
  // need explicit effects for replacement. Core sync methods are intentionally
  // silent; in particular, a rejected controlled update must not echo back.
  createEffect(() => {
    const visibility = props.columnVisibility
    columnsFeature.model.syncVisibility(visibility ?? {})
  })
  createEffect(() => {
    const pinned = props.pinnedColumns
    if (pinned !== undefined) {
      columnsFeature.model.syncPinned(pinned)
    } else if (pinPropControlled()) {
      // Do not expose a rejected controlled proposal after control is removed.
      columnsFeature.model.syncPinned({})
    }
    setPinPropControlled(pinned !== undefined)
  })
  createEffect(() => {
    const order = props.columnOrder
    if (order !== undefined) {
      columnsFeature.model.syncOrder(order)
    } else if (orderPropControlled()) {
      // Clear a rejected controlled proposal before exposing the model again.
      columnsFeature.model.syncOrder([])
    }
    setOrderPropControlled(order !== undefined)
  })
  createEffect(() => {
    const widths = props.columnWidths
    if (widths !== undefined) {
      columnsFeature.model.syncWidths(widths)
    } else if (widthPropControlled()) {
      // Match the old local owner: removing control restores the last
      // uncontrolled/default snapshot rather than the controlled proposal.
      columnsFeature.model.syncWidths(uncontrolledWidths())
    }
    setWidthPropControlled(widths !== undefined)
  })

  const pinOf = (col: IrisTableColumn<Row>): 'left' | 'right' | null => {
    const controlled = props.pinnedColumns
    if (controlled !== undefined) {
      if (Object.prototype.hasOwnProperty.call(controlled, col.key)) {
        return controlled[col.key] ?? null
      }
      return col.pinned ?? null
    }
    const internal = columnsFeature.state().pinned
    if (Object.prototype.hasOwnProperty.call(internal, col.key)) {
      return internal[col.key] ?? null
    }
    return col.pinned ?? null
  }
  const effectiveVisibility = (): Record<string, boolean> =>
    props.columnVisibility !== undefined
      ? props.columnVisibility
      : columnsFeature.state().visibility
  const effectiveColumnOrder = (): string[] | undefined => {
    if (props.columnOrder !== undefined) return props.columnOrder
    return orderPropControlled() ? [] : columnsFeature.state().order
  }
  const columnFade = createTableColumnFade<Row>({
    visibility: effectiveVisibility,
    enabled: () => merged.columnFade === true,
    columns: () => merged.columns,
  })
  const sourceDisplayColumns = createMemo<IrisTableColumn<Row>[]>(() => {
    const vis = columnFade.effectiveVisibility()
    if (Object.keys(vis ?? {}).length === 0) return merged.columns
    return merged.columns.filter((c) => vis?.[c.key] !== false)
  })
  const [detectedTypes, setDetectedTypes] = createSignal<Record<string, DetectedColumnType>>({})
  let detectTypesDone = false
  const detectedDisplayColumns = createMemo<IrisTableColumn<Row>[]>(() => {
    if (!merged.autoDetectTypes || Object.keys(detectedTypes()).length === 0) {
      return sourceDisplayColumns()
    }
    return applyDetectedColumnDefaults(sourceDisplayColumns(), detectedTypes())
  })
  const responsiveLeadingWidth = createMemo(
    () =>
      (merged.rowDrag ? DRAG_COL_WIDTH : 0) +
      (merged.seq ? 60 : 0) +
      (merged.renderDetail !== undefined ? 40 : 0) +
      (merged.selectable !== 'none' ? 40 : 0),
  )
  const responsiveWidthOf = (column: IrisTableColumn<Row>): number =>
    resolveColumnWidth(column, effectiveWidths())
  const orderedDisplayColumns = createMemo<IrisTableColumn<Row>[]>(() =>
    applyColumnOrder(detectedDisplayColumns(), effectiveColumnOrder()),
  )
  const responsiveResult = createMemo(() =>
    merged.responsive
      ? computeResponsiveColumnLayout(orderedDisplayColumns(), responsiveWidth(), {
          leadingWidth: responsiveLeadingWidth(),
          widthOf: responsiveWidthOf,
          isPinnedLeaf: (column) => pinOf(column) !== null,
        })
      : { columns: orderedDisplayColumns(), overflow: false },
  )
  const responsiveOverflow = createMemo(() => responsiveResult().overflow)
  const displayColumns = createMemo<IrisTableColumn<Row>[]>(
    () => responsiveResult().columns as IrisTableColumn<Row>[],
  )

  const grouped = createMemo(() =>
    displayColumns().some((c) => c.children && c.children.length > 0),
  )
  const leafColumns = createMemo<IrisTableColumn<Row>[]>(() =>
    grouped() ? flattenLeafColumns(displayColumns()) : displayColumns(),
  )
  const headerMatrix = createMemo<HeaderCell<IrisTableColumn<Row>>[][] | null>(() =>
    grouped() ? buildHeaderMatrix(displayColumns()) : null,
  )

  const widthsControlled = (): boolean => props.columnWidths !== undefined
  const effectiveWidths = (): IrisTableColumnWidths => {
    const controlled = props.columnWidths
    if (controlled !== undefined) return controlled
    // Effects run after a Solid parent replacement. During the one render
    // before the transition effect, expose the preserved uncontrolled snapshot
    // rather than the old controlled model map.
    if (widthPropControlled()) return uncontrolledWidths()
    return columnsFeature.state().widths
  }
  const widthOf = (col: IrisTableColumn<Row>): number => resolveColumnWidth(col, effectiveWidths())
  const pinnedOffsets = createMemo(() =>
    computePinnedColumnOffsets(leafColumns(), widthOf, pinOf, responsiveLeadingWidth()),
  )
  const pinnedStyle = (key: string): JSX.CSSProperties | null => {
    const pin = pinnedOffsets()[key]
    if (!pin) return null
    return pin.side === 'left'
      ? {
          position: 'sticky',
          'inset-inline-start': `${pin.offset}px`,
          'z-index': 1,
          background: 'var(--iris-background)',
        }
      : {
          position: 'sticky',
          'inset-inline-end': `${pin.offset}px`,
          'z-index': 1,
          background: 'var(--iris-background)',
        }
  }
  const setColumnPinned = (key: string, side: 'left' | 'right' | null): void => {
    const column = leafColumns().find((candidate) => candidate.key === key)
    if (!column || pinOf(column) === side) return
    columnsFeature.setPinned(key, side)
  }
  const setColumnWidths = (next: IrisTableColumnWidths): void => {
    if (!widthsControlled()) setUncontrolledWidths(next)
    columnsFeature.setWidths(next)
  }

  const pinnedDrag = createPinnedDragMath<Row>({
    enabled: () => merged.pinnedDrag,
    columns: leafColumns,
    widthOf,
    pinOf,
    controlled: () => props.pinnedColumns !== undefined,
    setPinned: setColumnPinned,
    onColumnPinnedChange: merged.onColumnPinnedChange,
    onPinnedCountChange: merged.onPinnedCountChange,
  })
  const pinnedBoundaryKey = createMemo(pinnedDrag.boundaryKey)
  const resolvePinnedCount = pinnedDrag.resolvePinnedCount
  const commitPinnedCount = pinnedDrag.commitPinnedCount

  const hasProxy = (): boolean => props.proxyConfig !== undefined
  const remoteSort = (): boolean => props.proxyConfig?.remoteSort === true
  const remoteFilter = (): boolean => props.proxyConfig?.remoteFilter === true
  const proxyPresence = createMemo(() => hasProxy())
  let proxy: RemoteTableSource<Row> | null = null
  const { state: proxyState } = useTableProxy<Row>({
    props,
    proxyPresence,
    remoteSort,
    remoteFilter,
    multiSort: merged.multiSort,
    sort: props.sort,
    defaultSort: props.defaultSort,
    multiSortState: props.multiSortState,
    defaultMultiSort: props.defaultMultiSort,
    onProxyChange: (next) => {
      proxy = next
    },
  })
  const [proxyRows, setProxyRows] = createSignal<Row[]>([])
  createEffect(() => {
    setProxyRows(proxyState().data)
  })
  const [localRows, setLocalRows] = createSignal<Row[] | null>(null)
  createEffect(
    on(
      () => props.data,
      () => {
        if (localRows() !== null) setLocalRows(null)
      },
    ),
  )
  let lastProxyDataRef: Row[] | undefined
  createEffect(() => {
    const data = proxyState().data
    if (data !== lastProxyDataRef) {
      lastProxyDataRef = data
      if (localRows() !== null) setLocalRows(null)
    }
  })
  const baseData = createMemo<Row[]>(() => {
    if (localRows() !== null) return localRows()!
    if (hasProxy()) return proxyRows()
    return props.data ?? []
  })
  createEffect(() => {
    const enabled = merged.autoDetectTypes === true
    const rows = baseData()
    const sourceColumns = merged.columns
    if (!enabled || detectTypesDone || rows.length === 0) return
    detectTypesDone = true
    const next: Record<string, DetectedColumnType> = {}
    for (const column of flattenLeafColumns(sourceColumns).filter((c) => !c.formula)) {
      next[column.key] = detectColumnType(rows.map((row) => resolveTableCellValue(row, column)))
    }
    setDetectedTypes(next)
  })
  const tableLoading = createMemo<boolean>(() => {
    const s = proxyState()
    return hasProxy() ? s.loading : merged.loading
  })
  const tableError = createMemo<boolean>(() => {
    const s = proxyState()
    return hasProxy() ? s.error !== null : merged.error
  })

  // Grid Rows is the single mutation boundary for edits, paste, drag and
  // imperative row operations. The undo bridge is created after the table's
  // selection/root/editing state exists, so the transaction callback records
  // lazily without making undo part of the default path.
  let recordUndoRows: ((rows: Row[]) => void) | null = null
  let suppressUndoRecord = false
  // Solid updates keyed `<For>` rows immediately. While a row-mode editor is
  // open, defer the adapter's local signal write so committing one column does
  // not replace the row DOM under the remaining editors. The core rows model
  // is updated synchronously; the deferred signal flushes once the session
  // closes and therefore preserves both editor focus and row references.
  let rowEditingState: Accessor<{ k: string | number; idx: number } | null> | null = null
  let pendingLocalRows: Row[] | null = null
  let pendingLocalRowsTimer: ReturnType<typeof setTimeout> | null = null
  let liveRowsRef: Row[] = baseData()
  const [liveRevision, setLiveRevision] = createSignal(0)
  const flushPendingLocalRows = (): void => {
    if (pendingLocalRows === null || rowEditingState?.() !== null) return
    const next = pendingLocalRows
    pendingLocalRows = null
    setLocalRows(next)
  }
  const schedulePendingLocalRows = (): void => {
    if (pendingLocalRowsTimer !== null) return
    pendingLocalRowsTimer = setTimeout(() => {
      pendingLocalRowsTimer = null
      flushPendingLocalRows()
    }, 0)
  }
  onCleanup(() => {
    if (pendingLocalRowsTimer !== null) clearTimeout(pendingLocalRowsTimer)
  })
  const sorting = useGridSorting<Row>(gridCore, {
    mode: merged.multiSort ? 'multiple' : 'single',
    defaultSort: props.defaultSort,
    defaultMultiSort: props.defaultMultiSort,
    onSortChange: (next) => {
      merged.onSortChange?.(next)
      // remoteSort parity: sort changes re-query the server (page resets to 1
      // in the core controller, vxe behavior).
      if (remoteSort()) proxy?.setParams({ sort: next })
    },
    onMultiSortChange: (next) => {
      merged.onMultiSortChange?.(next)
      // remoteSort parity (multi mode): the FULL sort list re-queries the
      // server; the single `sort` param stays the single-column channel.
      if (remoteSort()) proxy?.setParams({ sorts: next })
    },
  })
  createEffect(() => {
    if (props.sort !== undefined) sorting.model.syncSort(props.sort ?? null)
    if (props.multiSortState !== undefined) sorting.model.syncMultiSort(props.multiSortState ?? [])
  })

  const effectiveSort = createMemo<IrisTableSortState | null>(() =>
    props.sort !== undefined ? (props.sort ?? null) : sorting.sort(),
  )
  const multiSortState = createMemo<IrisTableSortState[]>(() =>
    props.multiSortState !== undefined ? (props.multiSortState ?? []) : sorting.multiSort(),
  )
  const rebaseControlledSort = (): void => {
    if (props.sort !== undefined) sorting.model.syncSort(props.sort ?? null)
    if (props.multiSortState !== undefined) {
      sorting.model.syncMultiSort(props.multiSortState ?? [])
    }
  }
  const setSort = (next: IrisTableSortState | null): void => {
    rebaseControlledSort()
    sorting.model.setSort(next)
  }
  const cycleSort = (col: IrisTableColumn<Row>): void => {
    if (!col.sortable) return
    if (props.sort !== undefined) sorting.model.syncSort(props.sort ?? null)
    sorting.model.cycleSort(col.key)
  }
  const setMultiSort = (next: IrisTableSortState[]): void => {
    rebaseControlledSort()
    sorting.model.setMultiSort(next)
  }
  const cycleMultiSort = (col: IrisTableColumn<Row>): void => {
    if (!col.sortable) return
    if (props.multiSortState !== undefined) {
      sorting.model.syncMultiSort(props.multiSortState ?? [])
    }
    sorting.model.cycleMultiSort(col.key)
  }
  const sortComparator = createMemo<((a: Row, b: Row) => number) | null>(() => {
    // Read the identity here even when no formula is currently sorted. A new
    // formulaTables record must rebuild the comparator and therefore the
    // sorted view, while in-place mutation remains outside the contract.
    const formulaTables = props.formulaTables
    return createTableSortComparator(effectiveSort(), leafColumns(), (row, column) =>
      getTableCellValue(row, column, formulaTables),
    )
  })
  const multiSortComparator = createMemo<((a: Row, b: Row) => number) | null>(() => {
    const formulaTables = props.formulaTables
    return createTableMultiSortComparator(multiSortState(), leafColumns(), (row, column) =>
      getTableCellValue(row, column, formulaTables),
    )
  })

  // Named views only collect channels this adapter can replay through its
  // existing feature/callback owners. Absent snapshot fields remain untouched;
  // columnVisibility/columnOrder stay out because their owners are not view
  // channels in this bridge.
  const isViewRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
  const captureViewSnapshot = (): Omit<Partial<IrisTableViewSnapshot>, 'sort'> => {
    const extra: Omit<Partial<IrisTableViewSnapshot>, 'sort'> = {}
    if (merged.multiSort) extra.multiSort = multiSortState().map((sort) => ({ ...sort }))
    if (merged.onFiltersChange) extra.filters = { ...effectiveFilters() }
    if (merged.onFilterValuesChange) extra.filterValues = { ...effectiveFilterValues() }
    if (merged.onColumnWidthsChange) extra.columnWidths = { ...effectiveWidths() }
    if (merged.onExpandedRowsChange && (hasDetail() || treeMode())) {
      extra.expandedRowKeys = [...expandedKeys()]
    }
    if (proxy && merged.proxyConfig?.onPageChange) {
      extra.pageSize = proxyState().params.pageSize
    }
    return extra
  }
  const applyViewSnapshot = (snapshot: IrisTableViewSnapshot): void => {
    if (
      merged.multiSort &&
      Array.isArray(snapshot.multiSort) &&
      snapshot.multiSort.every(
        (sort) =>
          sort !== null &&
          typeof sort.key === 'string' &&
          (sort.direction === 'asc' || sort.direction === 'desc'),
      )
    ) {
      sorting.model.setMultiSort(snapshot.multiSort)
    }
    if (merged.onFiltersChange && isViewRecord(snapshot.filters)) {
      filtering.model.setFilters(snapshot.filters as Record<string, string>)
    }
    if (merged.onFilterValuesChange && isViewRecord(snapshot.filterValues)) {
      filtering.model.setFilterValues(snapshot.filterValues as IrisTableFilterValues)
    }
    if (merged.onColumnWidthsChange && isViewRecord(snapshot.columnWidths)) {
      columnsFeature.setWidths(snapshot.columnWidths as IrisTableColumnWidths)
    }
    if (
      merged.onExpandedRowsChange &&
      (hasDetail() || treeMode()) &&
      Array.isArray(snapshot.expandedRowKeys)
    ) {
      expansion.set(snapshot.expandedRowKeys.map(String))
    }
    if (
      typeof snapshot.pageSize === 'number' &&
      snapshot.pageSize > 0 &&
      proxy &&
      merged.proxyConfig?.onPageChange
    ) {
      merged.proxyConfig.onPageChange(1, snapshot.pageSize)
      void proxy.request({ pageSize: snapshot.pageSize, page: 1 })
    }
  }

  const tableViews = createTableViewsController({
    config: () => merged.views,
    sort: effectiveSort,
    setSort,
    capture: captureViewSnapshot,
    applySnapshot: applyViewSnapshot,
    onActiveViewChange: (key) => merged.onActiveViewChange?.(key),
  })

  const sortedRows = createMemo<Row[]>(() => {
    if (remoteSort()) return baseData()
    return sortTableRows(baseData(), leafColumns(), {
      mode: merged.multiSort ? 'multiple' : 'single',
      sort: effectiveSort(),
      multiSort: multiSortState(),
      getValue: (row, column) => getTableCellValue(row, column, props.formulaTables),
    })
  })
  const cycleHeaderSort = (col: IrisTableColumn<Row>): void => {
    if (merged.multiSort) cycleMultiSort(col)
    else cycleSort(col)
  }
  const handleHeaderClick = (column: IrisTableColumn<Row>): void => {
    cycleHeaderSort(column)
  }
  createEffect(() => {
    const present = proxyPresence()
    const single = effectiveSort()
    const multi = multiSortState()
    if (!present || !remoteSort()) return
    if (merged.multiSort) proxy?.setParams({ sorts: multi })
    else proxy?.setParams({ sort: single ?? null })
  })

  // Filtering state is feature-owned; formApplied remains adapter-owned
  // because form keystrokes are draft-only until submit/reset.
  const filtering = useGridFiltering<Row>(gridCore, {
    defaultFilters: props.filters,
    defaultFilterValues: props.filterValues,
    onFiltersChange: (next) => merged.onFiltersChange?.(next),
    onFilterValuesChange: (next) => merged.onFilterValuesChange?.(next),
  })
  createEffect(() => {
    if (props.filters !== undefined) filtering.model.syncFilters(props.filters)
    if (props.filterValues !== undefined) filtering.model.syncFilterValues(props.filterValues)
  })
  const effectiveFilters = createMemo<Record<string, string>>(() =>
    props.filters !== undefined ? props.filters : filtering.filters(),
  )
  const effectiveFilterValues = createMemo(() =>
    props.filterValues !== undefined ? props.filterValues : filtering.filterValues(),
  )

  const [formDraft, setFormDraft] = createSignal<Record<string, string>>(
    seedFormValues(props.formConfig?.fields),
  )
  const [formApplied, setFormApplied] = createSignal<Record<string, string>>({})
  const formFieldSignature = createMemo(() =>
    (props.formConfig?.fields ?? []).map((f) => `${f.key}=${f.defaultValue ?? ''}`).join('\u0000'),
  )
  createEffect(() => {
    // Re-seed only when the field signature actually changes.
    formFieldSignature()
    setFormDraft(seedFormValues(props.formConfig?.fields))
    setFormApplied({})
  })
  const setFormValue = (key: string, value: string): void => {
    setFormDraft((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }
  const mergedProxyFilters = (form: Record<string, string>): Record<string, string> =>
    mergeFormFilters(effectiveFilters(), form)
  const handleFormSubmit = (e: Event): void => {
    e.preventDefault()
    const values = buildFormValues(props.formConfig?.fields, formDraft())
    props.formConfig?.onSearch?.(values)
    setFormApplied(values)
    // Proxy mode: the server owns filtering — merge the form values into the
    // controller filters (page resets to 1 in core applyParams, vxe behavior).
    if (proxy) {
      void proxy.setParams({
        filters: mergeFilterValues(mergedProxyFilters(values), effectiveFilterValues()),
        page: 1,
      })
    }
  }
  const handleFormReset = (e: Event): void => {
    e.preventDefault()
    const defaults = seedFormValues(props.formConfig?.fields)
    setFormDraft(defaults)
    const values = buildFormValues(props.formConfig?.fields, defaults)
    setFormApplied(values)
    props.formConfig?.onReset?.(values)
    if (proxy) {
      // setParams returns false when the merged params are unchanged (e.g.
      // filters already cleared) — a reset must still re-query, so force a
      // refetch only in that no-op case (no double request when it changed).
      if (
        proxy.setParams({
          filters: mergeFilterValues(mergedProxyFilters(values), effectiveFilterValues()),
          page: 1,
        }) === false
      ) {
        void proxy.refetch()
      }
    }
  }
  // remoteFilter parity: hand the filter map to the server and never hide
  // rows client-side (vxe proxyConfig.filter). Form values are merged in so a
  // later `filters` prop change from the parent does not silently drop the
  // applied search. (Core setParams dedupes unchanged params.)
  createEffect(() => {
    const present = proxyPresence()
    const f = effectiveFilters()
    const applied = formApplied()
    if (!present || !remoteFilter()) return
    proxy?.setParams({
      filters: mergeFilterValues(mergeFormFilters(f, applied), effectiveFilterValues()),
    })
  })

  const rowId = (row: Row, index: number): string | number =>
    resolveTableRowKey(row, merged.rowKey, index)

  // Static and lazy tree children share the Core rows source. Lazy rows use a
  // conventional `children` slot after their first load; static trees keep
  // their caller-provided `getSubRows` accessor.
  const readRowChildren = (row: Row): readonly Row[] | undefined => {
    if (props.lazyLoad !== undefined) {
      const children = (row as Record<string, unknown>).children
      if (Array.isArray(children)) return children as Row[]
    }
    return props.getSubRows?.(row)
  }
  const writeLazyChildren =
    props.lazyLoad === undefined
      ? undefined
      : (row: Row, children: Row[]): Row => ({
          ...row,
          children,
        })

  // ---- Expandable detail rows ----
  // A leading toggle column + a full-width detail panel, driven by the
  // shared Grid Core expansion feature (multiple-open). Keys are strings. The
  // same expansion model is reused by tree mode (below) — they're mutually
  // exclusive (renderDetail vs getSubRows).
  const { model: gridRows } = useGridRows(gridCore, baseData(), {
    getRowKey: (row, index) => rowId(row, index),
    getChildren:
      props.getSubRows !== undefined || props.lazyLoad !== undefined ? readRowChildren : undefined,
    setChildren: writeLazyChildren,
    onRowsChange: (transaction) => {
      const next = [...transaction.rows]
      liveRowsRef = next
      setLiveRevision((value) => value + 1)
      if (hasProxy()) setProxyRows(next)
      else if (rowEditingState?.() === null) setLocalRows(next)
      else {
        pendingLocalRows = next
        schedulePendingLocalRows()
      }
      if (!suppressUndoRecord) recordUndoRows?.(next)
    },
  })
  createEffect(() => {
    const rows = baseData()
    if (rows !== liveRowsRef) {
      liveRowsRef = rows
      setLiveRevision((value) => value + 1)
    }
    gridRows.sync(rows)
  })
  const hasDetail = (): boolean => props.renderDetail !== undefined
  const { model: expansion, expandedKeys } = useGridExpansion<Row, string>(gridCore, {
    mode: 'multiple',
    defaultValue: (props.defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => props.onExpandedRowsChange?.(keys),
  })
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail() && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

  // ---- Tree rows ----
  // Opt-in via getSubRows: flatten the (root) data into the visible flat list,
  // honoring the (shared) expansion model. `bodyRows` is what the body, the
  // select-all set, and the summary aggregate over; in flat mode it is identical
  // to sortedRows() (each row carries no tree meta).
  // ---- Client-side filters (vxe filterConfig parity, local mode) ---------
  // Core substring semantics applied to the sorted data before tree flattening
  // (flat mode). With remoteFilter the server owns filtering — rows are never
  // hidden locally. The search form's applied values merge over the `filters`
  // prop (form wins, neither input is mutated); in proxy mode the server owns
  // form filtering, so only the prop map filters the loaded page. The result
  // is reference-preserving when no filter is active.
  const filteredData = createMemo<Row[]>(() => {
    if (remoteFilter()) return sortedRows()
    const mergedF = hasProxy()
      ? effectiveFilters()
      : mergeFormFilters(effectiveFilters(), formApplied())
    return filterTableRows(sortedRows(), leafColumns(), {
      getValue: (row, column) => resolveTableCellValue(row, column),
      filters: mergedF,
      filterValues: effectiveFilterValues(),
    })
  })
  // Tree children sort by the same comparator as the roots: multi mode chains
  // the multi comparator, single mode keeps the single one.
  const treeComparator = createMemo(() =>
    merged.multiSort ? multiSortComparator() : sortComparator(),
  )
  // ---- Lazy tree (vxe lazyLoad parity, batch J) ---------------------------
  // Children are fetched on first expand: `lazyLoad(row, load)`. Loaded
  // children are written to the Core rows source's conventional `children`
  // slot; only the loading SET remains adapter-owned because it drives the
  // caret spinner on both transitions.
  const lazyTree = (): boolean => props.lazyLoad !== undefined
  const [lazyLoading, setLazyLoading] = createSignal<Set<string>>(new Set())
  // Monotonic epoch, bumped whenever the data source reference changes
  // (loading cleared wholesale): a stale fetch must never write into the new
  // Core row source or clear a newer fetch's loading flag.
  let lazyEpoch = 0
  let lastLazySourceRef: Row[] | undefined
  createEffect(() => {
    const source = hasProxy() ? proxyState().data : props.data
    if (source !== lastLazySourceRef) {
      lastLazySourceRef = source
      lazyEpoch++
      setLazyLoading(new Set<string>())
    }
  })
  const lazyChildrenOf = readRowChildren
  const hasLazyChildren = (row: Row): boolean =>
    props.lazyLoad !== undefined && Array.isArray((row as Record<string, unknown>).children)
  const treeProjection = createMemo(() => {
    if (props.getSubRows === undefined && !lazyTree()) return null
    const keys = expandedKeys()
    const compare = treeComparator()
    // `lazyLoading` drives a re-walk when a lazy load lands (the ref-style
    // cache map is not reactive — react's lazyLoading-in-deps parity).
    lazyLoading()
    return projectTableBodyRows<Row>(filteredData(), {
      getKey: (r) => String(rowId(r, 0)),
      // With an active sort, sort each level's children by the same comparator
      // so the whole tree reorders hierarchically. Lazy-loaded children win
      // over `getSubRows` and still participate in the same sorting.
      getChildren: compare ? withSortedChildren(lazyChildrenOf, compare) : lazyChildrenOf,
      isExpanded: (k) => keys.includes(k),
    })
  })
  const flatTree = createMemo<Array<TreeRow<Row>> | null>(
    () => treeProjection()?.map((view) => view.treeMeta!) ?? null,
  )
  // Body rows paired with their tree meta (meta is null in flat mode).
  const bodyEntries = createMemo<Array<{ row: Row; meta: TreeRow<Row> | null }>>(() => {
    // Establish an explicit render dependency for formula results. Solid's
    // <For> preserves an unchanged row identity, so a new tables record must
    // also produce a fresh entry list for every displayed formula cell to
    // re-run; in-place mutation remains outside the immutable prop contract.
    const formulaTables = leafColumns().some((column) => column.formula)
      ? props.formulaTables
      : undefined
    const ft = flatTree()
    const entries = ft
      ? ft.map((t) => ({ row: t.row, meta: t }))
      : filteredData().map((row) => ({ row, meta: null }))
    return formulaTables === undefined ? entries : [...entries]
  })
  const bodyRows = createMemo<Row[]>(() => bodyEntries().map((e) => e.row))
  const materializedRows = (): Row[] =>
    withComputedFormulaCells(bodyRows(), leafColumns(), props.formulaTables)

  /** Map clipboard's effective-row projection back to the Core row source. */
  const reconcileClipboardRows = (
    sourceRows: readonly Row[],
    previousRows: readonly Row[],
    rows: readonly Row[],
  ): Row[] =>
    reconcileProjectedRows(sourceRows, previousRows, rows, {
      visibleRows: bodyRows(),
      getRowKey: rowId,
      getChildren:
        props.getSubRows !== undefined || props.lazyLoad !== undefined
          ? readRowChildren
          : undefined,
      setChildren: writeLazyChildren,
    })

  // ---- Selection ----
  // Row-selection logic (single/multi toggle, dedup, select-all) is single-sourced
  // in the core model; the table keeps only its row-id mapping + rendering. Keyed
  // by string|number because row ids may be either.
  const selectionMode = merged.selectable === 'single' ? 'single' : 'multiple'
  const { model: selectionModel, selection } = useGridSelection<Row, string | number>(gridCore, {
    mode: selectionMode,
    value: props.selection,
    defaultValue: props.defaultSelection,
    onChange: (keys) => merged.onSelectionChange?.(keys),
  })

  // Controlled: mirror the prop into the model without re-emitting onChange.
  // Preserve the last real uncontrolled snapshot across a rejected controlled
  // proposal; on an initially controlled bridge, the accepted prop is the
  // handoff snapshot instead.
  const selControlled = (): boolean => props.selection !== undefined
  let selectionWasControlled = selControlled()
  let hasUncontrolledSelection = !selectionWasControlled
  let uncontrolledSelection = [...selection()]
  let lastControlledSelection = [...(props.selection ?? [])]
  createEffect(() => {
    const current = selection()
    const controlled = selControlled()
    if (controlled) {
      lastControlledSelection = [...props.selection!]
      selectionModel.sync(props.selection!)
    } else if (selectionWasControlled) {
      selectionModel.sync(
        hasUncontrolledSelection ? uncontrolledSelection : lastControlledSelection,
      )
    } else {
      uncontrolledSelection = [...current]
      hasUncontrolledSelection = true
    }
    selectionWasControlled = controlled
  })

  // Controlled tables RENDER from the prop (true controlled semantics): a local
  // toggle emits onSelectionChange, but the displayed selection only changes when
  // the parent writes `selection` back — so a parent that validates/rejects a
  // change no longer sees the row flip optimistically. Uncontrolled renders from
  // the model store as before.
  const displaySelection = (): Array<string | number> => {
    const store = selection()
    if (selControlled()) return [...props.selection!]
    if (selectionWasControlled) {
      return [...(hasUncontrolledSelection ? uncontrolledSelection : lastControlledSelection)]
    }
    return [...store]
  }
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  const rebaseToProp = (): void => {
    if (selControlled()) selectionModel.sync(props.selection!)
  }

  const isSelected = (id: string | number): boolean => displaySelection().includes(id)

  const allRowIds = createMemo(() => bodyRows().map((r, i) => rowId(r, i)))
  const selectionFlags = createMemo(() => computeSelectionFlags(allRowIds(), displaySelection()))
  const allSelected = createMemo(() => selectionFlags().allSelected)
  const someSelected = createMemo(() => selectionFlags().someSelected)

  const toggleRow = (id: string | number): void => {
    if (merged.selectable === 'none') return
    rebaseToProp()
    selectionModel.toggle(id)
  }

  const toggleAll = (): void => {
    rebaseToProp()
    selectionModel.toggleAll(allRowIds())
  }

  // ---- Inline Editing (cell mode is Grid Core-owned) ----
  const cellEditing = useGridEditing<Row>(gridCore, {
    getRowKey: (row, index) => rowId(row, index),
    getRowIndex: (rowKey) => {
      const index = bodyRows().findIndex((row, rowIndex) => Object.is(rowId(row, rowIndex), rowKey))
      return index >= 0 ? index : undefined
    },
    getRules: (columnKey) => leafColumns().find((column) => column.key === columnKey)?.editRules,
    getValue: (row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      return column ? resolveTableCellValue(row, column) : row[columnKey]
    },
    setValue: (row, columnKey, value) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      const key = (column?.dataIndex ?? column?.key ?? columnKey) as keyof Row
      return { ...row, [key]: value }
    },
    coerce: (draft, row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      if (column?.editor !== 'number') return draft
      const text = String(draft ?? '')
      if (text === '' || Number.isNaN(Number(text))) {
        return column ? resolveTableCellValue(row, column) : draft
      }
      return Number(text)
    },
    validate: (value, row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      return column?.validate?.(value, row) ?? null
    },
    isEditable: (_row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      return Boolean(column && isEditableColumn(column))
    },
    onCommit: (commit) => {
      const column = leafColumns().find((candidate) => candidate.key === commit.columnKey)
      if (!column) return
      merged.onCellEdit?.({
        row: commit.row,
        column,
        oldValue: commit.oldValue,
        newValue: commit.value,
        rowIndex: commit.rowIndex,
      })
    },
  })
  const editingState = cellEditing.state
  const editingCellId = (): string | null => {
    const target = editingState().editing
    return target ? `${target.rowKey}::${target.columnKey}` : null
  }
  const editingColumnKey = (): string | null => editingState().editing?.columnKey ?? null
  const editingDraft = (): string => String(editingState().draft ?? '')
  const editError = (): string | null => editingState().error

  const beginEdit = (row: Row, column: IrisTableColumn<Row>, rowIdent: string | number): void => {
    if (!isEditableColumn(column)) return
    const current = resolveTableCellValue(row, column)
    cellEditing.startCellEdit(rowIdent, column.key, current == null ? '' : String(current))
  }

  const commitEdit = (_row: Row, _column: IrisTableColumn<Row>, _rowIndex: number): void => {
    cellEditing.commitCellEdit()
  }

  const cancelEdit = (): void => {
    cellEditing.cancelCellEdit()
  }

  function editPreviewText(row: Row, column: IrisTableColumn<Row>, draft: string): string {
    const raw =
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? resolveTableCellValue(row, column)
          : Number(draft)
        : draft
    const formatted = column.formatter?.(applyTableMask(raw, column), row)
    return String(formatted ?? '')
  }

  // ---- Row edit mode (vxe editConfig.mode='row' parity) -------------------
  // Core owns row-session lifetime, drafts, validation, switching, commits,
  // and stale async results. Solid keeps the existing editor/render contract
  // through the thin adapter projection; the callback below remains the one
  // rows transaction / undo / event write throat.
  const rowMode = (): boolean => merged.editConfig?.mode === 'row'
  const currentRowFor = (key: string | number): Row | undefined => gridRows.find(key)

  const rowEdit = createTableRowEditController<Row>({
    getColumns: () => leafColumns(),
    getRows: () => gridRows.get(),
    findRow: (key) => currentRowFor(key),
    getRowId: rowId,
    getCellValue: resolveTableCellValue,
    writeCellValue: ({ rowKey, row, column, rowIndex, oldValue, newValue }) => {
      // Row-mode sessions bypass the core editing feature, so write their
      // immutable replacement through the rows transaction for both local
      // and proxy tables. The transaction callback also records one undo
      // snapshot and keeps `dataIndex` separate from the display key.
      const valueKey = (column.dataIndex ?? column.key) as string
      const changed = gridRows.update(rowKey, { [valueKey]: newValue } as Partial<Row>, {
        reason: 'cell-edit',
      })
      if (changed) merged.onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
    },
  })
  const {
    rowEditing,
    rowSessions,
    rowEditorRefs,
    switchRowEdit,
    handleRowCellClick,
    commitRowSession,
    cancelRowEdit,
    focusRowEditor,
  } = rowEdit
  rowEditingState = rowEditing

  createEffect(() => {
    if (rowEditing() === null && pendingLocalRows !== null) schedulePendingLocalRows()
  })

  /** Tab between the row's editors: commit THAT column, focus the next
   *  editable one. Sync failure stays on the editor with the error. */
  const handleRowTab = (
    row: Row,
    col: IrisTableColumn<Row>,
    session: RowCellSession<Row>,
    rowIdent: string | number,
    dir: 1 | -1,
  ): void => {
    if (!commitRowSession(session, row, rowIdent)) return
    const cols = leafColumns()
    const start = cols.indexOf(col)
    for (let i = start + dir; i >= 0 && i < cols.length; i += dir) {
      const nextCol = cols[i]!
      if (!isEditableColumn(nextCol)) continue
      focusRowEditor(nextCol.key)
      return
    }
  }

  const tableDrag = createTableDrag<Row>({
    rowDrag: () => merged.rowDrag,
    columnDrag: () => merged.columnDrag,
    root: () => rootRef,
    rows: bodyRows,
    columns: leafColumns,
    rowId,
    columnOrderControlled: () => props.columnOrder !== undefined,
    setColumnOrder: (next) => columnsFeature.setOrder(next),
    grouped,
    commitReorderRows: (activeId, overId) => {
      const visibleRows = bodyRows()
      const projection = resolveRowDragProjection(visibleRows, activeId, overId, (row, index) =>
        rowId(row, index),
      )
      const {
        fromIndex: fromVisible,
        toIndex: toVisible,
        fromRow,
        toRow,
        fromKey,
        toKey,
      } = projection
      const modelFrom = fromKey === undefined ? undefined : gridRows.find(fromKey)
      const modelTo = toKey === undefined ? undefined : gridRows.find(toKey)
      // Prefer the rows model when the visible projection resolves to the
      // same source objects. Index-keyed/sorted projections retain the
      // projection-aware fallback below.
      if (
        fromKey !== undefined &&
        toKey !== undefined &&
        modelFrom === fromRow &&
        modelTo === toRow
      ) {
        const position = fromVisible < toVisible ? 'after' : 'before'
        if (gridRows.reorder(fromKey, toKey, { reason: 'row-drag', position })) {
          return gridRows.get()
        }
      }
      const getChildren =
        props.getSubRows !== undefined || props.lazyLoad !== undefined ? readRowChildren : undefined
      if (getChildren !== undefined) {
        // A tree must be reordered in the source tree. The visible
        // flattened list is only a drag projection and must never be
        // committed as roots. A cross-parent drop is rejected until a
        // re-parenting contract can describe the destination path.
        const visibleKeys = new Map(
          visibleRows.map((row, index) => [row, String(rowId(row, index))]),
        )
        if (fromVisible < 0 || toVisible < 0) return null
        const result = reorderTreeRows(
          gridRows.get(),
          activeId,
          overId,
          {
            // Every drop target is visible; leave hidden descendants keyless so
            // a synthetic sibling index cannot mask a visible target when no
            // rowKey is configured.
            getRowKey: (row) => visibleKeys.get(row),
            getChildren,
            setChildren: writeLazyChildren,
          },
          fromVisible < toVisible ? 'after' : 'before',
        )
        if (!result.changed || !gridRows.commit(result.rows, { reason: 'row-drag' })) return null
        return gridRows.get()
      }
      const source = bodyRows()
      const rows = reorderRowsInList(
        source,
        (row, index) => String(rowId(row, index)),
        activeId,
        overId,
      )
      if (rows === source || !gridRows.commit(rows, { reason: 'row-drag' })) return null
      return gridRows.get()
    },
    onDataChange: (rows) => {
      merged.onDataChange?.(rows)
    },
    commitRows: (rows) => {
      gridRows.commit(rows, { reason: 'row-drag' })
    },
  })
  const rowDragActive = tableDrag.rowActive
  const rowDragOver = tableDrag.rowOver
  const colDragActive = tableDrag.columnActive
  const colDragOver = tableDrag.columnOver
  const handleRowDragPointerDown = tableDrag.onRowPointerDown
  const handleRowDragPointerMove = tableDrag.onRowPointerMove
  const handleRowDragPointerUp = tableDrag.onRowPointerUp
  const handleRowDragPointerLeave = tableDrag.onRowPointerLeave
  const handleColDragPointerDown = tableDrag.onColumnPointerDown
  const handleColDragPointerMove = tableDrag.onColumnPointerMove
  const handleColDragPointerUp = tableDrag.onColumnPointerUp

  // ---- Right-click context menu (vxe contextMenu parity) ------------------
  // Transient state: items + params are computed ONCE per open from the
  // callback; the cursor coordinates live in a virtual floating anchor (a
  // fake element whose getBoundingClientRect returns the zero-size cursor
  // rect). Each open builds a FRESH anchor object, so the positioning effect
  // re-runs on the new identity (no remount token needed).
  const [contextMenuState, setContextMenuState] = createSignal<{
    open: boolean
    items: IrisTableContextMenuItem[]
    params: IrisTableContextMenuParams<Row>
  } | null>(null)
  const [contextAnchor, setContextAnchor] = createSignal<HTMLElement | null>(null)
  const closeContextMenu = (): void => {
    setContextMenuState((prev) => (prev ? { ...prev, open: false } : prev))
  }

  // ---- Column header pin menu (iris-only, independent of contextMenu) -----
  // Like the body menu, this is a cursor-anchored instance of the existing
  // floating menu. The current pin is read at render and at commit through
  // pinOf, so controlled rejection never gets an optimistic visual update.
  const [pinMenuState, setPinMenuState] = createSignal<{
    open: boolean
    col: IrisTableColumn<Row>
  } | null>(null)
  const [pinMenuAnchor, setPinMenuAnchor] = createSignal<HTMLElement | null>(null)
  const closePinMenu = (): void => {
    setPinMenuState((prev) => (prev ? { ...prev, open: false } : prev))
  }
  const handleHeaderContextMenu = (event: MouseEvent, col: IrisTableColumn<Row>): void => {
    if (merged.columnPinMenu !== true) return
    event.preventDefault()
    event.stopPropagation()
    closeContextMenu()
    const virtualAnchor = {
      getBoundingClientRect: () => ({
        left: event.clientX,
        top: event.clientY,
        right: event.clientX,
        bottom: event.clientY,
        width: 0,
        height: 0,
        x: event.clientX,
        y: event.clientY,
        toJSON() {},
      }),
    } as unknown as HTMLElement
    setPinMenuAnchor(virtualAnchor)
    setPinMenuState({ open: true, col })
  }

  // ---- Header filter panel (vxe filterConfig parity) ----------------------
  // One panel at a time, keyed by the column whose trigger was clicked. The
  // anchor is the trigger BUTTON itself (a real DOM node), captured at click
  // time. The panel renders inside a keyed Show on the state object identity,
  // so each open remounts it and the draft checkbox state re-seeds from the
  // applied `filterValues`.
  const [filterPanelState, setFilterPanelState] = createSignal<{
    open: boolean
    colKey: string
  } | null>(null)
  const [filterAnchor, setFilterAnchor] = createSignal<HTMLButtonElement | null>(null)
  const closeFilterPanel = (): void => {
    setFilterPanelState((prev) => (prev ? { ...prev, open: false } : prev))
  }
  const openFilterPanel = (e: MouseEvent, colKey: string): void => {
    // Never let the trigger click reach the header cell (which would sort).
    e.stopPropagation()
    setFilterAnchor(e.currentTarget as HTMLButtonElement)
    setFilterPanelState({ open: true, colKey })
  }
  const applyFilterValues = (colKey: string, values: string[]): void => {
    filtering.model.setFilterValues({ ...effectiveFilterValues(), [colKey]: values })
  }
  const clearFilterValues = (colKey: string): void => {
    filtering.model.clearColumnFilterValues(colKey)
  }

  const handleContextMenu = (
    e: MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    idx: number,
    ci: number,
  ): void => {
    if (!merged.contextMenu) return
    closePinMenu()
    e.preventDefault()
    // Virtual anchor: zero-size rect at the cursor. The object is rebuilt per
    // open (capturing this event's coordinates) so the panel always lands at
    // the cursor.
    const virtualAnchor = {
      getBoundingClientRect: () => ({
        left: e.clientX,
        top: e.clientY,
        right: e.clientX,
        bottom: e.clientY,
        width: 0,
        height: 0,
        x: e.clientX,
        y: e.clientY,
        toJSON() {},
      }),
    } as unknown as HTMLElement
    setContextAnchor(virtualAnchor)
    const params: IrisTableContextMenuParams<Row> = {
      row,
      column: col,
      rowIndex: idx,
      columnIndex: ci,
    }
    setContextMenuState({ open: true, items: merged.contextMenu!.items(params), params })
  }

  const renderFilterTrigger = (col: IrisTableColumn<Row>, leaf: boolean): JSX.Element => (
    <TableFilterTrigger
      column={col}
      leaf={leaf}
      active={(effectiveFilterValues()[col.key]?.length ?? 0) > 0}
      open={filterPanelState()?.open === true && filterPanelState()?.colKey === col.key}
      label={t('table.filter')}
      onOpen={(event) => openFilterPanel(event, col.key)}
    />
  )

  let rootRef: HTMLDivElement | undefined
  const rowTarget = createTableRowTarget(() => rootRef)
  const { scrollTo: scrollToRow, goTo: goToRow } = rowTarget
  onCleanup(rowTarget.dispose)

  // Built-in row-list undo/redo. Ordinary user mutations are observed at the
  // Grid Rows transaction throat above; replay and explicit commits use this
  // guarded funnel so an undo/redo never records itself as a fresh step.
  const setTableRows = (rows: Row[]): void => {
    suppressUndoRecord = true
    try {
      gridRows.commit(rows)
    } finally {
      suppressUndoRecord = false
    }
  }
  const undoController = createTableUndoController(
    () => merged.undo === true,
    () => baseData(),
    () => (hasProxy() ? proxyState().data : (props.data ?? [])),
    setTableRows,
    (rows) => merged.onDataChange?.(rows),
    () => rootRef,
    () => editingCellId() !== null || rowEditing() !== null,
    {
      current: displaySelection,
      enabled: () => merged.selectable !== 'none',
      keyOf: rowId,
      rebase: rebaseToProp,
      set: (keys) => selectionModel.set(keys),
    },
  )
  recordUndoRows = undoController.record

  const tableHandle = {
    loadData: (rows: Row[]): void => {
      gridRows.loadData(rows)
      merged.onDataChange?.(rows)
    },
    reloadData: (): void => {
      if (proxy) {
        setLocalRows(null)
        void proxy.refetch()
      }
    },
    commitProxy: (overrides: Partial<import('./types').IrisTableProxyQueryParams>): void => {
      proxy?.setParams(overrides)
    },
    getProxyInfo: (): { page: number; pageSize: number; total: number } | null => {
      const s = proxy?.getState()
      return s ? { page: s.params.page, pageSize: s.params.pageSize, total: s.total } : null
    },
    clearSort: (): void => {
      if (merged.multiSort) setMultiSort([])
      else setSort(null)
    },
    clearFilter: (): void => {
      filtering.model.clear()
    },
    removeRows: (keys: Array<string | number>): void => {
      const removedKeys = gridRows.removeMany(keys)
      if (removedKeys.length === 0) return
      const rows = gridRows.get()
      const selectedNow = selection()
      const removed = new Set(removedKeys)
      const nextSelection = selectedNow.filter((key) => !removed.has(key))
      if (nextSelection.length !== selectedNow.length) {
        if (selControlled()) selectionModel.sync(props.selection ?? [])
        selectionModel.set(nextSelection)
      }
      merged.onDataChange?.(rows)
    },
    getFilteredData: (): Row[] => [...bodyRows()],
    exportCurrentViewCsv: (): string => serializeTableCsv(materializedRows(), leafColumns()),
    exportMultiCsv: (): string => {
      const current = serializeTableCsv(materializedRows(), leafColumns())
      const names = props.exportNames
      if (!names || names.length === 0) return current
      const segments = [`# current${current ? `\n${current}` : ''}`]
      for (const entry of names) {
        if (!entry.key) continue
        const refCsv = toCsvRows(entry.ref())
        segments.push(`# ${entry.key}${refCsv ? `\n${refCsv}` : ''}`)
      }
      return segments.join('\n\n')
    },
    compareStates,
    scrollToRow,
    goToRow,
  }
  onMount(() => {
    if (props.tableRef) props.tableRef.current = tableHandle
  })

  const [focusedCell, setFocusedCell] = createSignal<{ row: number; col: number } | null>(null)
  const GRID_NAV_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ])
  const handleGridKey = (e: KeyboardEvent): void => {
    if (!merged.keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    // Only navigate from a grid cell — never hijack arrows inside an editing
    // cell's <input> (which carries no data-grid-row).
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell() ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyRows().length,
      colCount: leafColumns().length,
      pageSize: 10,
    })
    setFocusedCell(next)
    const cell = rootRef?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }
  const { model: cellRangeCtrl, range: activeCellRange } = useGridRange(gridCore)
  const { serialize: serializeGridRange, paste: pasteGridRange } = useGridClipboard<Row>(gridCore, {
    getRows: bodyRows,
    getColumns: () => leafColumns(),
    rowKeyField: merged.rowKey,
    resolveValue: (row, column) => resolveTableCellValue(row, column as IrisTableColumn<Row>),
    setValue: (row, column, value) => ({
      ...row,
      [(column.dataIndex ?? column.key) as string]: value,
    }),
    isCellEditable: (_row, column) => !(column as IrisTableColumn<Row>).formula,
    reconcileRows: reconcileClipboardRows,
    onPaste: (change) => merged.onDataChange?.([...change.rows]),
  })

  const isInRange = (row: number, col: number): boolean => {
    // Keep the reactive range accessor as a dependency; containment itself is
    // delegated to the Core controller.
    activeCellRange()
    return cellRangeCtrl.isInRange(row, col)
  }
  const handleCellRangeKey = (e: KeyboardEvent): void => {
    if (!merged.cellRange) return
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    if (!e.shiftKey || !ARROW_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    const rowAttr = target.dataset.irisCellRow
    const colAttr = target.dataset.irisCellCol
    if (rowAttr === undefined || colAttr === undefined) return
    e.preventDefault()
    const state = cellRangeCtrl.getState()
    const fallback = { row: Number(rowAttr), col: Number(colAttr) }
    const current = state.anchor ? (state.active ?? fallback) : fallback
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyRows().length,
      colCount: leafColumns().length,
    })
    cellRangeCtrl.extendRange(next.row, next.col)
  }

  const copyActiveRange = (): void => {
    const range = activeCellRange()
    if (!range || merged.clipConfig?.copy === false) return
    const text = serializeGridRange(
      merged.clipConfig?.copyFormat,
      merged.clipConfig?.copyWithFormat === true,
    )
    if (text !== null) void writeClipboardText(text)
  }
  const pasteActiveRange = (range: {
    start: { row: number; col: number }
    end: { row: number; col: number }
  }): void => {
    void readClipboardText().then((text) => {
      if (text !== null) pasteGridRange(text, range)
    })
  }
  const handleClipboardKey = (e: KeyboardEvent): void => {
    if (!merged.cellRange || !merged.clipConfig || e.defaultPrevented) return
    if (!e.ctrlKey && !e.metaKey) return
    const key = e.key.toLowerCase()
    const range = activeCellRange()
    if (!range) return
    if (key === 'c') {
      if (merged.clipConfig.copy === false) return
      e.preventDefault()
      copyActiveRange()
    } else if (key === 'v') {
      if (merged.clipConfig.paste === false) return
      e.preventDefault()
      pasteActiveRange(range)
    }
  }

  const gridTemplate = createTableGridTemplate({
    leafColumns,
    widths: effectiveWidths,
    rowDrag: () => Boolean(merged.rowDrag),
    seq: () => Boolean(merged.seq),
    hasDetail,
    selectable: () => merged.selectable !== 'none',
    isCollapsed: columnFade.isCollapsed,
  })

  // ---- Column virtualization (opt-in via `columnVirtualization`) ----
  // Render only the horizontally-visible columns (+ pinned + overscan) for very
  // wide tables. The root becomes a horizontal scroll container; off-screen grid
  // tracks stay sized via `gridTemplateColumns`, and each rendered cell is placed
  // on its 1-based grid track (`colTrack`) so it lands correctly even when
  // earlier cells are skipped. Off by default → `visibleColSet()` is null and
  // every column renders unchanged.
  const [scrollLeft, setScrollLeft] = createSignal(0)
  const [viewportWidth, setViewportWidth] = createSignal(0)

  // 1-based grid track for a column index, after the optional drag + seq +
  // detail + selection tracks, so a windowed cell lands in the right place.
  const leadingTrackCount = (): number =>
    countLeadingGridTracks({
      rowDrag: Boolean(merged.rowDrag),
      sequence: merged.seq,
      detail: hasDetail(),
      selection: merged.selectable !== 'none',
    })
  const colTrack = (i: number): number => columnGridTrack(i, leadingTrackCount())

  onMount(() => {
    createEffect(() => ensureTableStyles(merged.columnFade === true))
  })
  onMount(() => {
    if (!merged.responsive || !rootRef) return
    const el = rootRef
    const measure = (): void => {
      setResponsiveWidth(el.clientWidth)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })
  onMount(() => {
    if (!merged.columnVirtualization || !rootRef) return
    const el = rootRef
    const measure = (): void => {
      setViewportWidth(el.clientWidth)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  // Set of column indices to render: the visible window + overscan, always
  // unioned with pinned columns. `null` ⇒ render every column (feature off).
  const visibleColSet = createMemo<Set<number> | null>(() => {
    const cols = leafColumns()
    return computeVisibleColumnIndices(Boolean(merged.columnVirtualization), {
      columns: cols,
      scrollOffset: scrollLeft(),
      viewportSize: viewportWidth(),
      itemSize: (column) => widthOf(column),
      isAlwaysVisible: (column) =>
        pinOf(column) !== null || columnFade.fadeByLeaf()[column.key] !== undefined,
    })
  })

  // Active sort info for a column: multi mode reads the click-order list,
  // single mode the single-column state.
  const sortInfo = (
    col: IrisTableColumn<Row>,
  ): { isActive: boolean; dir: 'asc' | 'desc' | null; multiIndex: number } => {
    const info = resolveTableSortInfo(col.key, {
      multiSort: merged.multiSort,
      multiSortState: multiSortState(),
      sort: effectiveSort(),
    })
    return { isActive: info.isActive, dir: info.direction, multiIndex: info.multiIndex }
  }
  const sortAria = (col: IrisTableColumn<Row>): 'none' | 'ascending' | 'descending' | undefined => {
    const { isActive, dir } = sortInfo(col)
    if (!isActive) return col.sortable ? 'none' : undefined
    return dir === 'asc' ? 'ascending' : 'descending'
  }
  const sortIndicator = (col: IrisTableColumn<Row>): JSX.Element => {
    if (!col.sortable) return <></>
    const { isActive, dir, multiIndex: multiIdx } = sortInfo(col)
    return (
      <>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            'flex-direction': 'column',
            'margin-inline-start': '4px',
            'line-height': '0.6',
            'font-size': 'var(--iris-font-size-xs, 12px)',
            color: isActive ? 'var(--iris-primary)' : 'var(--iris-muted)',
          }}
        >
          <span style={{ opacity: dir === 'asc' ? '1' : '0.45' }}>▲</span>
          <span style={{ opacity: dir === 'desc' ? '1' : '0.45' }}>▼</span>
        </span>
        {/* Multi mode: non-primary sort columns show their click-order
            sequence number (vxe sort-config sequence parity). */}
        <Show when={merged.multiSort && multiIdx > 0}>
          <span
            data-iris-sort-seq=""
            style={{
              'margin-inline-start': 'var(--iris-space-xxs, 4px)',
              'font-size': 'var(--iris-font-size-xs, 12px)',
              color: 'var(--iris-muted)',
            }}
          >
            {multiIdx + 1}
          </span>
        </Show>
      </>
    )
  }

  const seqStartIndex = props.seqStartIndex ?? 1
  const seqValue = (index: number): string | number => {
    if (props.seqMethod) return props.seqMethod({ rowIndex: index, columnIndex: 0 })
    if (proxy && props.proxyConfig?.seq && merged.seq) {
      return (proxyState().params.page - 1) * proxyState().params.pageSize + index + 1
    }
    return index + seqStartIndex
  }
  // Span bookkeeping (vxe spanMethod parity): a per-pass occupied set rebuilt
  // whenever bodyEntries gets a fresh reference (a new render pass), so Solid's
  // <For> — which re-runs callbacks only for new entry identities — never
  // accumulates stale coverage across passes. The rebuild is also keyed on the
  // spanMethod identity: swapping the callback to a different function without
  // a data change (same bodyEntries reference) must drop coverage left by the
  // previous function, or cells it covered stay blank under the new one.
  const spanOccupy = new Set<string>()
  let spanRowsRef: Array<{ row: Row; meta: TreeRow<Row> | null }> | undefined
  let spanMethodRef: NonNullable<IrisTableProps<Row>['spanMethod']> | undefined
  const spanPass = (): void => {
    if (props.spanMethod === undefined) return
    const entries = bodyEntries()
    if (spanRowsRef !== entries || spanMethodRef !== props.spanMethod) {
      spanOccupy.clear()
      spanRowsRef = entries
      spanMethodRef = props.spanMethod
    }
  }

  const stateRowStyle: JSX.CSSProperties = {
    padding: '32px 12px',
    'text-align': 'center',
    color: 'var(--iris-muted)',
  }

  // Tree mode is opt-in via getSubRows. The virtual-scroll path windows flat AND
  // tree rows (uniform height) — only variable-height detail panels bar it, hence
  // the `!hasDetail()` guard below.
  const treeMode = (): boolean => props.getSubRows !== undefined || props.lazyLoad !== undefined

  const resolveLiveRow = (id: string | number, fallback: Row): Row => {
    liveRevision()
    return (
      gridRows.find(id) ??
      liveRowsRef.find((candidate, candidateIndex) => rowId(candidate, candidateIndex) === id) ??
      fallback
    )
  }
  const loadLazyChildren = (row: Row, treeMeta: TreeRow<Row>): void => {
    const key = treeMeta.key
    if (lazyLoading().has(key) || props.lazyLoad === undefined) return
    setLazyLoading((prev) => new Set(prev).add(key))
    const clearLoading = (): void => {
      setLazyLoading((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
    try {
      const epoch = lazyEpoch
      props.lazyLoad(row, (children) => {
        if (epoch !== lazyEpoch) return
        const lazyKey = rowId(row, Math.max(0, treeMeta.posInset - 1))
        suppressUndoRecord = true
        let committed = false
        try {
          committed = gridRows.setChildren(lazyKey, children, {
            reason: 'lazy-load',
          })
        } finally {
          suppressUndoRecord = false
        }
        if (committed && children && children.length > 0) {
          expansion.toggle(key)
        }
        clearLoading()
      })
    } catch {
      clearLoading()
    }
  }
  const resolveCellColspan = (
    rowIndex: number,
    colIndex: number,
    inWindow: boolean,
  ): number | null => {
    if (props.spanMethod === undefined || !inWindow) return 1
    const span = resolveGridSpan(spanOccupy, rowIndex, colIndex, props.spanMethod)
    return span === null ? null : span.colspan
  }

  // Single source of truth for a body row's main `<div>`. The non-virtual body
  // wraps it with a detail panel; the virtual scroller renders it directly,
  // passing the per-row tree meta (`flatTree()[idx]`) at the scroller's absolute
  // index so indent + toggle render for windowed tree rows too.
  const renderRow = createTableBodyRowRenderer<Row>({
    t,
    table: merged,
    live: {
      rowId,
      resolveRow: resolveLiveRow,
    },
    gridTemplate,
    hasDetail,
    leafColumns,
    rowMode,
    beforeRender: spanPass,
    selection: {
      isSelected,
      toggleRow,
    },
    expansion: {
      keys: expandedKeys,
      toggle: (key) => expansion.toggle(key),
      isRowExpandable,
    },
    drag: {
      active: rowDragActive,
      over: rowDragOver,
      onPointerDown: handleRowDragPointerDown,
    },
    focus: {
      focusedCell,
      setFocusedCell,
    },
    range: {
      isInRange,
      start: (row, col) => cellRangeCtrl.startRange(row, col),
      extend: (row, col) => cellRangeCtrl.extendRange(row, col),
    },
    cells: {
      visibleColSet,
      resolveValue: resolveTableCellValue,
      resolveColspan: resolveCellColspan,
      colTrack,
      pinOf,
      pinnedStyle,
      columnFade,
    },
    tree: {
      lazy: lazyTree,
      hasLoadedChildren: hasLazyChildren,
      loading: lazyLoading,
      loadChildren: loadLazyChildren,
    },
    editing: {
      rowEditing,
      rowSessions,
      rowEditorRefs,
      cellId: editingCellId,
      columnKey: editingColumnKey,
      draft: editingDraft,
      error: editError,
      setCellDraft: (value) => cellEditing.setCellDraft(value),
      beginEdit,
      commitEdit,
      cancelEdit,
      editPreviewText,
      handleRowCellClick,
      switchRowEdit,
      commitRowSession,
      cancelRowEdit,
      handleRowTab,
    },
    seqValue,
    onContextMenu: handleContextMenu,
  })

  return (
    <>
      <TableTabs
        tabs={merged.tableTabs}
        activeKey={tableViews.activeTab}
        onApply={tableViews.applyTableTab}
      />
      <TableViews
        config={merged.views}
        views={tableViews.viewList}
        activeKey={tableViews.activeViewKey}
        onSelect={tableViews.selectView}
        onSave={tableViews.saveView}
        onDelete={tableViews.deleteView}
      />
      <TableForm
        config={merged.formConfig}
        draft={formDraft}
        setValue={setFormValue}
        onSubmit={handleFormSubmit}
        onReset={handleFormReset}
        t={t}
      />

      <TableToolbar
        toolbar={merged.toolbar}
        selectable={merged.selectable}
        selection={displaySelection}
        refresh={() => {
          if (proxy) void proxy.refetch()
        }}
        t={t}
        importPreview={merged.importPreview}
        densityToggle={merged.densityToggle}
        effectiveDensity={effectiveDensity}
        onDensityToggle={cycleDensity}
        undo={merged.undo}
        canUndo={undoController.canUndo}
        canRedo={undoController.canRedo}
        onUndo={undoController.undo}
        onRedo={undoController.redo}
      />

      <div
        ref={rootRef}
        // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
        // grid/table role as before (treegrid implies managed cell focus).
        role={merged.keyboardNavigation ? (treeMode() ? 'treegrid' : 'grid') : 'table'}
        data-iris-table=""
        data-iris-column-fade-active={columnFade.columnFadeActive() ? 'true' : undefined}
        data-density={effectiveDensity()}
        data-printable={merged.printable ? 'true' : undefined}
        data-column-virtualized={merged.columnVirtualization ? 'true' : undefined}
        onKeyDown={
          merged.keyboardNavigation || merged.cellRange || merged.clipConfig
            ? (e: KeyboardEvent) => {
                if (merged.keyboardNavigation) handleGridKey(e)
                if (merged.cellRange) handleCellRangeKey(e)
                handleClipboardKey(e)
              }
            : undefined
        }
        onPointerMove={
          merged.rowDrag || merged.columnDrag
            ? (e: PointerEvent) => {
                handleRowDragPointerMove(e)
                handleColDragPointerMove(e)
              }
            : undefined
        }
        onPointerUp={
          merged.rowDrag || merged.columnDrag
            ? () => {
                handleRowDragPointerUp()
                handleColDragPointerUp()
              }
            : undefined
        }
        onPointerLeave={merged.rowDrag ? handleRowDragPointerLeave : undefined}
        onScroll={
          merged.columnVirtualization
            ? (e: Event) => setScrollLeft((e.currentTarget as HTMLElement).scrollLeft)
            : undefined
        }
        style={{
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          // React parity (batch AF): the root pins the base table font so
          // inherited contexts (seq/expand/drag/selection cells + headers)
          // render md like React instead of the page's body size.
          'font-size': 'var(--iris-font-size-md, 14px)',
          border: merged.bordered ? '1px solid var(--iris-border)' : 'none',
          'border-radius': 'var(--iris-radius-md)',
          // Column virtualization and responsive overflow turn the table into
          // a horizontal scroll container.
          overflow: merged.columnVirtualization || responsiveOverflow() ? 'auto' : 'hidden',
          ...(responsiveOverflow() ? { 'overflow-x': 'auto' } : {}),
          ...(merged.style ?? {}),
        }}
      >
        <Show when={merged.clipConfig && merged.clipConfig.copy !== false && activeCellRange()}>
          <button type="button" data-iris-table-range-copy="" onClick={copyActiveRange}>
            {t('table.range.copy')}
          </button>
        </Show>
        <TableGroupedHeader
          grouped={grouped}
          matrix={headerMatrix}
          gridTemplate={gridTemplate}
          rowDrag={merged.rowDrag}
          seq={merged.seq}
          hasDetail={hasDetail}
          selectable={merged.selectable}
          selection={props.selection}
          allSelected={allSelected}
          someSelected={someSelected}
          toggleAll={toggleAll}
          t={t}
          columnDrag={merged.columnDrag}
          columnDragActive={colDragActive}
          columnDragOver={colDragOver}
          handleColumnDragPointerDown={handleColDragPointerDown}
          handleHeaderClick={handleHeaderClick}
          columnPinMenu={merged.columnPinMenu}
          handleHeaderContextMenu={handleHeaderContextMenu}
          sortAria={sortAria}
          sortIndicator={sortIndicator}
          renderFilterTrigger={renderFilterTrigger}
          columnFade={columnFade}
          pinOf={pinOf}
          pinnedStyle={pinnedStyle}
          pinnedDrag={merged.pinnedDrag}
          pinnedBoundaryKey={pinnedBoundaryKey}
          resolvePinnedCount={resolvePinnedCount}
          commitPinnedCount={commitPinnedCount}
        />

        <TableFlatHeader
          grouped={grouped}
          columns={displayColumns}
          gridTemplate={gridTemplate}
          rowDrag={merged.rowDrag}
          seq={merged.seq}
          hasDetail={hasDetail}
          selectable={merged.selectable}
          selection={props.selection}
          allSelected={allSelected}
          someSelected={someSelected}
          toggleAll={toggleAll}
          t={t}
          visibleColSet={visibleColSet}
          colTrack={colTrack}
          columnDrag={merged.columnDrag}
          columnDragActive={colDragActive}
          columnDragOver={colDragOver}
          handleColumnDragPointerDown={handleColDragPointerDown}
          handleHeaderClick={handleHeaderClick}
          columnPinMenu={merged.columnPinMenu}
          handleHeaderContextMenu={handleHeaderContextMenu}
          sortAria={sortAria}
          sortIndicator={sortIndicator}
          renderFilterTrigger={renderFilterTrigger}
          columnFade={columnFade}
          pinOf={pinOf}
          pinnedStyle={pinnedStyle}
          pinnedDrag={merged.pinnedDrag}
          pinnedBoundaryKey={pinnedBoundaryKey}
          resolvePinnedCount={resolvePinnedCount}
          commitPinnedCount={commitPinnedCount}
          resizableColumns={merged.resizableColumns}
          widthOf={widthOf}
          minWidth={(col) => col.minWidth ?? DEFAULT_COLUMN_MIN_WIDTH}
          maxWidth={(col) => col.maxWidth ?? Infinity}
          setColumnWidths={setColumnWidths}
          effectiveWidths={effectiveWidths}
        />

        {/* Body */}
        <Show
          when={!tableError() && !tableLoading()}
          fallback={
            <Show
              when={tableError()}
              fallback={
                <div
                  role="row"
                  aria-busy="true"
                  data-iris-table-row="loading"
                  style={stateRowStyle}
                >
                  {props.loadingState ?? t('table.loading')}
                </div>
              }
            >
              <div role="row" data-iris-table-row="error" style={stateRowStyle}>
                <span
                  style={{
                    'margin-inline-end': props.onRetry ? 'var(--iris-space-sm, 12px)' : '0px',
                  }}
                >
                  {props.errorState ?? t('table.error')}
                </span>
                <Show when={props.onRetry || hasProxy()}>
                  <button
                    type="button"
                    data-iris-table-retry=""
                    onClick={() => {
                      // Proxy mode: the built-in retry re-queries (vxe parity).
                      if (proxy) void proxy.refetch()
                      props.onRetry?.()
                    }}
                    style={{
                      border: '1px solid var(--iris-border)',
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      'border-radius': 'var(--iris-radius-sm, 4px)',
                      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                      'font-size': 'var(--iris-font-size-sm, 13px)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('table.retry')}
                  </button>
                </Show>
              </div>
            </Show>
          }
        >
          <Show
            when={bodyRows().length > 0}
            fallback={
              <div role="row" data-iris-table-row="empty" style={stateRowStyle}>
                {props.emptyState ?? t('table.empty')}
              </div>
            }
          >
            <Show
              when={merged.virtualScroll && (!treeMode() || !hasDetail())}
              fallback={
                <div role="rowgroup" data-iris-table-body="">
                  <For each={bodyEntries()}>
                    {(entry, indexAccessor) => {
                      const row = entry.row
                      const treeMeta = entry.meta
                      const index = indexAccessor()
                      const id = rowId(row, index)
                      const expanded = (): boolean => expandedKeys().includes(String(id))
                      const expandable = (): boolean => isRowExpandable(row, index)
                      return (
                        <>
                          {renderRow(row, index, treeMeta)}
                          {/* Full-width detail panel beneath an expanded, expandable
                            row (spans all grid tracks). Only in the non-virtual path. */}
                          <Show when={hasDetail() && expandable() && expanded()}>
                            <div
                              role="row"
                              data-iris-table-row-detail={String(id)}
                              style={{
                                display: 'grid',
                                'grid-template-columns': gridTemplate(),
                              }}
                            >
                              <div
                                role="cell"
                                data-iris-table-detail-cell=""
                                style={{
                                  'grid-column': '1 / -1',
                                  padding: '8px 12px',
                                  'border-bottom': '1px solid var(--iris-border)',
                                }}
                              >
                                {props.renderDetail!(row, index)}
                              </div>
                            </div>
                          </Show>
                        </>
                      )
                    }}
                  </For>
                </div>
              }
            >
              {/* Virtualize flat mode, and tree mode too — tree rows are uniform
                height, so the only thing that bars it is variable-height detail
                panels, hence the `!hasDetail()` guard. `bodyRows()` is the flattened
                visible rows (= sortedRows() in flat mode); `flatTree()?.[idx]`
                supplies each row's tree meta (depth + toggle), with `idx` the
                absolute row index the scroller passes its render callback. */}
              <IrisVirtualScroll
                items={bodyRows()}
                itemHeight={merged.virtualScroll!.itemHeight}
                height={merged.virtualScroll!.height}
                buffer={merged.virtualScroll!.buffer}
                keyOf={(row, idx) => rowId(row, idx)}
                renderItem={(row, idx) => renderRow(row, idx, flatTree()?.[idx] ?? null)}
              />
            </Show>
          </Show>
        </Show>

        {/* Summary / footer row stays in a dedicated renderer so its leading
          tracks cannot drift from the body grid. */}
        <Show when={!tableError() && !tableLoading()}>
          <TableSummary
            bodyRows={bodyRows}
            leafColumns={leafColumns}
            visibleColSet={visibleColSet}
            gridTemplate={gridTemplate}
            colTrack={colTrack}
            getCellValue={resolveTableCellValue}
            pinOf={pinOf}
            pinnedStyle={pinnedStyle}
            rowDrag={merged.rowDrag}
            seq={merged.seq}
            hasDetail={hasDetail}
            selectable={merged.selectable}
            columnFade={columnFade}
          />
        </Show>

        <TablePager
          enabled={hasProxy}
          config={merged.pagerConfig}
          state={proxyState}
          setParams={(partial) => {
            proxy?.setParams(partial)
          }}
          onPageChange={props.proxyConfig?.onPageChange}
          t={t}
        />
        <TableScrollTop
          root={() => rootRef}
          enabled={() => merged.scrollToTop === true && !merged.printable}
          hasVirtual={() => merged.virtualScroll !== undefined}
          rows={() => bodyRows().length}
          loading={() => tableLoading()}
          error={() => tableError()}
        />
      </div>

      <Show when={merged.responsive && responsiveOverflow() && !merged.printable}>
        <div
          data-iris-scroll-hint=""
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: 'var(--iris-space-xxs, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            color: 'var(--iris-muted)',
            background: 'var(--iris-surface)',
            'border-inline': '1px solid var(--iris-border)',
            'border-bottom': '1px solid var(--iris-border)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
          }}
        >
          <span aria-hidden="true">⇆</span>
          <span>{t('table.scrollHint')}</span>
        </div>
      </Show>

      {/* Right-click context menu (vxe contextMenu parity): portaled to body,
        positioned at the cursor via the virtual anchor. */}
      <Show when={contextMenuState()}>
        {(state) => (
          <TableOverlayContextMenu
            open={state().open}
            anchor={contextAnchor}
            items={state().items}
            params={state().params}
            onSelect={(key, params) => merged.contextMenu?.onSelect(key, params)}
            onClose={closeContextMenu}
          />
        )}
      </Show>

      {/* Column header pin menu: an independent instance of the existing
        cursor-anchored context-menu surface. */}
      <Show when={merged.columnPinMenu === true && pinMenuState()}>
        {(state) => (
          <TableOverlayContextMenu
            open={state().open}
            anchor={pinMenuAnchor}
            items={
              pinOf(state().col) === null
                ? [{ key: PIN_LEFT_MENU_KEY, label: t('table.pinLeft') }]
                : [{ key: UNPIN_MENU_KEY, label: t('table.unpin') }]
            }
            params={{
              row: undefined as unknown as Row,
              column: state().col,
              rowIndex: -1,
              columnIndex: leafColumns().findIndex((column) => column.key === state().col.key),
            }}
            onSelect={(key) => {
              const column = state().col
              const current = pinOf(column)
              if (key === PIN_LEFT_MENU_KEY && current === null) {
                setColumnPinned(column.key, 'left')
              } else if (key === UNPIN_MENU_KEY && current !== null) {
                setColumnPinned(column.key, null)
              }
            }}
            onClose={closePinMenu}
          />
        )}
      </Show>

      {/* Header filter panel (vxe filterConfig parity): keyed Show on the
        state object identity → each open remounts the panel so its draft
        checkbox state re-seeds from the applied filterValues. */}
      <Show when={filterPanelState()}>
        {(state) => {
          const fcol = displayColumns().find((c) => c.key === state().colKey)
          if (!fcol || !fcol.filterable) return null
          return (
            <TableOverlayFilterPanel
              open={state().open}
              anchor={filterAnchor}
              columnKey={fcol.key}
              options={fcol.filterOptions ?? []}
              initialChecked={effectiveFilterValues()[fcol.key] ?? []}
              onApply={applyFilterValues}
              onClear={clearFilterValues}
              onClose={closeFilterPanel}
              t={t}
            />
          )
        }}
      </Show>
    </>
  )
}
