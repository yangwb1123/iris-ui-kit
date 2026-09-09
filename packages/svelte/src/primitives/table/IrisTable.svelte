<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import {
    applyColumnOrder,
    applyDetectedColumnDefaults,
    buildHeaderMatrix,
    computeGridSpanPlan,
    compareStates,
    createTableMultiSortComparator,
    createTableSortComparator,
    sortTableRows,
    computePinnedColumnOffsets,
    computeResponsiveColumnLayout,
    computeVisibleColumnIndices,
    resolveColumnWidth,
    createRemoteTableSource,
    detectColumnType,
    flattenLeafColumns,
    projectTableBodyRows,
    mergeFormFilters,
    reconcileProjectedRows,
    reorderRowsInList,
    resolveRowDragProjection,
    resolveTableRowKey,
    reorderTreeRows,
    toCsvRows,
    withSortedChildren,
    type DetectedColumnType,
    type GridSpanPlan,
    type RemoteTableSource,
    type RemoteTableSourceState,
    type TableBodyRowView,
    type TreeRow,
  } from '@iris-ui-kit/core'
  import { useI18n } from '../../i18n'
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
    type UseGridFilteringOptions,
    type UseGridSelectionOptions,
    useGridSorting,
    type UseGridSortingOptions,
  } from '../../grid'
  import { useDrag } from '../drag/useDrag.svelte'
  import type { IrisTableProps } from './props'
  import TablePresentation from './TablePresentation.svelte'
  import { readClipboardText } from './table-clipboard'
  import { createTableColumnFade } from './table-column-fade.svelte'
  import { createTableDragBridge } from './table-drag'
  import { createTableFilterController } from './table-filter.svelte'
  import { createTableFormController } from './table-form.svelte'
  import { buildTableGridTemplate } from './table-grid.svelte'
  import { createTableHandle } from './table-handle'
  import { createTableKeyboard } from './table-keyboard'
  import { createTablePersistController } from './table-persist.svelte'
  import { captureTablePersistSnapshot, restoreTablePersistPiece } from './table-persist-helpers'
  import { createPinnedDragMath } from './table-pinned-drag'
  import { createTableRowEditController } from './table-row-edit.svelte'
  import { createTableSelectionController } from './table-selection.svelte'
  import { ensureTableStyles } from './table-styles'
  import { createTableUndoController } from './table-undo.svelte'
  import { createTableViewsController } from './table-views.svelte'
  import { applyTableViewSnapshot, captureTableViewSnapshot } from './table-view-snapshot'
  import type {
    IrisTableColumn,
    IrisTableSortState,
    IrisTableColumnWidths,
    IrisTableDensity,
  } from './types'
  import { exportCsv as serializeTableCsv } from './exportCsv'
  import {
    applyTableFilters,
    clampWidth,
    getCellValue as resolveTableCellValue,
    mergeFilterValues,
    resolveResponsiveWidth,
    TABLE_CONST,
    cellId,
    isEditableColumn,
    withComputedFormulaCells,
  } from './tableUtils'
  const EMPTY_PROXY_STATE: RemoteTableSourceState<Record<string, unknown>> = {
    data: [],
    total: 0,
    loading: false,
    error: null,
    params: { page: 1, pageSize: 10, sort: null, filters: {} },
  }

  let {
    columns,
    data,
    rowKey = 'id',
    selectable = 'none',
    editConfig,
    selection,
    defaultSelection,
    sort,
    defaultSort,
    formulaTables,
    multiSort = false,
    multiSortState,
    defaultMultiSort,
    onUpdateMultiSort,
    seq = false,
    seqStartIndex = 1,
    seqMethod,
    spanMethod,
    columnVisibility,
    columnOrder,
    onColumnOrderChange,
    columnFade = false,
    filters,
    onFiltersChange,
    filterValues,
    onFilterValuesChange,
    formConfig,
    toolbar,
    undo = false,
    contextMenu,
    proxyConfig,
    pagerConfig,
    striped = false,
    bordered = true,
    density = 'comfortable' as IrisTableDensity,
    densityToggle = false,
    editPreview = false,
    pattern = false,
    patternFill = false,
    pinnedColumns,
    pinnedDrag = false,
    onColumnPinnedChange,
    onPinnedCountChange,
    views,
    onActiveViewChange,
    tableTabs,
    autoDetectTypes = false,
    responsive = false,
    exportNames,
    loading = false,
    error = false,
    printable = false,
    scrollToTop = false,
    importPreview = false,
    emptyState,
    loadingState,
    errorState,
    onRetry = undefined as (() => void) | undefined,
    rowDrag,
    columnDrag,
    onDataChange,
    tableRef,
    virtualScroll,
    columnVirtualization = false,
    resizableColumns = false,
    columnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
    renderDetail,
    rowExpandable,
    defaultExpandedRowKeys,
    onExpandedRowsChange,
    getSubRows,
    lazyLoad,
    keyboardNavigation = false,
    cellRange = false,
    clipConfig,
    onUpdateSelection,
    onUpdateSort,
    onRowClick,
    onCellEdit,
    persistState,
    style,
    ...rest
  }: IrisTableProps = $props()

  const getCellValue = (row: Record<string, unknown>, column: IrisTableColumn): unknown =>
    resolveTableCellValue(row, column, formulaTables)

  const { t } = useI18n()
  let densityState = $state<IrisTableDensity>('comfortable')
  const effectiveDensity = $derived(
    densityToggle
      ? densityState
      : density === 'compact' || density === 'cozy'
        ? density
        : 'comfortable',
  )
  function cycleDensity(): void {
    densityState =
      densityState === 'comfortable'
        ? 'compact'
        : densityState === 'compact'
          ? 'cozy'
          : 'comfortable'
  }
  let responsiveWidth = $state(0)
  const gridCore = useGridCore<Record<string, unknown>>()
  // svelte-ignore state_referenced_locally — columns options seed the stable Core feature;
  const columnsFeature = useGridColumns(gridCore, {
    visibility: columnVisibility,
    order: columnOrder,
    widths: columnWidths,
    defaultWidths: defaultColumnWidths,
    pinned: pinnedColumns,
    onOrderChange: (next) => onColumnOrderChange?.(next),
    onWidthsChange: (next) => onColumnWidthsChange?.(next),
    onPinnedChange: (key, side) => onColumnPinnedChange?.(key, side),
  })
  const columnState = columnsFeature.state
  // svelte-ignore state_referenced_locally — this sentinel is initialized from
  let orderPropControlled = $state(columnOrder !== undefined)
  // svelte-ignore state_referenced_locally — this sentinel is initialized from
  let visibilityPropControlled = $state(columnVisibility !== undefined)
  // svelte-ignore state_referenced_locally — this sentinel is initialized from
  let widthPropControlled = $state(columnWidths !== undefined)
  // svelte-ignore state_referenced_locally — this sentinel is initialized from
  let pinnedPropControlled = $state(pinnedColumns !== undefined)
  // svelte-ignore state_referenced_locally — defaults seed the independent
  let uncontrolledWidths = $state<IrisTableColumnWidths>({ ...(defaultColumnWidths ?? {}) })

  const effectiveVisibility = $derived<Record<string, boolean>>(
    columnVisibility !== undefined
      ? columnVisibility
      : visibilityPropControlled
        ? {}
        : $columnState.visibility,
  )
  const widthsControlled = $derived(columnWidths !== undefined)
  const effectiveWidths = $derived<IrisTableColumnWidths>(
    columnWidths !== undefined
      ? columnWidths
      : widthPropControlled
        ? uncontrolledWidths
        : $columnState.widths,
  )

  $effect(() => {
    const visibility = columnVisibility
    columnsFeature.model.syncVisibility(visibility ?? {})
    visibilityPropControlled = visibility !== undefined
  })
  $effect(() => {
    const order = columnOrder
    if (order !== undefined) {
      columnsFeature.model.syncOrder(order)
    } else if (orderPropControlled) {
      columnsFeature.model.syncOrder([])
    }
    orderPropControlled = order !== undefined
  })
  const effectiveColumnOrder = $derived<string[] | undefined>(
    columnOrder !== undefined ? columnOrder : orderPropControlled ? [] : $columnState.order,
  )
  $effect(() => {
    const widths = columnWidths
    if (widths !== undefined) {
      columnsFeature.model.syncWidths(widths)
    } else if (widthPropControlled) {
      columnsFeature.model.syncWidths(uncontrolledWidths)
    }
    widthPropControlled = widths !== undefined
  })
  $effect(() => {
    const pinned = pinnedColumns
    if (pinned !== undefined) {
      columnsFeature.model.syncPinned(pinned)
    } else if (pinnedPropControlled) {
      columnsFeature.model.syncPinned({})
    }
    pinnedPropControlled = pinned !== undefined
  })

  const pinOf = (column: IrisTableColumn): 'left' | 'right' | null => {
    if (
      pinnedColumns !== undefined &&
      Object.prototype.hasOwnProperty.call(pinnedColumns, column.key)
    ) {
      return pinnedColumns[column.key] ?? null
    }
    return column.pinned ?? null
  }

  const columnFadeController = createTableColumnFade<Record<string, unknown>>({
    visibility: () => effectiveVisibility,
    enabled: () => columnFade,
    columns: () => columns,
  })
  const sourceDisplayColumns = $derived(columnFadeController.displayColumns)

  let detectedTypes = $state<Record<string, DetectedColumnType>>({})
  let detectTypesDone = false
  const detectedDisplayColumns = $derived(
    !autoDetectTypes || Object.keys(detectedTypes).length === 0
      ? sourceDisplayColumns
      : applyDetectedColumnDefaults(sourceDisplayColumns, detectedTypes),
  )

  const responsiveLeadingWidth = $derived(
    (rowDrag ? 40 : 0) +
      (seq ? 60 : 0) +
      (renderDetail !== undefined ? 40 : 0) +
      (selectable !== 'none' ? 40 : 0),
  )
  const responsiveWidthOf = (column: IrisTableColumn): number =>
    resolveResponsiveWidth(column, effectiveWidths, defaultColumnWidths)
  const orderedDisplayColumns = $derived(
    applyColumnOrder(detectedDisplayColumns, effectiveColumnOrder),
  )
  const responsiveResult = $derived(
    responsive
      ? computeResponsiveColumnLayout(orderedDisplayColumns, responsiveWidth, {
          leadingWidth: responsiveLeadingWidth,
          widthOf: responsiveWidthOf,
          isPinnedLeaf: (column) => pinOf(column) !== null,
        })
      : { columns: orderedDisplayColumns, overflow: false },
  )
  const responsiveDisplayColumns = $derived(responsiveResult.columns as IrisTableColumn[])
  const responsiveOverflow = $derived(responsiveResult.overflow)
  const displayColumns = $derived(responsiveDisplayColumns)

  const grouped = $derived(displayColumns.some((c) => c.children && c.children.length > 0))
  const leafColumns = $derived(grouped ? flattenLeafColumns(displayColumns) : displayColumns)
  const headerMatrix = $derived(grouped ? buildHeaderMatrix(displayColumns) : null)
  // Keep sorting props getter-backed so the bridge can track controlled updates
  // without replacing the stable Core model.
  const sortingBridgeOptions: UseGridSortingOptions = {
    get mode() {
      return multiSort ? 'multiple' : 'single'
    },
    get sort() {
      return sort
    },
    get defaultSort() {
      return defaultSort
    },
    get multiSortState() {
      return multiSortState
    },
    get defaultMultiSort() {
      return defaultMultiSort
    },
    onSortChange: (next) => {
      onUpdateSort?.(next)
      if (remoteSort) proxyRef?.setParams({ sort: next })
    },
    onMultiSortChange: (next) => {
      onUpdateMultiSort?.(next)
      if (remoteSort) proxyRef?.setParams({ sorts: next })
    },
  }
  // svelte-ignore state_referenced_locally — pass the reactive options getters to the bridge.
  const {
    model: sortingModel,
    sort: sortingSort,
    multiSort: sortingMultiSort,
  } = useGridSorting<Record<string, unknown>>(gridCore, sortingBridgeOptions)
  const effectiveSort = $derived<IrisTableSortState | null>(
    sort !== undefined ? (sort ?? null) : $sortingSort,
  )
  const effectiveMultiSort = $derived<IrisTableSortState[]>(
    multiSortState !== undefined ? (multiSortState ?? []) : $sortingMultiSort,
  )
  $effect(() => {
    if (sort !== undefined) sortingModel.syncSort(sort ?? null)
    if (multiSortState !== undefined) sortingModel.syncMultiSort(multiSortState ?? [])
  })

  function setSort(next: IrisTableSortState | null): void {
    if (sort !== undefined) sortingModel.syncSort(sort ?? null)
    sortingModel.setSort(next)
  }

  function applySort(next: IrisTableSortState | null): void {
    setSort(next)
  }

  const captureViewSnapshot = () =>
    captureTableViewSnapshot({
      multiSort,
      multiSortState: effectiveMultiSort,
      filters: onFiltersChange ? effectiveFilters : undefined,
      filterValues: onFilterValuesChange ? effectiveFilterValues : undefined,
      columnWidths: onColumnWidthsChange ? effectiveWidths : undefined,
      expandedRowKeys:
        onExpandedRowsChange && (hasDetail || treeMode) ? [...$expandedKeys] : undefined,
      pageSize: proxyRef && proxyConfig?.onPageChange ? proxyState.params.pageSize : undefined,
    })

  function applyViewSnapshot(snapshot: import('./types').IrisTableViewSnapshot): void {
    const viewProxy = proxyRef
    const onPageChange = proxyConfig?.onPageChange
    applyTableViewSnapshot(snapshot, {
      multiSort,
      setMultiSort: (next) => sortingModel.setMultiSort(next),
      setFilters: onFiltersChange ? (next) => filteringModel.setFilters(next) : undefined,
      setFilterValues: onFilterValuesChange
        ? (next) => filteringModel.setFilterValues(next)
        : undefined,
      setColumnWidths: onColumnWidthsChange ? (next) => onColumnWidthsChange(next) : undefined,
      setExpandedRowKeys:
        onExpandedRowsChange && (hasDetail || treeMode) ? (next) => expansion.set(next) : undefined,
      requestPageSize:
        viewProxy && onPageChange
          ? (pageSize) => {
              onPageChange(1, pageSize)
              void viewProxy.request({ pageSize, page: 1 })
            }
          : undefined,
    })
  }

  const tableViews = createTableViewsController({
    config: () => views,
    sort: () => effectiveSort,
    applySort,
    capture: captureViewSnapshot,
    applySnapshot: applyViewSnapshot,
    onActiveViewChange: (key) => onActiveViewChange?.(key),
  })

  function setMultiSort(next: IrisTableSortState[]): void {
    if (multiSortState !== undefined) sortingModel.syncMultiSort(multiSortState ?? [])
    sortingModel.setMultiSort(next)
  }
  const multiSortComparator = $derived<
    () => ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
  >(() => {
    const tables = formulaTables
    return createTableMultiSortComparator(effectiveMultiSort, leafColumns, (row, column) =>
      resolveTableCellValue(row, column, tables),
    )
  })

  // Keep filtering props getter-backed for the same stable-model bridge.
  const filteringBridgeOptions: UseGridFilteringOptions = {
    get filters() {
      return filters
    },
    get defaultFilters() {
      return filters
    },
    get filterValues() {
      return filterValues
    },
    get defaultFilterValues() {
      return filterValues
    },
    onFiltersChange: (next) => onFiltersChange?.(next),
    onFilterValuesChange: (next) => onFilterValuesChange?.(next),
  }
  // svelte-ignore state_referenced_locally — pass the reactive options getters to the bridge.
  const {
    model: filteringModel,
    filters: filteringFilters,
    filterValues: filteringFilterValues,
  } = useGridFiltering<Record<string, unknown>>(gridCore, filteringBridgeOptions)
  const effectiveFilters = $derived(filters !== undefined ? filters : $filteringFilters)
  const effectiveFilterValues = $derived(
    filterValues !== undefined ? filterValues : $filteringFilterValues,
  )
  $effect(() => {
    if (filters !== undefined) filteringModel.syncFilters(filters)
    if (filterValues !== undefined) filteringModel.syncFilterValues(filterValues)
  })

  const hasProxy = $derived(proxyConfig !== undefined)
  const remoteSort = $derived(proxyConfig?.remoteSort === true)
  const remoteFilter = $derived(proxyConfig?.remoteFilter === true)
  let proxyRef: RemoteTableSource<Record<string, unknown>> | null = null
  let proxyUnsub: (() => void) | null = null
  let proxyState = $state<RemoteTableSourceState<Record<string, unknown>>>(EMPTY_PROXY_STATE)
  $effect(() => {
    if (!hasProxy) {
      proxyUnsub?.()
      proxyUnsub = null
      proxyRef?.destroy()
      proxyRef = null
      proxyRows = []
      lastProxyDataRef = undefined
      proxyState = EMPTY_PROXY_STATE
      return
    }
    if (proxyRef) return
    const source = untrack(() => {
      const src = createRemoteTableSource<Record<string, unknown>>({
        query: (params, signal) => proxyConfig!.query(params, signal),
        autoLoad: false,
        resilient: proxyConfig?.resilient,
        initialParams: {
          page: proxyConfig?.defaultPage ?? 1,
          pageSize: proxyConfig?.pageSize ?? 10,
          sort: remoteSort ? ((sort !== undefined ? sort : defaultSort) ?? null) : null,
          sorts: remoteSort && multiSort ? (multiSortState ?? defaultMultiSort ?? []) : undefined,
          filters: remoteFilter ? mergeFilterValues(effectiveFilters, effectiveFilterValues) : {},
        },
      })
      proxyRef = src
      proxyState = src.getState()
      proxyUnsub = src.subscribe((s) => {
        proxyState = s
      })
      const restoredPageSize = persistCtrl.parsed?.pageSize
      if (
        typeof restoredPageSize === 'number' &&
        restoredPageSize > 0 &&
        proxyConfig?.onPageChange
      ) {
        proxyConfig.onPageChange(1, restoredPageSize)
        void src.request({ pageSize: restoredPageSize, page: 1 })
      } else if (proxyConfig?.autoLoad !== false) {
        void src.request()
      }
      return src
    })
    return () => {
      proxyUnsub?.()
      proxyUnsub = null
      source.destroy()
      if (proxyRef === source) proxyRef = null
      proxyRows = []
      lastProxyDataRef = undefined
      proxyState = EMPTY_PROXY_STATE
    }
  })
  let proxyRows = $state<Array<Record<string, unknown>>>([])
  let lastProxyDataRef: Array<Record<string, unknown>> | undefined
  $effect(() => {
    if (!hasProxy) return
    const next = proxyState.data
    if (next !== lastProxyDataRef) {
      lastProxyDataRef = next
      proxyRows = next
    }
  })
  let localRows = $state<Array<Record<string, unknown>> | null>(null)
  // svelte-ignore state_referenced_locally
  let lastInputData = data
  $effect(() => {
    if (hasProxy) return
    const next = data
    if (next !== lastInputData) {
      lastInputData = next
      localRows = null
    }
  })
  const baseData = $derived(hasProxy ? proxyRows : (localRows ?? data ?? []))

  $effect(() => {
    if (!autoDetectTypes || detectTypesDone || baseData.length === 0) return
    detectTypesDone = true
    const next: Record<string, DetectedColumnType> = {}
    for (const column of flattenLeafColumns(columns).filter((c) => !c.formula)) {
      next[column.key] = detectColumnType(baseData.map((row) => getCellValue(row, column)))
    }
    detectedTypes = next
  })

  const filterController = createTableFilterController({
    getControlled: () => effectiveFilterValues,
    onChange: (next) => filteringModel.setFilterValues(next),
  })
  const sortComparator = $derived<
    () => ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
  >(() => {
    const tables = formulaTables
    return createTableSortComparator(effectiveSort, leafColumns, (row, column) =>
      resolveTableCellValue(row, column, tables),
    )
  })

  const sortedRows = $derived((): Array<Record<string, unknown>> => {
    if (remoteSort) return baseData
    return sortTableRows(baseData, leafColumns, {
      mode: multiSort ? 'multiple' : 'single',
      sort: effectiveSort,
      multiSort: effectiveMultiSort,
      getValue: (row, column) => resolveTableCellValue(row, column, formulaTables),
    })
  })

  $effect(() => {
    if (!hasProxy || !remoteSort) return
    if (multiSort) proxyRef?.setParams({ sorts: effectiveMultiSort })
    else proxyRef?.setParams({ sort: effectiveSort ?? null })
  })

  const tableForm = createTableFormController({
    config: () => formConfig,
    filters: () => effectiveFilters,
    filterValues: () => effectiveFilterValues,
    hasProxy: () => hasProxy,
    remoteFilter: () => remoteFilter,
    proxy: () => proxyRef,
  })

  const filteredRows = $derived((): Array<Record<string, unknown>> => {
    if (remoteFilter) return sortedRows()
    const merged: Record<string, string> = hasProxy
      ? effectiveFilters
      : mergeFormFilters(effectiveFilters, tableForm.applied)
    return applyTableFilters(
      sortedRows(),
      leafColumns,
      merged,
      effectiveFilterValues,
      formulaTables,
    )
  })

  function clearSort(): void {
    if (multiSort) {
      onUpdateSort?.(null)
      setMultiSort([])
      return
    }
    setSort(null)
  }

  function clearFilter(): void {
    tableForm.clear()
    filteringModel.clear()
    if (proxyRef) {
      const changed = proxyRef.setParams({ filters: {}, page: 1 })
      if (changed === false) void proxyRef.refetch()
    }
  }

  let recordUndoRows: ((rows: Array<Record<string, unknown>>) => void) | null = null
  let suppressUndoRecord = false
  let rowEditorOpen = (): boolean => false
  let pendingLocalRows = $state<Array<Record<string, unknown>> | null>(null)
  // svelte-ignore state_referenced_locally — the initial rows seed the live
  let liveRowsRef: Array<Record<string, unknown>> = baseData
  let liveRevision = $state(0)

  const readRowChildren = (
    row: Record<string, unknown>,
  ): readonly Record<string, unknown>[] | undefined => {
    if (lazyLoad !== undefined) {
      const children = row.children
      if (Array.isArray(children)) return children as Record<string, unknown>[]
    }
    return getSubRows?.(row)
  }
  const writeLazyChildren = (
    row: Record<string, unknown>,
    children: Record<string, unknown>[],
  ): Record<string, unknown> => ({
    ...row,
    children,
  })

  // svelte-ignore state_referenced_locally — the initial rows seed the core;
  const { model: gridRows } = useGridRows(gridCore, baseData, {
    getRowKey: (row, index) => rowId(row, index),
    getChildren: getSubRows !== undefined || lazyLoad !== undefined ? readRowChildren : undefined,
    setChildren: lazyLoad !== undefined ? writeLazyChildren : undefined,
    onRowsChange: (transaction) => {
      const next = [...transaction.rows]
      liveRowsRef = next
      liveRevision += 1
      if (hasProxy) proxyRows = next
      else if (rowEditorOpen()) pendingLocalRows = next
      else localRows = next
      if (!suppressUndoRecord) recordUndoRows?.(next)
    },
  })
  $effect(() => {
    const rows = baseData
    if (rows !== liveRowsRef) {
      liveRowsRef = rows
      liveRevision += 1
    }
    gridRows.sync(rows)
  })

  const tableHandle = createTableHandle({
    setRows: (rows) => {
      gridRows.loadData(rows)
    },
    onDataChange: (rows) => onDataChange?.(rows),
    refetch: () => {
      if (proxyRef) void proxyRef.refetch()
    },
    setParams: (overrides) => {
      if (proxyRef) void proxyRef.setParams(overrides)
    },
    getProxyInfo: () =>
      hasProxy
        ? {
            page: proxyState.params.page,
            pageSize: proxyState.params.pageSize,
            total: proxyState.total,
          }
        : null,
    clearSort,
    clearFilter,
    removeRows: (keys) => selectionController.removeRows(keys),
    getFilteredData: () => [...bodyData],
    exportCurrentViewCsv: () =>
      serializeTableCsv(
        withComputedFormulaCells(bodyData, leafColumns, formulaTables),
        leafColumns,
      ),
    exportMultiCsv: () => {
      const current = serializeTableCsv(
        withComputedFormulaCells(bodyData, leafColumns, formulaTables),
        leafColumns,
      )
      if (!exportNames || exportNames.length === 0) return current
      const segments = [`# current${current ? `\n${current}` : ''}`]
      for (const entry of exportNames) {
        if (!entry.key) continue
        const refCsv = toCsvRows(entry.ref())
        segments.push(`# ${entry.key}${refCsv ? `\n${refCsv}` : ''}`)
      }
      return segments.join('\n\n')
    },
    compareStates,
    getRoot: () => rootEl,
  })

  $effect(() => {
    const ref = tableRef
    if (!ref) return
    ref.current = tableHandle
    return () => {
      if (ref.current === tableHandle) ref.current = null
      tableHandle.dispose()
    }
  })

  const selControlled = $derived(selection !== undefined)
  // Keep the options object getter-backed: the selection bridge owns a stable
  // model, while its controlled prop must remain reactive to table $props.
  const selectionBridgeOptions: UseGridSelectionOptions<string | number> = {
    get mode() {
      return selectable === 'single' ? 'single' : 'multiple'
    },
    get value() {
      return selection
    },
    get defaultValue() {
      return defaultSelection
    },
    onChange: (keys) => onUpdateSelection?.(keys),
  }
  // svelte-ignore state_referenced_locally — pass the reactive options getters to the bridge.
  const { model: selectionModel, selection: selectedKeys } = useGridSelection<
    Record<string, unknown>,
    string | number
  >(gridCore, selectionBridgeOptions)
  // Preserve the last real uncontrolled snapshot across a rejected controlled
  // proposal; an initially controlled bridge falls back to its accepted prop.
  // svelte-ignore state_referenced_locally — handoff flags seed the bridge once.
  let selectionWasControlled = $state(selection !== undefined)
  // svelte-ignore state_referenced_locally — handoff flags seed the bridge once.
  let hasUncontrolledSelection = $state(selection === undefined)
  // svelte-ignore state_referenced_locally — defaults seed the bridge once.
  let uncontrolledSelectionSnapshot = $state<Array<string | number>>(
    selection === undefined ? [...$selectedKeys] : [],
  )
  // svelte-ignore state_referenced_locally — the prop seeds the bridge once.
  let lastControlledSelection = $state<Array<string | number>>([...(selection ?? [])])

  $effect(() => {
    const current = $selectedKeys
    const controlled = selection !== undefined
    if (controlled) {
      lastControlledSelection = [...selection!]
      selectionModel.sync(selection!)
    } else if (selectionWasControlled) {
      const restore = hasUncontrolledSelection
        ? uncontrolledSelectionSnapshot
        : lastControlledSelection
      if (!hasUncontrolledSelection) {
        uncontrolledSelectionSnapshot = [...restore]
        hasUncontrolledSelection = true
      }
      selectionModel.sync(restore)
    } else {
      uncontrolledSelectionSnapshot = [...current]
      hasUncontrolledSelection = true
    }
    selectionWasControlled = controlled
  })

  const displaySelection = $derived.by(() => {
    if (selControlled) return [...(selection ?? [])]
    if (selectionWasControlled) {
      return [
        ...(hasUncontrolledSelection ? uncontrolledSelectionSnapshot : lastControlledSelection),
      ]
    }
    return [...$selectedKeys]
  })
  function rebaseToProp(): void {
    if (selControlled) selectionModel.sync(selection!)
  }

  const hasDetail = $derived(renderDetail !== undefined)
  // svelte-ignore state_referenced_locally — defaults are read once at creation.
  const { model: expansion, expandedKeys } = useGridExpansion<Record<string, unknown>, string>(
    gridCore,
    {
      mode: 'multiple',
      defaultValue: (defaultExpandedRowKeys ?? []).map(String),
      onChange: (keys) => onExpandedRowsChange?.(keys),
    },
  )

  function isRowExpandable(row: Record<string, unknown>, index: number): boolean {
    return hasDetail && (rowExpandable ? rowExpandable(row, index) : true)
  }

  function rowId(row: Record<string, unknown>, index: number): string | number {
    return resolveTableRowKey(row, rowKey, index)
  }

  let lazyLoading = $state<Set<string>>(new Set())
  let lazyLoaded = $state<Set<string>>(new Set())
  let lazyEpoch = 0
  let lastLazySource: Array<Record<string, unknown>> | undefined
  let lazyWriteSource: Array<Record<string, unknown>> | undefined
  $effect(() => {
    const source = baseData
    if (source !== lastLazySource) {
      const isLazyWrite = source === lazyWriteSource
      lastLazySource = source
      lazyEpoch += 1
      lazyLoading = new Set()
      if (!isLazyWrite) lazyLoaded = new Set()
      lazyWriteSource = undefined
    }
  })
  const hasLazyChildren = (row: Record<string, unknown>, key: string): boolean => {
    if (lazyLoad === undefined || !Array.isArray(row.children)) return false
    return row.children.length > 0 || lazyLoaded.has(key)
  }

  function loadLazyChildren(
    row: Record<string, unknown>,
    key: string,
    effectiveKey: string | number,
  ): void {
    if (lazyLoad === undefined || hasLazyChildren(row, key) || lazyLoading.has(key)) return
    const requestEpoch = lazyEpoch
    lazyLoading = new Set(lazyLoading).add(key)
    let loaded = false
    const load = (children: Record<string, unknown>[]): void => {
      if (loaded || requestEpoch !== lazyEpoch) return
      loaded = true
      const committed = gridRows.setChildren(effectiveKey, children)
      if (!committed) {
        const current = gridRows.find(effectiveKey)
        const loadedEmpty =
          current !== undefined && Array.isArray(current.children) && current.children.length === 0
        if (!loadedEmpty) {
          if (requestEpoch === lazyEpoch) {
            const next = new Set(lazyLoading)
            next.delete(key)
            lazyLoading = next
          }
          return
        }
      }
      lazyLoaded = new Set(lazyLoaded).add(key)
      lazyWriteSource = liveRowsRef
      void bodyData
      expansion.toggle(key)
      const next = new Set(lazyLoading)
      next.delete(key)
      lazyLoading = next
    }
    try {
      lazyLoad(row, load)
    } catch {
      if (requestEpoch === lazyEpoch) {
        const next = new Set(lazyLoading)
        next.delete(key)
        lazyLoading = next
      }
    }
  }

  const treeMode = $derived(getSubRows !== undefined || lazyLoad !== undefined)
  const treeComparator = $derived(() => (multiSort ? multiSortComparator() : sortComparator()))
  const treeProjection = $derived.by<TableBodyRowView<Record<string, unknown>>[] | null>(() => {
    void liveRevision
    return treeMode
      ? projectTableBodyRows(filteredRows(), {
          getKey: (r) => String(rowId(r, 0)),
          getChildren: treeComparator()
            ? withSortedChildren(readRowChildren, treeComparator()!)
            : readRowChildren,
          isExpanded: (k) => $expandedKeys.includes(k),
        })
      : null
  })
  const flatTree = $derived<Array<TreeRow<Record<string, unknown>>> | null>(
    treeProjection?.map((view) => view.treeMeta!) ?? null,
  )
  const bodyData = $derived(
    treeProjection ? treeProjection.map((view) => view.row) : filteredRows(),
  )

  function liveRowFor(row: Record<string, unknown>, index: number): Record<string, unknown> {
    void liveRevision
    const key = rowId(row, index)
    return (
      gridRows.find(key) ??
      liveRowsRef.find((candidate, candidateIndex) => rowId(candidate, candidateIndex) === key) ??
      row
    )
  }

  const reconcileClipboardRows = (
    sourceRows: readonly Record<string, unknown>[],
    previousRows: readonly Record<string, unknown>[],
    rows: readonly Record<string, unknown>[],
  ): Record<string, unknown>[] =>
    reconcileProjectedRows(sourceRows, previousRows, rows, {
      visibleRows: bodyData,
      getRowKey: rowId,
      getChildren: getSubRows !== undefined || lazyLoad !== undefined ? readRowChildren : undefined,
      setChildren: lazyLoad !== undefined ? writeLazyChildren : undefined,
    })

  const selectionController = createTableSelectionController({
    rowIds: () => bodyData.map((row, index) => rowId(row, index)),
    selection: () => displaySelection,
    selectable: () => selectable,
    rebase: rebaseToProp,
    selectionModel,
    gridRows,
    onDataChange: (rows) => onDataChange?.(rows),
  })
  const allSelected = $derived(selectionController.allSelected)
  const someSelected = $derived(selectionController.someSelected)
  const isSelected = selectionController.isSelected
  const toggleRow = selectionController.toggleRow
  const toggleAll = selectionController.toggleAll

  function setColumnWidth(key: string, width: number): void {
    const next = { ...effectiveWidths, [key]: width }
    if (!widthsControlled) uncontrolledWidths = next
    columnsFeature.setWidths(next)
  }

  const resizeHandleEls = $state<Record<string, HTMLElement | undefined>>({})
  // svelte-ignore state_referenced_locally
  for (const col of leafColumns) {
    let startWidth = 0
    useDrag({
      handle: () => resizeHandleEls[col.key],
      disabled: () => !resizableColumns,
      onStart: () => {
        startWidth = resolveColumnWidth(col, effectiveWidths)
      },
      onDrag: ({ dx }) => {
        setColumnWidth(col.key, clampWidth(col, startWidth + dx))
      },
    })
  }
  function registerResizeHandle(node: HTMLElement, key: string): { destroy: () => void } {
    resizeHandleEls[key] = node
    return {
      destroy: () => {
        resizeHandleEls[key] = undefined
      },
    }
  }
  function onResizeHandleKeydown(e: KeyboardEvent, col: IrisTableColumn): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    e.stopPropagation()
    const cur = resolveColumnWidth(col, effectiveWidths)
    const delta = e.key === 'ArrowRight' ? TABLE_CONST.RESIZE_STEP : -TABLE_CONST.RESIZE_STEP
    setColumnWidth(col.key, clampWidth(col, cur + delta))
  }

  const persistSnapshot = $derived(() => {
    const proxy = proxyState
    return captureTablePersistSnapshot({
      sort: onUpdateSort ? effectiveSort : undefined,
      filters: onFiltersChange ? effectiveFilters : undefined,
      columnWidths: onColumnWidthsChange ? effectiveWidths : undefined,
      pageSize: proxyRef && proxy ? proxy.params.pageSize : undefined,
    })
  })

  const restorePersistStatePiece = (
    piece: import('./types').IrisTablePersistPiece,
    value: unknown,
  ) =>
    restoreTablePersistPiece(piece, value, {
      applySort: onUpdateSort ? (next) => applySort(next) : undefined,
      applyFilters: onFiltersChange ? (next) => filteringModel.setFilters(next) : undefined,
      applyColumnWidths: onColumnWidthsChange ? (next) => onColumnWidthsChange(next) : undefined,
      canRestorePageSize: (pageSize) =>
        proxyConfig?.onPageChange !== undefined && typeof pageSize === 'number' && pageSize > 0,
    })

  const persistCtrl = createTablePersistController({
    config: () => persistState,
    restorePiece: restorePersistStatePiece,
  })

  $effect(() => {
    untrack(() => persistCtrl.restore())
  })

  $effect(() => {
    const cfg = persistState
    const snapshot = persistSnapshot()
    persistCtrl.save(cfg, snapshot)
  })

  const pinnedOffsets = $derived(
    computePinnedColumnOffsets(
      leafColumns,
      (column) => resolveColumnWidth(column, effectiveWidths),
      pinOf,
      (rowDrag ? 40 : 0) + (seq ? 60 : 0) + (hasDetail ? 40 : 0) + (selectable !== 'none' ? 40 : 0),
    ),
  )
  const pinnedStyle = (key: string): string => {
    const pinned = pinnedOffsets[key]
    if (!pinned) return ''
    return `position: sticky; ${pinned.side}: ${pinned.offset}px; z-index: 1; background: var(--iris-background)`
  }

  const pinnedDragMath = createPinnedDragMath({
    enabled: () => pinnedDrag,
    columns: () => leafColumns,
    pinOf,
    widthOf: (column) => resolveColumnWidth(column, effectiveWidths),
    controlled: () => pinnedColumns !== undefined,
    setPinned: (key, side) => columnsFeature.setPinned(key, side),
    onColumnPinnedChange: (key, side) => onColumnPinnedChange?.(key, side),
    onPinnedCountChange: (count) => onPinnedCountChange?.(count),
  })
  const pinnedBoundaryKey = $derived(pinnedDragMath.boundaryKey())
  const resolvePinnedCount = pinnedDragMath.resolvePinnedCount
  const commitPinnedCount = pinnedDragMath.commitPinnedCount

  const gridTemplate = $derived(() =>
    buildTableGridTemplate(
      leafColumns,
      effectiveWidths,
      Boolean(rowDrag),
      seq,
      hasDetail,
      selectable !== 'none',
      columnFadeController.isCollapsed,
    ),
  )
  function recordCellCommit(
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    if (newValue === oldValue) return
    onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
  }

  const cellEditing = useGridEditing<Record<string, unknown>>(gridCore, {
    getRowKey: (row, index) => rowId(row, index),
    getRowIndex: (rowKey) => {
      const index = bodyData.findIndex((row, rowIndex) => Object.is(rowId(row, rowIndex), rowKey))
      return index >= 0 ? index : undefined
    },
    getRules: (columnKey) => leafColumns.find((column) => column.key === columnKey)?.editRules,
    getValue: (row, columnKey) => {
      const column = leafColumns.find((candidate) => candidate.key === columnKey)
      return column ? getCellValue(row, column) : row[columnKey]
    },
    setValue: (row, columnKey, value) => {
      const column = leafColumns.find((candidate) => candidate.key === columnKey)
      const key = (column?.dataIndex ?? column?.key ?? columnKey) as string
      return { ...row, [key]: value }
    },
    coerce: (draft, row, columnKey) => {
      const column = leafColumns.find((candidate) => candidate.key === columnKey)
      if (column?.editor !== 'number') return draft
      const text = String(draft ?? '')
      if (text === '' || Number.isNaN(Number(text))) {
        return column ? getCellValue(row, column) : draft
      }
      return Number(text)
    },
    validate: (value, row, columnKey) => {
      const column = leafColumns.find((candidate) => candidate.key === columnKey)
      return column?.validate?.(value, row) ?? null
    },
    isEditable: (_row, columnKey) => {
      const column = leafColumns.find((candidate) => candidate.key === columnKey)
      return Boolean(column && isEditableColumn(column))
    },
    onCommit: (commit) => {
      const column = leafColumns.find((candidate) => candidate.key === commit.columnKey)
      if (column) {
        recordCellCommit(commit.row, column, commit.rowIndex, commit.oldValue, commit.value)
      }
    },
  })
  const editingState = cellEditing.state
  const editingCellId = $derived(
    $editingState.editing
      ? cellId($editingState.editing.rowKey, $editingState.editing.columnKey)
      : null,
  )
  const editingColumnKey = $derived($editingState.editing?.columnKey ?? null)
  const editingDraft = $derived(String($editingState.draft ?? ''))
  const editError = $derived($editingState.error)

  function beginEdit(
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIdent: string | number,
  ): void {
    if (!isEditableColumn(column)) return
    const current = getCellValue(row, column)
    cellEditing.startCellEdit(rowIdent, column.key, current == null ? '' : String(current))
  }

  function commitEdit(
    _row: Record<string, unknown>,
    _column: IrisTableColumn,
    _rowIndex: number,
  ): void {
    cellEditing.commitCellEdit()
  }

  function cancelEdit(): void {
    cellEditing.cancelCellEdit()
  }

  const rowMode = $derived(editConfig?.mode === 'row')
  const rowEdit = createTableRowEditController({
    getColumns: () => leafColumns,
    getRows: () => gridRows.get(),
    findRow: (key) => gridRows.find(key),
    getRowId: rowId,
    getCellValue,
    onCommit: (event) => {
      const ident = rowId(event.row, event.rowIndex)
      const valueKey = (event.column.dataIndex ?? event.column.key) as string
      const changed = gridRows.update(
        ident,
        { [valueKey]: event.newValue },
        { reason: 'cell-edit' },
      )
      if (changed) onCellEdit?.(event)
    },
  })
  rowEditorOpen = () => rowEdit.active !== null
  $effect(() => {
    if (rowEditorOpen() || pendingLocalRows === null) return
    const next = pendingLocalRows
    pendingLocalRows = null
    localRows = next
  })

  let rootEl = $state<HTMLDivElement | null>(null)
  let focusedCell = $state<{ row: number; col: number } | null>(null)

  const setTableRows = (rows: Array<Record<string, unknown>>): void => {
    suppressUndoRecord = true
    try {
      gridRows.commit(rows)
    } finally {
      suppressUndoRecord = false
    }
  }
  const undoController = createTableUndoController({
    enabled: () => undo === true,
    initialRows: () => baseData,
    sourceRows: () => (hasProxy ? proxyState.data : (data ?? [])),
    setRows: setTableRows,
    onDataChange: (rows) => onDataChange?.(rows),
    root: () => rootEl,
    isEditing: () => editingCellId !== null || rowEdit.active !== null,
    selection: {
      current: () => displaySelection,
      enabled: () => selectable !== 'none',
      keyOf: rowId,
      rebase: rebaseToProp,
      set: (keys) => selectionModel.set(keys),
    },
  })
  recordUndoRows = undoController.record
  $effect(() => {
    undoController.syncSource(hasProxy ? proxyState.data : (data ?? []))
  })
  $effect(() => {
    undoController.syncEnabled(undo === true)
  })
  $effect(() => {
    if (!undoController.shortcutsEnabled() || typeof window === 'undefined') return
    const onShortcut = (event: KeyboardEvent): void => undoController.handleKeydown(event)
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  })

  const dragBridge = createTableDragBridge({
    getRoot: () => rootEl,
    getRows: () => baseData,
    getColumns: () => leafColumns,
    getRowId: rowId,
    isGrouped: () => grouped,
    getRowDrag: () => rowDrag,
    getColumnDrag: () => columnDrag,
    commitReorderRows: (activeId, overId) => {
      const visibleRows = bodyData
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
      const getChildren = getSubRows
      if (getChildren !== undefined) {
        const visibleKeys = new Map(
          visibleRows.map((row, index) => [row, String(rowId(row, index))]),
        )
        if (fromVisible < 0 || toVisible < 0) return null
        const result = reorderTreeRows(
          gridRows.get(),
          activeId,
          overId,
          {
            getRowKey: (row) => visibleKeys.get(row),
            getChildren,
          },
          fromVisible < toVisible ? 'after' : 'before',
        )
        if (!result.changed || !gridRows.commit(result.rows, { reason: 'row-drag' })) return null
        return gridRows.get()
      }
      const source = baseData
      const rows = reorderRowsInList(
        source,
        (row, index) => String(rowId(row, index)),
        activeId,
        overId,
      )
      if (rows === source || !gridRows.commit(rows, { reason: 'row-drag' })) return null
      return gridRows.get()
    },
    commitRows: (rows) => {
      gridRows.commit(rows, { reason: 'row-drag' })
    },
    commitColumnOrder: (order) => {
      if (orderPropControlled) columnsFeature.setOrder(order)
    },
    onDataChange: (rows) => onDataChange?.(rows),
  })
  let rowDragSnapshot = $state(dragBridge.rowController.getState())
  let columnDragSnapshot = $state(dragBridge.columnController.getState())
  const dragEnabled = $derived(rowDrag !== undefined || columnDrag !== undefined)
  $effect(() => {
    if (!dragEnabled) return
    const stopRow = dragBridge.rowController.subscribe((next) => (rowDragSnapshot = next))
    const stopColumn = dragBridge.columnController.subscribe((next) => (columnDragSnapshot = next))
    return () => {
      stopRow()
      stopColumn()
    }
  })
  const handleRowDragPointerDown = dragBridge.rowPointerDown
  const handleColumnDragPointerDown = dragBridge.columnPointerDown
  const handleDragPointerCancel = dragBridge.cancel
  const handleDragPointerMove = dragBridge.pointerMove
  const handleDragPointerUp = dragBridge.pointerUp

  const { model: cellRangeCtrl, range: selectedRange } = useGridRange(gridCore)
  const { serialize: serializeGridRange, paste: pasteGridRange } = useGridClipboard<
    Record<string, unknown>
  >(gridCore, {
    getRows: () => bodyData,
    getColumns: () => leafColumns,
    resolveValue: (row, column) => getCellValue(row, column as IrisTableColumn),
    setValue: (row, column, value) => ({
      ...row,
      [(column.dataIndex ?? column.key) as string]: value,
    }),
    isCellEditable: (_row, column) => !(column as IrisTableColumn).formula,
    reconcileRows: reconcileClipboardRows,
    onPaste: (change) => onDataChange?.([...change.rows]),
  })

  const keyboard = createTableKeyboard({
    keyboardNavigation: () => keyboardNavigation,
    cellRange: () => cellRange,
    clipConfig: () => clipConfig,
    rows: () => bodyData,
    columns: () => leafColumns,
    root: () => rootEl,
    getFocused: () => focusedCell,
    setFocused: (next) => (focusedCell = next),
    range: cellRangeCtrl,
    getRange: () => $selectedRange,
    serializeRange: serializeGridRange,
    pasteRange: (range) => {
      void readClipboardText().then((text) => {
        if (text !== null) pasteGridRange(text, range)
      })
    },
  })
  const { handleRootKeyDown, cellTabIndex, isInRange, activeCellRange, copyActiveRange } = keyboard

  $effect(() => {
    if (!responsive || !rootEl) {
      responsiveWidth = 0
      return
    }
    const el = rootEl
    const measure = (): void => {
      responsiveWidth = el.clientWidth
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  })

  let scrollLeft = $state(0)
  let viewportWidth = $state(0)

  $effect(() => {
    if (!columnVirtualization || !rootEl) return
    const el = rootEl
    const measure = (): void => {
      viewportWidth = el.clientWidth
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  })

  function handleRootScroll(e: Event): void {
    scrollLeft = (e.currentTarget as HTMLElement).scrollLeft
  }

  const visibleColSet = $derived.by<Set<number> | null>(() => {
    return computeVisibleColumnIndices(columnVirtualization, {
      columns: leafColumns,
      scrollOffset: scrollLeft,
      viewportSize: viewportWidth,
      itemSize: (column) => resolveColumnWidth(column, effectiveWidths),
      isAlwaysVisible: (column) =>
        pinOf(column) !== null || columnFadeController.fadeByLeaf[column.key] !== undefined,
    })
  })

  const spanPlan = $derived.by<GridSpanPlan | null>(() => {
    if (spanMethod === undefined) return null
    return computeGridSpanPlan(bodyData.length, leafColumns.length, spanMethod)
  })

  onMount(() => ensureTableStyles(columnFade))
  $effect(() => {
    if (columnFade) ensureTableStyles(true)
  })
</script>

<TablePresentation
  {rest}
  rootRef={(node) => (rootEl = node)}
  {style}
  {keyboardNavigation}
  {treeMode}
  {cellRange}
  {clipConfig}
  {activeCellRange}
  {copyActiveRange}
  {handleRootKeyDown}
  {dragEnabled}
  {handleDragPointerMove}
  {handleDragPointerUp}
  {handleDragPointerCancel}
  {columnVirtualization}
  {responsive}
  {responsiveOverflow}
  {handleRootScroll}
  {bordered}
  {printable}
  {scrollToTop}
  {effectiveDensity}
  {tableTabs}
  {tableViews}
  {views}
  {formConfig}
  formDraft={tableForm.draft}
  setFormValue={tableForm.setValue}
  handleFormSubmit={tableForm.submit}
  handleFormReset={tableForm.reset}
  {toolbar}
  {undo}
  {undoController}
  {selectable}
  {displaySelection}
  refreshProxy={() => {
    if (proxyRef) void proxyRef.refetch()
  }}
  setProxyParams={(partial) => proxyRef?.setParams(partial)}
  {hasProxy}
  {pagerConfig}
  {proxyState}
  {proxyConfig}
  {importPreview}
  {densityToggle}
  {cycleDensity}
  {displayColumns}
  columnFade={columnFadeController}
  {grouped}
  {headerMatrix}
  {rowDrag}
  {rowDragSnapshot}
  {handleRowDragPointerDown}
  {columnDrag}
  {columnDragSnapshot}
  {handleColumnDragPointerDown}
  {seq}
  {hasDetail}
  {selection}
  {allSelected}
  {someSelected}
  {toggleAll}
  {multiSort}
  {effectiveMultiSort}
  {effectiveSort}
  {sortingModel}
  {sort}
  {multiSortState}
  filterValues={effectiveFilterValues}
  {filterController}
  {leafColumns}
  {contextMenu}
  {bodyData}
  {flatTree}
  {virtualScroll}
  {rowId}
  {liveRowFor}
  {isSelected}
  {toggleRow}
  {rowMode}
  {rowEdit}
  {editConfig}
  {editingCellId}
  {editingColumnKey}
  {editingDraft}
  {editError}
  {pattern}
  {patternFill}
  {striped}
  {spanPlan}
  {visibleColSet}
  {gridTemplate}
  {resizableColumns}
  {registerResizeHandle}
  {effectiveWidths}
  {onResizeHandleKeydown}
  {pinnedDrag}
  {pinnedBoundaryKey}
  {pinOf}
  {pinnedStyle}
  {resolvePinnedCount}
  {commitPinnedCount}
  {loading}
  {error}
  {errorState}
  {loadingState}
  {emptyState}
  {onRetry}
  {seqStartIndex}
  {seqMethod}
  {renderDetail}
  {onRowClick}
  {isRowExpandable}
  expandedKeys={$expandedKeys}
  expansionToggle={(key) => expansion.toggle(key)}
  {lazyLoad}
  {hasLazyChildren}
  {lazyLoading}
  {loadLazyChildren}
  {getCellValue}
  {beginEdit}
  setCellDraft={(value) => cellEditing.setCellDraft(value)}
  {commitEdit}
  {cancelEdit}
  startRange={(row, col) => cellRangeCtrl.startRange(row, col)}
  extendRange={(row, col) => cellRangeCtrl.extendRange(row, col)}
  {cellTabIndex}
  {isInRange}
  setFocusedCell={(cell) => (focusedCell = cell)}
  {formulaTables}
  {editPreview}
  {t}
/>
