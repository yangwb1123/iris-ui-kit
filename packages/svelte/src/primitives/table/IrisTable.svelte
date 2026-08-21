<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import type { Snippet } from 'svelte'
  type RowSnippet = Snippet<[Record<string, unknown>]>
  import {
    buildFormValues,
    buildHeaderMatrix,
    compareStates,
    createCellRange,
    createRemoteTableSource,
    createSelectionModel,
    createExpansion,
    detectColumnType,
    flattenLeafColumns,
    flattenTree,
    mergeFormFilters,
    removeRowsFromList,
    seedFormValues,
    tableDisplayText,
    toCsvRows,
    withSortedChildren,
    type DetectedColumnType,
    type RemoteTableParams,
    type RemoteTableSource,
    type RemoteTableSourceState,
    type TreeRow,
    validateEditRulesAsync,
  } from '@iris-ui-kit/core'
  import { toStore } from '../../useStore'
  import { useI18n } from '../../i18n'
  import { useDrag } from '../drag/useDrag.svelte'
  import IrisVirtualScroll from '../virtual-scroll/IrisVirtualScroll.svelte'
  import TableCellEditor from './TableCellEditor.svelte'
  import TableChrome from './TableChrome.svelte'
  import TableContextMenu from './TableContextMenu.svelte'
  import TableDragHandle from './TableDragHandle.svelte'
  import TableFilterPanel from './TableFilterPanel.svelte'
  import TableHeader from './TableHeader.svelte'
  import TableTabs from './TableTabs.svelte'
  import TableViews from './TableViews.svelte'
  import TableSummary from './TableSummary.svelte'
  import type { IrisTableProps } from './props'
  import type {
    IrisTableColumn,
    IrisTableSortState,
    IrisTableColumnWidths,
    IrisTableDensity,
  } from './types'
  import { createTableDragBridge } from './table-drag'
  import { createTableHandle } from './table-handle'
  import { exportCsv as serializeTableCsv } from './exportCsv'
  import {
    applyTableFilters,
    buildSpanPlan,
    clampWidth,
    computeVisibleColSet,
    createMultiSortComparator,
    createSortComparator,
    getCellValue,
    mergeFilterValues,
    resolveInitialWidth,
    resolveResponsiveWidth,
    editPreviewText,
    TABLE_CONST,
    cellId,
    type SpanPlan,
    computeResponsiveTableColumns,
  } from './tableUtils'
  import { createTableFilterController } from './table-filter.svelte'
  import { createTableRowEditController } from './table-row-edit.svelte'
  import { createTableKeyboard } from './table-keyboard'
  import { handleTableRowKeyDown } from './table-events'
  import { applyDetectedTableTypes } from './table-columns'
  import { createPinnedDragMath } from './table-pinned-drag'
  import { createTableViewsController } from './table-views.svelte'
  import { TABLE_STYLES } from './table-styles'
  import TableSortIndicator from './TableSortIndicator.svelte'
  import TableStateRow from './TableStateRow.svelte'
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
    multiSort = false,
    multiSortState,
    defaultMultiSort,
    onUpdateMultiSort,
    seq = false,
    seqStartIndex = 1,
    seqMethod,
    spanMethod,
    columnVisibility,
    filters,
    onFiltersChange,
    filterValues,
    onFilterValuesChange,
    formConfig,
    toolbar,
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
    keyboardNavigation = false,
    cellRange = false,
    clipConfig,
    onUpdateSelection,
    onUpdateSort,
    onRowClick,
    onCellEdit,
    style,
    ...rest
  }: IrisTableProps = $props()

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
  const sourceDisplayColumns = $derived(
    columnVisibility !== undefined
      ? columns.filter((c) => columnVisibility![c.key] !== false)
      : columns,
  )

  let detectedTypes = $state<Record<string, DetectedColumnType>>({})
  let detectTypesDone = false
  const detectedDisplayColumns = $derived(
    !autoDetectTypes || Object.keys(detectedTypes).length === 0
      ? sourceDisplayColumns
      : applyDetectedTableTypes(sourceDisplayColumns, detectedTypes),
  )

  const responsiveLeadingWidth = $derived(
    (rowDrag ? 40 : 0) +
      (seq ? 60 : 0) +
      (renderDetail !== undefined ? 40 : 0) +
      (selectable !== 'none' ? 40 : 0),
  )
  const responsiveWidthOf = (column: IrisTableColumn): number =>
    resolveResponsiveWidth(column, columnWidths, defaultColumnWidths)
  const responsiveResult = $derived(
    responsive
      ? computeResponsiveTableColumns(
          detectedDisplayColumns,
          responsiveWidth,
          responsiveLeadingWidth,
          responsiveWidthOf,
        )
      : { columns: detectedDisplayColumns, overflow: false },
  )
  const responsiveDisplayColumns = $derived(responsiveResult.columns)
  const responsiveOverflow = $derived(responsiveResult.overflow)
  const displayColumns = $derived(responsiveDisplayColumns)

  const grouped = $derived(displayColumns.some((c) => c.children && c.children.length > 0))
  const leafColumns = $derived(grouped ? flattenLeafColumns(displayColumns) : displayColumns)
  const headerMatrix = $derived(grouped ? buildHeaderMatrix(displayColumns) : null)

  // svelte-ignore state_referenced_locally — `defaultSort` is an initial seed.
  let internalSort = $state<IrisTableSortState | null>(defaultSort ?? null)
  const effectiveSort = $derived(sort !== undefined ? sort : internalSort)

  const tableViews = createTableViewsController({
    config: () => views,
    sort: () => effectiveSort,
    applySort: (next) => {
      if (sort === undefined) internalSort = next
      onUpdateSort?.(next)
      if (remoteSort) proxyRef?.setParams({ sort: next })
    },
    onActiveViewChange: (key) => onActiveViewChange?.(key),
  })

  const multiControlled = $derived(multiSortState !== undefined)
  // svelte-ignore state_referenced_locally — seeded from defaultMultiSort; controlled syncs via the prop.
  let multiInternal = $state<IrisTableSortState[]>(defaultMultiSort ?? [])
  const effectiveMultiSort = $derived<IrisTableSortState[]>(
    multiControlled ? (multiSortState ?? []) : multiInternal,
  )
  function setMultiSort(next: IrisTableSortState[]): void {
    if (!multiControlled) multiInternal = next
    onUpdateMultiSort?.(next)
    // remoteSort parity (multi mode): the FULL sort list re-queries the
    // server; the single `sort` param stays the single-column channel.
    if (remoteSort) proxyRef?.setParams({ sorts: next })
  }
  const multiSortComparator = $derived<
    () => ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
  >(() => createMultiSortComparator(effectiveMultiSort, leafColumns, getCellValue))
  function cycleMultiSort(column: IrisTableColumn): void {
    if (!column.sortable) return
    const idx = effectiveMultiSort.findIndex((s) => s.key === column.key)
    if (idx < 0) {
      setMultiSort([...effectiveMultiSort, { key: column.key, direction: 'asc' }])
      return
    }
    const next = [...effectiveMultiSort]
    if (next[idx]!.direction === 'asc') {
      next[idx] = { key: column.key, direction: 'desc' }
      setMultiSort(next)
      return
    }
    next.splice(idx, 1)
    setMultiSort(next)
  }

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
        query: (params) => proxyConfig!.query(params),
        autoLoad: false,
        initialParams: {
          page: proxyConfig?.defaultPage ?? 1,
          pageSize: proxyConfig?.pageSize ?? 10,
          sort: remoteSort ? ((sort !== undefined ? sort : defaultSort) ?? null) : null,
          sorts: remoteSort && multiSort ? (multiSortState ?? defaultMultiSort ?? []) : undefined,
          filters: remoteFilter ? mergeFilterValues(filters ?? {}, filterValues ?? {}) : {},
        },
      })
      proxyRef = src
      proxyState = src.getState()
      proxyUnsub = src.subscribe((s) => {
        proxyState = s
      })
      // autoLoad parity: kick the first request here (never during render).
      if (proxyConfig?.autoLoad !== false) void src.request()
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
    for (const column of flattenLeafColumns(columns)) {
      const candidate = column as IrisTableColumn & { formula?: unknown }
      if (candidate.formula) continue
      next[column.key] = detectColumnType(baseData.map((row) => getCellValue(row, candidate)))
    }
    detectedTypes = next
  })

  const filterController = createTableFilterController({
    getControlled: () => filterValues,
    onChange: (next) => onFilterValuesChange?.(next),
  })
  const effectiveFilterValues = $derived(filterController.values)
  const sortComparator = $derived<
    () => ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
  >(() => createSortComparator(effectiveSort, leafColumns, getCellValue))

  const sortedRows = $derived((): Array<Record<string, unknown>> => {
    // remoteSort parity: the server owns the ordering — never re-sort locally.
    // Multi mode uses the chained multi comparator exclusively (an empty list
    // means unsorted); single mode keeps the single comparator.
    if (remoteSort) return baseData
    if (multiSort) {
      const compare = multiSortComparator()
      if (!compare) return baseData
      return [...baseData].sort(compare)
    }
    const compare = sortComparator()
    if (!compare) return baseData
    return [...baseData].sort(compare)
  })

  $effect(() => {
    if (!hasProxy || !remoteSort) return
    if (multiSort) proxyRef?.setParams({ sorts: effectiveMultiSort })
    else proxyRef?.setParams({ sort: effectiveSort ?? null })
  })

  // svelte-ignore state_referenced_locally — initial seed only; re-seeding is keyed on the field signature below.
  let formDraft = $state<Record<string, string>>(seedFormValues(formConfig?.fields))
  let formApplied = $state<Record<string, string>>({})
  // Field signature = key + default by VALUE, so re-seeding is keyed on the
  // signature ($derived compares by value, not identity): an inline
  // formConfig object with a fresh identity each render never wipes user
  // input. The formConfig object itself is read untracked below.
  const formFieldSignature = $derived(
    (formConfig?.fields ?? []).map((f) => `${f.key}=${f.defaultValue ?? ''}`).join('\u0000'),
  )
  // svelte-ignore state_referenced_locally — the object is read untracked by
  // design: re-seeding is keyed on the field signature only, so an inline
  // formConfig identity never wipes user input.
  let lastFormSignature: string | undefined
  $effect(() => {
    const cfg = untrack(() => formConfig)
    const signature = formFieldSignature
    // Keyed on the signature VALUE (the only tracked dependency): a fresh
    // inline formConfig object per render never re-seeds.
    if (signature === lastFormSignature) return
    lastFormSignature = signature
    formDraft = seedFormValues(cfg?.fields)
    formApplied = {}
  })
  function setFormValue(key: string, value: string): void {
    if (formDraft[key] === value) return
    formDraft = { ...formDraft, [key]: value }
  }
  function handleFormSubmit(e: Event): void {
    e.preventDefault()
    const values = buildFormValues(formConfig?.fields, formDraft)
    formConfig?.onSearch?.(values)
    formApplied = values
    if (proxyRef) {
      void proxyRef.setParams({
        filters: mergeFilterValues(mergeFormFilters(filters ?? {}, values), effectiveFilterValues),
        page: 1,
      })
    }
  }
  function handleFormReset(e: Event): void {
    e.preventDefault()
    const defaults = seedFormValues(formConfig?.fields)
    formDraft = defaults
    const values = buildFormValues(formConfig?.fields, defaults)
    formApplied = values
    formConfig?.onReset?.(values)
    if (proxyRef) {
      if (
        proxyRef.setParams({
          filters: mergeFilterValues(
            mergeFormFilters(filters ?? {}, values),
            effectiveFilterValues,
          ),
          page: 1,
        }) === false
      ) {
        void proxyRef.refetch()
      }
    }
  }
  $effect(() => {
    if (!hasProxy || !remoteFilter) return
    proxyRef?.setParams({
      filters: mergeFilterValues(
        mergeFormFilters(filters ?? {}, formApplied),
        effectiveFilterValues,
      ),
    })
  })

  const filteredRows = $derived((): Array<Record<string, unknown>> => {
    if (remoteFilter) return sortedRows()
    const merged: Record<string, string> = hasProxy
      ? (filters ?? {})
      : mergeFormFilters(filters ?? {}, formApplied)
    return applyTableFilters(sortedRows(), displayColumns, merged, effectiveFilterValues)
  })

  function handleHeaderClick(column: IrisTableColumn): void {
    if (multiSort) {
      cycleMultiSort(column)
      return
    }
    if (!column.sortable) return
    const current = effectiveSort
    let next: IrisTableSortState | null
    if (!current || current.key !== column.key) {
      next = { key: column.key, direction: 'asc' }
    } else if (current.direction === 'asc') {
      next = { key: column.key, direction: 'desc' }
    } else {
      next = null
    }
    if (sort === undefined) internalSort = next
    onUpdateSort?.(next)
    if (remoteSort) proxyRef?.setParams({ sort: next })
  }

  function handleHeaderKeyDown(event: KeyboardEvent, column: IrisTableColumn): void {
    if (!column.sortable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    handleHeaderClick(column)
  }

  function clearSort(): void {
    if (sort === undefined) internalSort = null
    onUpdateSort?.(null)
    if (multiSort) {
      if (!multiControlled) multiInternal = []
      onUpdateMultiSort?.([])
    }
    if (proxyRef) {
      const next: Partial<RemoteTableParams> = multiSort ? { sorts: [] } : { sort: null }
      void proxyRef.setParams(next)
    }
  }

  function clearFilter(): void {
    formDraft = seedFormValues(formConfig?.fields)
    formApplied = {}
    onFiltersChange?.({})
    filterController.clearAll()
    if (proxyRef) {
      const changed = proxyRef.setParams({ filters: {}, page: 1 })
      if (changed === false) void proxyRef.refetch()
    }
  }

  const tableHandle = createTableHandle({
    setRows: (rows) => {
      if (hasProxy) proxyRows = rows
      else localRows = rows
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
    removeRows: removeRowsForHandle,
    getFilteredData: () => [...bodyData],
    exportCurrentViewCsv: () => serializeTableCsv(bodyData, leafColumns),
    exportMultiCsv: () => {
      const current = serializeTableCsv(bodyData, leafColumns)
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
  // svelte-ignore state_referenced_locally — initial seed; controlled changes sync below.
  const selectionModel = createSelectionModel<string | number>({
    mode: selectable === 'single' ? 'single' : 'multiple',
    defaultSelected: selection ?? defaultSelection ?? [],
    onChange: (keys) => onUpdateSelection?.(keys),
  })
  const selectedKeys = toStore(selectionModel.store)

  $effect(() => {
    if (selControlled) selectionModel.sync(selection!)
  })

  const displaySelection = $derived(selControlled ? selection! : $selectedKeys)
  function rebaseToProp(): void {
    if (selControlled) selectionModel.sync(selection!)
  }

  const hasDetail = $derived(renderDetail !== undefined)
  // svelte-ignore state_referenced_locally — defaults are read once at creation.
  const expansion = createExpansion({
    mode: 'multiple',
    defaultExpanded: (defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => onExpandedRowsChange?.(keys),
  })
  const expandedKeys = toStore(expansion.store)

  function isRowExpandable(row: Record<string, unknown>, index: number): boolean {
    return hasDetail && (rowExpandable ? rowExpandable(row, index) : true)
  }

  function rowId(row: Record<string, unknown>, index: number): string | number {
    const v = row[rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  const treeMode = $derived(getSubRows !== undefined)
  const treeComparator = $derived(() => (multiSort ? multiSortComparator() : sortComparator()))
  const flatTree = $derived<Array<TreeRow<Record<string, unknown>>> | null>(
    treeMode
      ? flattenTree(filteredRows(), {
          getKey: (r) => String(rowId(r, 0)),
          getChildren: treeComparator()
            ? withSortedChildren((r) => getSubRows!(r), treeComparator()!)
            : (r) => getSubRows!(r),
          isExpanded: (k) => $expandedKeys.includes(k),
        })
      : null,
  )
  const bodyData = $derived(flatTree ? flatTree.map((tr) => tr.row) : filteredRows())

  const allRowIds = $derived(bodyData.map((r, i) => rowId(r, i)))
  const allSelected = $derived(
    allRowIds.length > 0 && allRowIds.every((id) => displaySelection.includes(id)),
  )
  const someSelected = $derived(
    !allSelected && allRowIds.some((id) => displaySelection.includes(id)),
  )

  function isSelected(id: string | number): boolean {
    return displaySelection.includes(id)
  }

  function toggleRow(id: string | number): void {
    // Mode (single vs multiple) is fixed from `selectable` at model creation;
    // the model owns the toggle/replace semantics.
    if (selectable === 'single' || selectable === 'multi') {
      rebaseToProp()
      selectionModel.toggle(id)
    }
  }

  function toggleAll(): void {
    rebaseToProp()
    selectionModel.toggleAll(allRowIds)
  }

  function removeRowsForHandle(keys: Array<string | number>): void {
    const { rows, removedKeys } = removeRowsFromList(baseData, rowKey, keys)
    if (removedKeys.size === 0) return
    if (hasProxy) proxyRows = rows
    else localRows = rows
    const selected = displaySelection
    const nextSelection = selected.filter((key) => !removedKeys.has(key))
    if (nextSelection.length !== selected.length) {
      rebaseToProp()
      selectionModel.set(nextSelection)
    }
    onDataChange?.(rows)
  }

  // svelte-ignore state_referenced_locally
  let internalWidths = $state<IrisTableColumnWidths>({ ...(defaultColumnWidths ?? {}) })

  const widthsControlled = $derived(columnWidths !== undefined)
  const effectiveWidths = $derived<IrisTableColumnWidths>(
    widthsControlled ? columnWidths! : internalWidths,
  )
  function setColumnWidth(key: string, width: number): void {
    const next = { ...effectiveWidths, [key]: width }
    if (!widthsControlled) internalWidths = next
    onColumnWidthsChange?.(next)
  }

  const resizeHandleEls = $state<Record<string, HTMLElement | undefined>>({})
  // svelte-ignore state_referenced_locally
  for (const col of leafColumns) {
    let startWidth = 0
    useDrag({
      handle: () => resizeHandleEls[col.key],
      disabled: () => !resizableColumns,
      onStart: () => {
        startWidth = effectiveWidths[col.key] ?? resolveInitialWidth(col)
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
  // Focus + Arrow-Left/Right nudge the column width by RESIZE_STEP (keyboard
  // analogue of the pointer drag); clicking the grip must not bubble to sort.
  function onResizeHandleKeydown(e: KeyboardEvent, col: IrisTableColumn): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    e.stopPropagation()
    const cur = effectiveWidths[col.key] ?? resolveInitialWidth(col)
    const delta = e.key === 'ArrowRight' ? TABLE_CONST.RESIZE_STEP : -TABLE_CONST.RESIZE_STEP
    setColumnWidth(col.key, clampWidth(col, cur + delta))
  }

  const pinnedDragMath = createPinnedDragMath({
    enabled: () => pinnedDrag,
    columns: () => leafColumns,
    widthOf: (column) => effectiveWidths[column.key] ?? resolveInitialWidth(column),
    onColumnPinnedChange: (key, side) => onColumnPinnedChange?.(key, side),
    onPinnedCountChange: (count) => onPinnedCountChange?.(count),
  })
  const pinnedBoundaryKey = $derived(pinnedDragMath.boundaryKey())
  const resolvePinnedCount = pinnedDragMath.resolvePinnedCount
  const commitPinnedCount = pinnedDragMath.commitPinnedCount

  const showSelection = $derived(selectable !== 'none')
  const lead = $derived(
    (rowDrag ? 1 : 0) + (seq ? 1 : 0) + (hasDetail ? 1 : 0) + (showSelection ? 1 : 0),
  )

  const gridTemplate = $derived(() => {
    const parts: string[] = []
    if (rowDrag) parts.push('40px')
    if (seq) parts.push('60px')
    if (hasDetail) parts.push('40px')
    if (showSelection) parts.push('40px')
    for (const col of leafColumns) {
      const override = effectiveWidths[col.key]
      if (override != null) parts.push(`${override}px`)
      else if (typeof col.width === 'number') parts.push(`${col.width}px`)
      else if (col.width === 'auto') parts.push('minmax(max-content, max-content)')
      else if (typeof col.width === 'string') parts.push(col.width)
      else parts.push('minmax(0, 1fr)')
    }
    return parts.join(' ')
  })
  let editingCellId = $state<string | null>(null)
  let editingColumnKey = $state<string | null>(null)
  let editingDraft = $state('')
  let editError = $state<string | null>(null)

  function beginEdit(
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIdent: string | number,
  ): void {
    if (!column.editable) return
    editingCellId = cellId(rowIdent, column.key)
    editingColumnKey = column.key
    const current = getCellValue(row, column)
    editingDraft = current == null ? '' : String(current)
    editError = null
  }

  function commitEdit(
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
  ): void {
    if (editingCellId === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft
    const newValue =
      column.editor === 'number'
        ? draft === '' || isNaN(Number(draft))
          ? oldValue
          : Number(draft)
        : draft
    if (column.editRules && column.editRules.length > 0) {
      const context = { rows: baseData, columnKey: column.key }
      void validateEditRulesAsync(column.editRules, draft, row, false, context).then(
        (r: { valid: boolean; messages: string[] }) => {
          if (!r.valid) {
            editError = r.messages[0] ?? null
            return
          }
          finishCommit(row, column, rowIndex, oldValue, newValue)
        },
      )
      return
    }
    // A column validator keeps the editor open until the draft is valid.
    if (column.validate) {
      const error = column.validate(newValue, row)
      if (error) {
        editError = error
        return
      }
    }
    finishCommit(row, column, rowIndex, oldValue, newValue)
  }

  function finishCommit(
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    editError = null
    editingCellId = null
    editingColumnKey = null
    if (newValue !== oldValue) {
      onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
      // Proxy mode: write the committed value into the local page copy so the
      // edit survives without a refetch (react liveData parity); the next
      // page/refetch replaces the copy wholesale.
      if (proxyRef) {
        const ident = rowId(row, rowIndex)
        proxyRows = proxyRows.map((r, i) =>
          rowId(r, i) === ident ? { ...r, [column.key]: newValue } : r,
        )
      }
    }
  }

  function cancelEdit(): void {
    editError = null
    editingCellId = null
    editingColumnKey = null
  }

  const rowMode = $derived(editConfig?.mode === 'row')
  const rowEdit = createTableRowEditController({
    getColumns: () => leafColumns,
    getRows: () => bodyData,
    getRowId: rowId,
    getCellValue,
    onCommit: (event) => {
      onCellEdit?.(event)
      if (proxyRef) {
        const ident = rowId(event.row, event.rowIndex)
        proxyRows = proxyRows.map((current, index) =>
          rowId(current, index) === ident
            ? { ...current, [event.column.key]: event.newValue }
            : current,
        )
      }
    },
  })

  const stateRowStyle = 'padding: 32px 12px; text-align: center; color: var(--iris-muted)'

  // Grid keyboard navigation (opt-in): roving cell focus over the data cells.
  let rootEl = $state<HTMLDivElement | null>(null)
  let focusedCell = $state<{ row: number; col: number } | null>(null)

  const dragBridge = createTableDragBridge({
    getRoot: () => rootEl,
    getRows: () => baseData,
    getColumns: () => leafColumns,
    getRowId: rowId,
    isGrouped: () => grouped,
    getRowDrag: () => rowDrag,
    getColumnDrag: () => columnDrag,
    commitRows: (rows) => {
      if (hasProxy) proxyRows = rows
      else localRows = rows
      onDataChange?.(rows)
    },
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

  // Cell-range selection (opt-in via `cellRange`). The controller is created
  // once; its state is bridged into Svelte via a $state variable subscribed to
  // the core store.
  // svelte-ignore state_referenced_locally
  const cellRangeCtrl = createCellRange()
  let cellRangeState = $state(cellRangeCtrl.getState())
  // Subscribe to core store — Svelte's $effect cleanup will run on destroy.
  $effect(() => {
    const unsub = cellRangeCtrl.subscribe((s) => {
      cellRangeState = s
    })
    return unsub
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
    getRangeState: () => cellRangeState,
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

  // -------- Column virtualization (opt-in) --------
  // Render only the horizontally-visible columns (+ pinned + a small overscan)
  // for very wide tables. The root becomes a horizontal scroll container; we
  // track its scrollLeft + measured clientWidth and feed them to the core
  // `computeVirtualRange` to get the visible window. Off-screen tracks stay
  // sized (the grid template is unchanged), so alignment/resize keep working.
  let scrollLeft = $state(0)
  let viewportWidth = $state(0)

  // Measure the root's width on mount + on resize (when columnVirtualization is
  // on). Guard ResizeObserver — jsdom and old runtimes lack it; a single mount
  // measurement still seeds the window.
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

  // Set of leaf-column indices to render: the visible window (+ overscan),
  // always unioned with pinned columns. `null` ⇒ render every column (off).
  const visibleColSet = $derived.by<Set<number> | null>(() =>
    computeVisibleColSet(
      columnVirtualization,
      leafColumns,
      scrollLeft,
      viewportWidth,
      effectiveWidths,
    ),
  )

  // 1-based grid track for a leaf-column index (after the optional detail +
  // selection tracks), so a rendered cell lands in the right place even when
  // earlier cells are skipped.
  function colTrack(i: number): number {
    return (rowDrag ? 1 : 0) + (seq ? 1 : 0) + (hasDetail ? 1 : 0) + (showSelection ? 2 : 1) + i
  }

  // Sequence numbers (vxe seqConfig parity): a leading read-only column whose
  // value is rowIndex + seqStartIndex, or seqMethod's return, or — in proxy
  // mode with proxyConfig.seq — cumulative across pages.
  function seqValue(index: number): string | number {
    if (seqMethod) return seqMethod({ rowIndex: index, columnIndex: 0 })
    if (proxyRef && proxyConfig?.seq && seq) {
      return (proxyState.params.page - 1) * proxyState.params.pageSize + index + 1
    }
    return index + seqStartIndex
  }

  // Span bookkeeping (vxe spanMethod parity): a pure per-pass plan over the
  // full body grid, rebuilt reactively whenever the body rows, columns or
  // spanMethod change — correct across virtual-window boundaries (windowed
  // cells consult the same plan) and needs no render-time ref mutation.
  const spanPlan = $derived.by<SpanPlan | null>(() => {
    if (spanMethod === undefined) return null
    return buildSpanPlan(bodyData.length, leafColumns.length, spanMethod)
  })

  // Active sort info for a column: multi mode reads the click-order list,
  // single mode the single-column state.
  function sortAria(col: IrisTableColumn): 'none' | 'ascending' | 'descending' | undefined {
    if (multiSort) {
      const idx = effectiveMultiSort.findIndex((s) => s.key === col.key)
      if (idx < 0) return col.sortable ? 'none' : undefined
      return effectiveMultiSort[idx]!.direction === 'asc' ? 'ascending' : 'descending'
    }
    if (effectiveSort?.key !== col.key) return col.sortable ? 'none' : undefined
    return effectiveSort.direction === 'asc' ? 'ascending' : 'descending'
  }

  // Proxy mode drives the table's loading/error UI from the controller state
  // (reusing the existing loading/error props rendering below).
  const tableLoading = $derived(hasProxy ? proxyState.loading : loading)
  const tableError = $derived(hasProxy ? proxyState.error !== null : error)
  function handleRetry(): void {
    if (proxyRef) void proxyRef.refetch()
    onRetry?.()
  }

  // Virtualize flat mode, and tree mode too — tree rows are uniform height, so
  // the only blocker is variable-height detail panels: virtualize unless BOTH
  // tree mode and detail panels are on. `!(treeMode && hasDetail)` is De
  // Morgan-equivalent to React's `!treeMode || !hasDetail` (same truth table
  // across all four flat/tree × detail combinations). When `virtualScroll` is
  // unset this is false, so the non-virtual body path renders unchanged.
  const useVirtual = $derived(virtualScroll != null && !(treeMode && hasDetail))
  onMount(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('iris-table-row-styles')) return
    const style = document.createElement('style')
    style.id = 'iris-table-row-styles'
    style.textContent = TABLE_STYLES
    document.head.appendChild(style)
  })
</script>

{#snippet sortIndicator(col: IrisTableColumn)}
  <TableSortIndicator
    column={col}
    {multiSort}
    multiSortState={effectiveMultiSort}
    sortState={effectiveSort}
  />
{/snippet}

<TableTabs tabs={tableTabs} activeKey={tableViews.activeTab} onApply={tableViews.applyTableTab} />
<TableViews
  config={views}
  views={tableViews.viewList}
  activeKey={tableViews.activeViewKey}
  onSelect={tableViews.selectView}
  onSave={tableViews.saveView}
  onDelete={tableViews.deleteView}
/>

<TableChrome
  config={formConfig}
  draft={formDraft}
  setValue={setFormValue}
  onSubmit={handleFormSubmit}
  onReset={handleFormReset}
  {toolbar}
  {selectable}
  selectedKeys={displaySelection}
  refresh={() => {
    if (proxyRef) void proxyRef.refetch()
  }}
  enabled={hasProxy}
  {pagerConfig}
  snapshot={proxyState}
  setParams={(partial) => proxyRef?.setParams(partial)}
  onPageChange={proxyConfig?.onPageChange}
  {importPreview}
  {densityToggle}
  {effectiveDensity}
  onDensityToggle={cycleDensity}
  {t}
/>

<div
  {...rest}
  bind:this={rootEl}
  role={keyboardNavigation ? (treeMode ? 'treegrid' : 'grid') : 'table'}
  data-iris-table
  data-density={effectiveDensity}
  data-printable={printable ? 'true' : undefined}
  data-column-virtualized={columnVirtualization ? 'true' : undefined}
  onkeydown={keyboardNavigation || cellRange || clipConfig ? handleRootKeyDown : undefined}
  onpointermove={dragEnabled ? handleDragPointerMove : undefined}
  onpointerup={dragEnabled ? handleDragPointerUp : undefined}
  onpointercancel={dragEnabled ? handleDragPointerCancel : undefined}
  onpointerleave={dragEnabled ? handleDragPointerCancel : undefined}
  onscroll={columnVirtualization ? handleRootScroll : undefined}
  style="background: var(--iris-background); color: var(--iris-foreground); font-size: var(--iris-font-size-md, 14px); border: {bordered
    ? '1px solid var(--iris-border)'
    : 'none'}; border-radius: var(--iris-radius-md, 6px); overflow: {columnVirtualization ||
  responsiveOverflow
    ? 'auto'
    : 'hidden'};{responsiveOverflow ? ' overflow-x: auto;' : ''}{style ? ' ' + style : ''}"
>
  {#if clipConfig && clipConfig.copy !== false && activeCellRange()}
    <button type="button" data-iris-table-range-copy onclick={copyActiveRange}>
      {t('table.range.copy')}
    </button>
  {/if}
  <!-- Header row -->
  <TableHeader
    columns={displayColumns}
    {grouped}
    {headerMatrix}
    {rowDrag}
    {columnDrag}
    {columnDragSnapshot}
    {handleColumnDragPointerDown}
    {seq}
    {hasDetail}
    {showSelection}
    {selectable}
    {selection}
    {allSelected}
    {someSelected}
    {toggleAll}
    {lead}
    {sortAria}
    {handleHeaderClick}
    {handleHeaderKeyDown}
    {sortIndicator}
    {gridTemplate}
    {visibleColSet}
    {colTrack}
    {resizableColumns}
    {registerResizeHandle}
    {effectiveWidths}
    {onResizeHandleKeydown}
    {pinnedDrag}
    {pinnedBoundaryKey}
    {resolvePinnedCount}
    {commitPinnedCount}
    filterValues={effectiveFilterValues}
    onFilterOpen={filterController.open}
    showAsterisk={editConfig?.showAsterisk === true}
    {t}
  />

  <TableContextMenu
    root={rootEl}
    config={contextMenu}
    columns={leafColumns}
    getRows={() => bodyData}
  />

  {#if filterController.openKey}
    {@const filterColumn = displayColumns.find((column) => column.key === filterController.openKey)}
    {#if filterColumn}
      <TableFilterPanel
        column={filterColumn}
        values={filterController.draft}
        onToggle={filterController.toggle}
        onApply={() => filterController.apply(filterColumn.key)}
        onClear={() => filterController.clear(filterColumn.key)}
        onClose={filterController.close}
        {t}
      />
    {/if}
  {/if}

  <!-- Body -->
  {#if tableError}
    <TableStateRow
      kind="error"
      style={stateRowStyle}
      {errorState}
      retryable={Boolean(onRetry || hasProxy)}
      onRetry={handleRetry}
      {t}
    />
  {:else if tableLoading}
    <TableStateRow kind="loading" style={stateRowStyle} {loadingState} retryable={false} {t} />
  {:else if bodyData.length === 0}
    <TableStateRow kind="empty" style={stateRowStyle} {emptyState} retryable={false} {t} />
  {:else if useVirtual}
    <!-- Virtualize flat mode, and tree mode too — tree rows are uniform height,
         so the only thing that bars it is variable-height detail panels, hence
         the `!hasDetail` guard. `bodyData` is the flattened visible rows (=
         `sortedRows()` in flat mode); `flatTree?.[index]` supplies each row's
         tree meta (depth + toggle), with `index` the absolute row index from
         the scroller. -->
    <IrisVirtualScroll
      data-iris-table-body=""
      items={bodyData}
      itemHeight={virtualScroll!.itemHeight}
      height={virtualScroll!.height}
      buffer={virtualScroll!.buffer}
      keyOf={(row, index) => rowId(row as Record<string, unknown>, index)}
    >
      {#snippet item({ item: row, index })}
        {@render bodyRow(
          row as Record<string, unknown>,
          index,
          flatTree ? flatTree[index] : null,
          true,
        )}
      {/snippet}
    </IrisVirtualScroll>
  {:else}
    <div role="rowgroup" data-iris-table-body>
      {#each bodyData as row, index}
        {@const id = rowId(row, index)}
        {@render bodyRow(row, index, flatTree ? flatTree[index] : null, false)}
        <!-- Full-width detail panel beneath an expanded, expandable row (spans
             all grid tracks). Only in the non-virtualized path. -->
        {#if hasDetail && isRowExpandable(row, index) && $expandedKeys.includes(String(id))}
          <div
            role="row"
            data-iris-table-row-detail={String(id)}
            style="display: grid; grid-template-columns: {gridTemplate()}"
          >
            <div
              role="cell"
              data-iris-table-detail-cell=""
              style="grid-column: 1 / -1; padding: 8px 12px; border-bottom: 1px solid var(--iris-border)"
            >
              {renderDetail?.(row, index)}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- One body row. Shared by the non-virtual `{#each}` and the virtual
       scroller's `item` snippet so the markup is identical either way. The
       virtual path passes `fillHeight` so the row fills its absolutely-sized
       window slot; `treeMeta` carries the per-row depth/toggle (flatTree[index]
       at the row's absolute index). -->
  {#snippet bodyRow(
    row: Record<string, unknown>,
    index: number,
    treeMeta: TreeRow<Record<string, unknown>> | null,
    fillHeight: boolean,
  )}
    {@const id = rowId(row, index)}
    {@const selected = isSelected(id)}
    {@const rowEditing = rowMode && rowEdit.active?.key === id}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      role="row"
      aria-selected={selectable !== 'none' ? selected : undefined}
      data-iris-table-row
      data-iris-table-row-key={String(id)}
      data-iris-table-row-index={index}
      data-iris-row-editing={rowEditing ? 'true' : undefined}
      data-state={selected ? 'selected' : undefined}
      aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
      aria-setsize={treeMeta ? treeMeta.setSize : undefined}
      aria-posinset={treeMeta ? treeMeta.posInset : undefined}
      onclick={onRowClick ? () => onRowClick(row, index) : undefined}
      onkeydown={onRowClick
        ? (event) => handleTableRowKeyDown(event, row, index, onRowClick)
        : undefined}
      tabindex={onRowClick ? 0 : undefined}
      style="display: grid; grid-template-columns: {gridTemplate()};{fillHeight
        ? ' height: 100%;'
        : ''} background: {selected
        ? 'var(--iris-surface-selected)'
        : rowEditing
          ? 'var(--iris-surface-selected)'
          : striped && index % 2 === 1
            ? 'var(--iris-surface)'
            : 'var(--iris-row-bg, transparent)'}; transition: background-color var(--iris-transition-fast, 150ms) ease; cursor: default"
    >
      {#if rowDrag}
        <TableDragHandle
          id={String(id)}
          active={rowDragSnapshot.activeId === String(id)}
          over={rowDragSnapshot.overId === String(id)}
          onPress={(event) => handleRowDragPointerDown(event, String(id))}
        />
      {/if}
      {#if seq}
        <div
          role="cell"
          data-iris-table-cell="__seq"
          style="display: flex; align-items: center; justify-content: center; padding: 8px; font-size: var(--iris-font-size-md, 14px); border-bottom: 1px solid var(--iris-border); color: var(--iris-muted); user-select: none"
        >
          {seqValue(index)}
        </div>
      {/if}
      {#if hasDetail}
        <div
          role="cell"
          data-iris-table-cell="__expand"
          style="display: flex; align-items: center; justify-content: center; padding: 8px; font-size: var(--iris-font-size-md, 14px); border-bottom: 1px solid var(--iris-border)"
        >
          {#if isRowExpandable(row, index)}
            <button
              type="button"
              data-iris-table-expand-toggle=""
              aria-expanded={$expandedKeys.includes(String(id))}
              aria-label={t(
                $expandedKeys.includes(String(id)) ? 'treeSelect.collapse' : 'treeSelect.expand',
              )}
              onclick={(e) => {
                e.stopPropagation()
                expansion.toggle(String(id))
              }}
              style="border: none; background: transparent; cursor: pointer; padding: 0; font: inherit; color: var(--iris-foreground); transform: {$expandedKeys.includes(
                String(id),
              )
                ? 'rotate(90deg)'
                : 'none'}; transition: transform 150ms">▶</button
            >
          {/if}
        </div>
      {/if}
      {#if showSelection}
        <div
          role="cell"
          style="display: flex; align-items: center; justify-content: center; padding: 8px; border-bottom: 1px solid var(--iris-border)"
        >
          <input
            type="checkbox"
            checked={selected}
            onchange={() => toggleRow(id)}
            onclick={(e) => e.stopPropagation()}
            aria-label={t('table.selectRow', { key: id })}
          />
        </div>
      {/if}
      {#each leafColumns as col, ci}
        {#if !visibleColSet || visibleColSet.has(ci)}
          {@const spanKey = `${index}:${ci}`}
          {@const spanEntry = spanPlan?.spans.get(spanKey)}
          {@const spanCovered = spanPlan ? spanPlan.occupied.has(spanKey) : false}
          {@const editId = cellId(id, col.key)}
          {@const rowSession = rowMode ? rowEdit.session(editId) : undefined}
          {@const isEditing = rowSession !== undefined || (!rowMode && editingCellId === editId)}
          {@const patternHint =
            (pattern || patternFill) &&
            !rowMode &&
            editingColumnKey === col.key &&
            !isEditing &&
            editingDraft !== '' &&
            String(getCellValue(row, col) ?? '') === editingDraft}
          {#if !spanCovered}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              role="cell"
              data-iris-table-cell={col.key}
              data-iris-table-pinned={col.pinned}
              data-editable={col.editable ? '' : undefined}
              data-editing={isEditing ? '' : undefined}
              data-iris-input-hint={patternHint ? 'true' : undefined}
              data-grid-row={keyboardNavigation ? index : undefined}
              data-grid-col={keyboardNavigation ? ci : undefined}
              data-iris-cell-row={cellRange ? index : undefined}
              data-iris-cell-col={cellRange ? ci : undefined}
              data-iris-cell-selected={cellRange && isInRange(index, ci) ? 'true' : undefined}
              tabindex={keyboardNavigation ? cellTabIndex(index, ci) : undefined}
              onfocus={keyboardNavigation
                ? () => (focusedCell = { row: index, col: ci })
                : undefined}
              onclick={rowMode && editConfig?.trigger !== 'manual'
                ? () => rowEdit.handleCellClick(row, col, index, id)
                : cellRange
                  ? (e: MouseEvent) => {
                      if (e.shiftKey) {
                        cellRangeCtrl.extendRange(index, ci)
                      } else {
                        cellRangeCtrl.startRange(index, ci)
                      }
                    }
                  : editConfig?.trigger === 'click' && col.editable
                    ? () => beginEdit(row, col, id)
                    : undefined}
              onkeydown={cellRange
                ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    if (event.shiftKey) cellRangeCtrl.extendRange(index, ci)
                    else cellRangeCtrl.startRange(index, ci)
                  }
                : undefined}
              ondblclick={rowMode && editConfig?.trigger !== 'manual'
                ? () => rowEdit.switchTo(row, index, col.key)
                : col.editable &&
                    editConfig?.trigger !== 'click' &&
                    editConfig?.trigger !== 'manual'
                  ? () => beginEdit(row, col, id)
                  : undefined}
              style="display: flex; align-items: center; justify-content: {(col.align ??
                (typeof getCellValue(row, col) === 'number' ? 'right' : 'left')) === 'right'
                ? 'flex-end'
                : col.align === 'center'
                  ? 'center'
                  : 'flex-start'};{visibleColSet
                ? ` grid-column-start: ${colTrack(ci)};`
                : ''}{spanEntry && spanEntry.colspan > 1
                ? ` grid-column-end: span ${spanEntry.colspan};`
                : ''} padding: {isEditing
                ? '4px'
                : '8px var(--iris-padding-md, 12px)'}; border-bottom: 1px solid var(--iris-border); font-size: var(--iris-font-size-md, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: {col.editable
                ? 'cell'
                : 'default'}{cellRange && isInRange(index, ci)
                ? '; background: var(--iris-surface-selected, color-mix(in srgb, var(--iris-primary) 12%, transparent))'
                : ''}{isEditing ? '; flex-wrap: wrap' : ''}{patternHint
                ? '; background-image: linear-gradient(var(--iris-input-hint, rgba(251, 191, 36, 0.16)), var(--iris-input-hint, rgba(251, 191, 36, 0.16)))'
                : ''}"
            >
              {#if treeMeta && ci === 0}
                <span
                  data-iris-table-tree-indent=""
                  style="display: inline-flex; align-items: center; flex: none; padding-left: {treeMeta.depth *
                    16}px"
                >
                  {#if treeMeta.hasChildren}
                    <button
                      type="button"
                      data-iris-table-tree-toggle=""
                      aria-expanded={treeMeta.expanded}
                      aria-label={t(
                        treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand',
                      )}
                      onclick={(e) => {
                        e.stopPropagation()
                        expansion.toggle(treeMeta.key)
                      }}
                      style="border: none; background: transparent; cursor: pointer; padding: 0; margin-right: 4px; font: inherit; color: var(--iris-foreground); transform: {treeMeta.expanded
                        ? 'rotate(90deg)'
                        : 'none'}; transition: transform 150ms">▶</button
                    >
                  {:else}
                    <span style="display: inline-block; width: 16px" aria-hidden="true"></span>
                  {/if}
                </span>
              {/if}
              {#if isEditing}
                <TableCellEditor
                  type={col.editor}
                  value={rowMode ? (rowSession?.draft ?? '') : editingDraft}
                  error={rowMode ? (rowSession?.error ?? null) : editError}
                  errorId={`${editId}-error`}
                  onInput={(value) => {
                    if (rowMode) rowEdit.setDraft(editId, value)
                    else editingDraft = value
                  }}
                  onCommit={() => {
                    if (rowMode) rowEdit.commit(editId, row, col, index, id)
                    else commitEdit(row, col, index)
                  }}
                  onCancel={() => (rowMode ? rowEdit.cancel() : cancelEdit())}
                  showPreview={editPreview && col.formatter !== undefined}
                  preview={editPreview && col.formatter !== undefined
                    ? editPreviewText(row, col, rowMode ? (rowSession?.draft ?? '') : editingDraft)
                    : undefined}
                  onTab={rowMode && rowSession
                    ? (direction) => rowEdit.tab(editId, row, col, index, id, direction)
                    : undefined}
                  inputRef={rowMode ? (node) => rowEdit.registerInput(col.key, node) : undefined}
                />
              {:else if col.render}
                {@render (col.render(getCellValue(row, col), row) as RowSnippet)(row)}
              {:else}
                {tableDisplayText(row, col)}
              {/if}
            </div>
          {/if}
        {/if}
      {/each}
    </div>
  {/snippet}
  {#if !tableError && !tableLoading}
    <TableSummary
      {bodyData}
      {leafColumns}
      {rowDrag}
      {seq}
      {hasDetail}
      {showSelection}
      {visibleColSet}
      {gridTemplate}
      {colTrack}
      {getCellValue}
    />
  {/if}
</div>
{#if responsive && responsiveOverflow && !printable}
  <div
    data-iris-scroll-hint=""
    role="status"
    aria-live="polite"
    style="display: flex; align-items: center; gap: var(--iris-space-xxs, 4px); padding: var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px); color: var(--iris-muted); background: var(--iris-surface); border-inline: 1px solid var(--iris-border); border-bottom: 1px solid var(--iris-border); font-size: var(--iris-font-size-sm, 13px)"
  >
    <span aria-hidden="true">⇆</span>
    <span>{t('table.scrollHint')}</span>
  </div>
{/if}
