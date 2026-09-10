import { createEffect, onCleanup, onMount, type Accessor } from 'solid-js'
import {
  createGridColumnsFeature,
  createGridCore,
  createGridEditingFeature,
  createGridExpansionFeature,
  createGridFilteringFeature,
  createGridPaginationFeature,
  createGridPaginationProjection,
  createGridRowsFeature,
  createGridSelectionFeature,
  createGridSortingFeature,
  createGridVirtualFeature,
  type GridColumnPin,
  type GridColumnsModel,
  type GridColumnsState,
  type GridCore,
  type GridExpansionKey,
  type GridFeature,
  type GridFilterValues,
  type GridEditingCommit,
  type GridEditingFeatureOptions,
  type GridEditingKey,
  type GridEditingModel,
  type GridEditingValidation,
  type GridFilteringModel,
  type GridPaginationChange,
  type GridPaginationModel,
  type GridPaginationState,
  type GridRowKey,
  type GridRowsCommitOptions,
  type GridRowsModel,
  type GridRowsTransaction,
  type SelectionKey,
  type GridSortingModel,
  type GridVirtualModel,
  type GridVirtualRangeChange,
  type SelectionMode,
  type SelectionModel,
  type SortState,
  type VirtualizerState,
} from '@iris-ui-kit/core/grid'
import { useStore, useStoreSelector } from '../useStore'
import type { ExpansionModel } from '@iris-ui-kit/core'
import type { CellEditState } from '@iris-ui-kit/core'

export * from './useGridRange'

export interface UseGridCoreOptions<Row extends Record<string, unknown>> {
  readonly features?: readonly GridFeature<Row>[]
}

/** Solid lifecycle bridge for one framework-independent Grid Core instance. */
export function useGridCore<Row extends Record<string, unknown> = Record<string, unknown>>(
  options: UseGridCoreOptions<Row> = {},
): GridCore<Row> {
  const core = createGridCore(options)
  onMount(() => core.ready())
  onCleanup(() => core.destroy())
  return core
}

function useGridFeature<Row extends Record<string, unknown>, Model>(
  core: GridCore<Row>,
  name: string,
  method: string,
  create: () => GridFeature<Row>,
): Model {
  if (!core.hasFeature(name)) core.use(create())
  return core.invoke<Model>(method)
}

export interface UseGridSelectionOptions<K extends SelectionKey = string> {
  mode?: SelectionMode
  value?: K[]
  defaultValue?: K[]
  onChange?: (keys: K[]) => void
  getKeys?: () => readonly K[]
}
export interface UseGridSelectionResult<K extends SelectionKey = string> {
  model: SelectionModel<K>
  selection: Accessor<K[]>
  controlled: Accessor<boolean>
  rebase(): void
}
export function useGridSelection<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends SelectionKey = string,
>(core: GridCore<Row>, options: UseGridSelectionOptions<K> = {}): UseGridSelectionResult<K> {
  const latest = options
  const model = useGridFeature<Row, SelectionModel<K>>(core, 'selection', 'getSelectionModel', () =>
    createGridSelectionFeature<Row, K>({
      mode: options.mode,
      defaultSelected: options.value !== undefined ? options.value : options.defaultValue,
      getKeys: () => latest.getKeys?.() ?? [],
      onChange: (keys) => latest.onChange?.(keys),
    }),
  )
  const internal = useStore(model.store)
  let wasControlled = options.value !== undefined
  let hasUncontrolledSnapshot = !wasControlled
  let uncontrolledSnapshot = [...internal()]
  let lastControlledSnapshot = [...(options.value ?? [])]

  createEffect(() => {
    const value = options.value
    const controlled = value !== undefined
    // Read each key so reactive prop proxies also observe in-place changes.
    void JSON.stringify(value)
    if (controlled) {
      lastControlledSnapshot = [...value]
      model.sync(value)
    } else if (wasControlled) {
      const restore = hasUncontrolledSnapshot ? uncontrolledSnapshot : lastControlledSnapshot
      if (!hasUncontrolledSnapshot) {
        uncontrolledSnapshot = [...restore]
        hasUncontrolledSnapshot = true
      }
      model.sync(restore)
    }
    wasControlled = controlled
  })
  createEffect(() => {
    const current = internal()
    if (!wasControlled) {
      uncontrolledSnapshot = [...current]
      hasUncontrolledSnapshot = true
    }
  })
  const controlled = () => options.value !== undefined
  return {
    model,
    controlled,
    selection: () => {
      const current = internal()
      const value = options.value
      if (value !== undefined) return [...value]
      return [
        ...(wasControlled
          ? hasUncontrolledSnapshot
            ? uncontrolledSnapshot
            : lastControlledSnapshot
          : current),
      ]
    },
    rebase: () => {
      const value = latest.value
      if (value !== undefined) {
        lastControlledSnapshot = [...value]
        model.sync(value)
      }
    },
  }
}

export interface UseGridExpansionOptions<K extends GridExpansionKey = string> {
  mode?: 'single' | 'multiple'
  defaultValue?: K[]
  onChange?: (keys: K[]) => void
  getKeys?: () => readonly K[]
}
export interface UseGridExpansionResult<K extends GridExpansionKey = string> {
  model: ExpansionModel<K>
  expandedKeys: Accessor<K[]>
}
export function useGridExpansion<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends GridExpansionKey = string,
>(core: GridCore<Row>, options: UseGridExpansionOptions<K> = {}): UseGridExpansionResult<K> {
  const latest = options
  const model = useGridFeature<Row, ExpansionModel<K>>(core, 'expansion', 'getExpansionModel', () =>
    createGridExpansionFeature<Row, K>({
      mode: options.mode,
      defaultExpanded: options.defaultValue,
      getKeys: () => latest.getKeys?.() ?? [],
      onChange: (keys) => latest.onChange?.(keys),
    }),
  )
  const state = useStore(model.store)
  return { model, expandedKeys: () => [...state()] }
}

export interface UseGridRowsOptions<Row extends Record<string, unknown>, Meta = unknown> {
  /** Copy the initial seed before the rows feature stores it (default true). */
  cloneDefaultRows?: boolean
  rowKeyField?: string
  getRowKey?: (row: Row, index: number) => GridRowKey | undefined
  /** Read nested rows when the source is a tree; omitted keeps flat-row semantics. */
  getChildren?: (row: Row) => readonly Row[] | undefined
  /** Replace nested rows immutably when `getChildren` is not a direct property. */
  setChildren?: (row: Row, children: Row[]) => Row
  onBeforeRowsChange?: (transaction: GridRowsTransaction<Row, Meta>) => void
  onRowsChange?: (transaction: GridRowsTransaction<Row, Meta>) => void
}
export function useGridRows<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Meta = unknown,
>(
  core: GridCore<Row>,
  initialRows: readonly Row[],
  options: UseGridRowsOptions<Row, Meta> = {},
): { model: GridRowsModel<Row, Meta>; rows: Accessor<Row[]> } {
  const latest = options
  const model = useGridFeature<Row, GridRowsModel<Row, Meta>>(core, 'rows', 'getRowsModel', () =>
    createGridRowsFeature<Row, Meta>({
      defaultRows: initialRows,
      cloneDefaultRows: options.cloneDefaultRows,
      rowKeyField: options.rowKeyField,
      getRowKey: (row, index) => latest.getRowKey?.(row, index),
      getChildren: options.getChildren,
      setChildren: options.setChildren,
      onBeforeRowsChange: (tx) => latest.onBeforeRowsChange?.(tx),
      onRowsChange: (tx) => latest.onRowsChange?.(tx),
    }),
  )
  return { model, rows: useStoreSelector(model.store, (current) => [...current]) }
}

export interface UseGridEditingOptions<Row extends Record<string, unknown>> extends Omit<
  GridEditingFeatureOptions<Row>,
  'onStateChange' | 'onCommit'
> {
  onStateChange?: (state: CellEditState<GridEditingKey>) => void
  onValidation?: (validation: GridEditingValidation) => void
  onCommit?: (commit: GridEditingCommit<Row>) => void
}

export interface UseGridEditingResult<Row extends Record<string, unknown>> {
  core: GridCore<Row>
  model: GridEditingModel
  state: Accessor<CellEditState<GridEditingKey>>
  startCellEdit(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): boolean
  setCellDraft(value: unknown): void
  cancelCellEdit(): void
  commitCellEdit(value?: unknown): boolean
  isCellEditing(rowKey: GridEditingKey, columnKey: string): boolean
}

/** Installs the framework-independent editing feature and bridges its state into Solid. */
export function useGridEditing<Row extends Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridEditingOptions<Row>,
): UseGridEditingResult<Row> {
  const latest = options
  const model = useGridFeature<Row, GridEditingModel>(core, 'editing', 'getEditingModel', () =>
    createGridEditingFeature<Row>({
      getRowKey: (row, index) => latest.getRowKey(row, index),
      getRowIndex: (rowKey, row, rootRows) => latest.getRowIndex?.(rowKey, row, rootRows),
      getRules: (columnKey) => latest.getRules?.(columnKey),
      getValue: (row, columnKey) => latest.getValue?.(row, columnKey) ?? row[columnKey],
      setValue: (row, columnKey, value) =>
        latest.setValue?.(row, columnKey, value) ?? { ...row, [columnKey]: value },
      coerce: (draft, row, columnKey) => latest.coerce?.(draft, row, columnKey) ?? draft,
      validate: (value, row, columnKey) => latest.validate?.(value, row, columnKey) ?? null,
      isEditable: (row, columnKey) => latest.isEditable?.(row, columnKey) ?? true,
      missingRowMessage: options.missingRowMessage,
      commitOptions: () => {
        const configured = latest.commitOptions
        return typeof configured === 'function' ? configured() : (configured ?? {})
      },
      onStateChange: (state) => latest.onStateChange?.(state),
      onValidation: (validation) => latest.onValidation?.(validation),
      onCommit: (commit) => latest.onCommit?.(commit),
    }),
  )
  const state = useStoreSelector(model.store, () => model.getState())
  return {
    core,
    model,
    state,
    startCellEdit: (rowKey, columnKey, initialDraft) =>
      model.start(rowKey, columnKey, initialDraft),
    setCellDraft: (value) => model.setDraft(value),
    cancelCellEdit: () => model.cancelEdit(),
    commitCellEdit: (value) => model.commitEdit(value),
    isCellEditing: (rowKey, columnKey) => model.isEditing(rowKey, columnKey),
  }
}

function cloneGridColumnsState(state: GridColumnsState): GridColumnsState {
  return {
    visibility: { ...state.visibility },
    order: [...state.order],
    widths: { ...state.widths },
    pinned: { ...state.pinned },
  }
}

export interface UseGridColumnsOptions {
  visibility?: Record<string, boolean>
  defaultVisibility?: Record<string, boolean>
  onVisibilityChange?: (value: Record<string, boolean>) => void
  order?: string[]
  defaultOrder?: string[]
  widths?: Record<string, number>
  defaultWidths?: Record<string, number>
  onOrderChange?: (value: string[] | undefined) => void
  onWidthsChange?: (value: Record<string, number>) => void
  pinned?: Record<string, GridColumnPin>
  defaultPinned?: Record<string, GridColumnPin>
  onPinnedChange?: (key: string, side: GridColumnPin) => void
}
export function useGridColumns<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridColumnsOptions = {},
): {
  model: GridColumnsModel
  state: Accessor<GridColumnsState>
  setVisibility(value: Record<string, boolean>): void
  toggleVisibility(key: string): void
  setOrder(value: string[] | undefined): void
  clearOrder(): void
  setWidths(value: Record<string, number>): void
  setWidth(key: string, width: number): void
  resetWidths(): void
  setPinned(key: string, side: GridColumnPin): void
} {
  const latest = options
  const model = useGridFeature<Row, GridColumnsModel>(core, 'columns', 'getColumnsModel', () =>
    createGridColumnsFeature<Row>({
      defaultVisibility: options.visibility ?? options.defaultVisibility,
      defaultOrder: options.order ?? options.defaultOrder,
      defaultWidths: options.widths ?? options.defaultWidths,
      defaultPinned: options.pinned ?? options.defaultPinned,
      onVisibilityChange: (v) => latest.onVisibilityChange?.(v),
      onOrderChange: (v) => latest.onOrderChange?.(v),
      onWidthsChange: (v) => latest.onWidthsChange?.(v),
      onPinnedChange: (k, v) => latest.onPinnedChange?.(k, v),
    }),
  )
  const internal = useStore(model.store)
  const state = (): GridColumnsState => cloneGridColumnsState(internal())
  let uncontrolledVisibility = { ...(options.defaultVisibility ?? {}) }
  let uncontrolledOrder = [...(options.defaultOrder ?? [])]
  let uncontrolledWidths = { ...(options.defaultWidths ?? {}) }
  let uncontrolledPinned = { ...(options.defaultPinned ?? {}) }
  let wasVisibilityControlled = options.visibility !== undefined
  let wasOrderControlled = options.order !== undefined
  let wasWidthsControlled = options.widths !== undefined
  let wasPinnedControlled = options.pinned !== undefined
  createEffect(() => {
    const visibility = options.visibility
    const order = options.order
    const widths = options.widths
    const pinned = options.pinned
    const controlledVisibility = visibility !== undefined
    const controlledOrder = order !== undefined
    const controlledWidths = widths !== undefined
    const controlledPinned = pinned !== undefined
    // Touch entries as well as each map/array so reactive prop proxies observe
    // in-place controlled updates. Do not read the model store here: callers
    // may own a separate reactive sync for the same core feature.
    void (visibility ? JSON.stringify(Object.entries(visibility)) : '')
    void (order ? JSON.stringify(order) : '')
    void (widths ? JSON.stringify(Object.entries(widths)) : '')
    void (pinned ? JSON.stringify(Object.entries(pinned)) : '')

    if (controlledVisibility) model.syncVisibility(visibility)
    else if (wasVisibilityControlled) model.syncVisibility(uncontrolledVisibility)
    if (controlledOrder) model.syncOrder(order)
    else if (wasOrderControlled) model.syncOrder(uncontrolledOrder)
    if (controlledWidths) model.syncWidths(widths)
    else if (wasWidthsControlled) model.syncWidths(uncontrolledWidths)
    if (controlledPinned) model.syncPinned(pinned)
    else if (wasPinnedControlled) model.syncPinned(uncontrolledPinned)

    wasVisibilityControlled = controlledVisibility
    wasOrderControlled = controlledOrder
    wasWidthsControlled = controlledWidths
    wasPinnedControlled = controlledPinned
  })
  createEffect(() => {
    const current = internal()
    if (!wasVisibilityControlled) uncontrolledVisibility = { ...current.visibility }
    if (!wasOrderControlled) uncontrolledOrder = [...current.order]
    if (!wasWidthsControlled) uncontrolledWidths = { ...current.widths }
    if (!wasPinnedControlled) uncontrolledPinned = { ...current.pinned }
  })
  const rebase = (): void => {
    if (options.visibility !== undefined) model.syncVisibility(options.visibility)
    if (options.order !== undefined) model.syncOrder(options.order)
    if (options.widths !== undefined) model.syncWidths(options.widths)
    if (options.pinned !== undefined) model.syncPinned(options.pinned)
  }
  const apply = (write: () => void): void => {
    rebase()
    write()
    rebase()
  }
  return {
    model,
    state,
    setVisibility: (v) => apply(() => model.setVisibility(v)),
    toggleVisibility: (k) => apply(() => model.toggleVisibility(k)),
    setOrder: (v) => apply(() => model.setOrder(v)),
    clearOrder: () => apply(() => model.setOrder(undefined)),
    setWidths: (v) => apply(() => model.setWidths(v)),
    setWidth: (k, v) => apply(() => model.setWidth(k, v)),
    resetWidths: () => apply(() => model.setWidths({})),
    setPinned: (k, v) => apply(() => model.setPinned(k, v)),
  }
}

export interface UseGridPaginationOptions {
  page?: number
  defaultPage?: number
  pageSize?: number
  defaultPageSize?: number
  total?: number
  defaultTotal?: number
  onChange?: (change: GridPaginationChange) => void
}
function controlledPagination(options: UseGridPaginationOptions): Partial<GridPaginationState> {
  return {
    ...(options.page !== undefined ? { page: options.page } : {}),
    ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
    ...(options.total !== undefined ? { total: options.total } : {}),
  }
}
export function useGridPagination<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridPaginationOptions = {},
): {
  model: GridPaginationModel
  pagination: Accessor<GridPaginationState>
  setPage(page: number): void
  setPageSize(pageSize: number): void
  setPagination(page: number, pageSize: number): void
} {
  const latest = options
  const model = useGridFeature<Row, GridPaginationModel>(
    core,
    'pagination',
    'getPaginationModel',
    () =>
      createGridPaginationFeature<Row>({
        defaultPage: options.page ?? options.defaultPage,
        defaultPageSize: options.pageSize ?? options.defaultPageSize,
        defaultTotal: options.total ?? options.defaultTotal,
        onChange: (v) => latest.onChange?.(v),
      }),
  )
  const internal = useStore(model.store)
  const projection = createGridPaginationProjection(model, controlledPagination(options))
  createEffect(() => {
    projection.sync(controlledPagination(options))
  })
  onCleanup(() => projection.dispose())
  return {
    model,
    pagination: () => projection.project(internal(), controlledPagination(options)),
    setPage: (v) => {
      projection.sync(controlledPagination(options))
      model.setPage(v)
    },
    setPageSize: (v) => {
      projection.sync(controlledPagination(options))
      model.setPageSize(v)
    },
    setPagination: (page, size) => {
      projection.sync(controlledPagination(options))
      model.set(page, size)
    },
  }
}

export interface UseGridSortingOptions {
  mode?: 'single' | 'multiple'
  sort?: SortState | null
  defaultSort?: SortState | null
  onSortChange?: (sort: SortState | null) => void
  multiSortState?: SortState[]
  defaultMultiSort?: SortState[]
  onMultiSortChange?: (sorts: SortState[]) => void
}

function cloneSort(sort: SortState | null): SortState | null {
  return sort ? { ...sort } : null
}

function cloneSorts(sorts: readonly SortState[]): SortState[] {
  return sorts.map((sort) => ({ ...sort }))
}

export function useGridSorting<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridSortingOptions = {},
): {
  model: GridSortingModel
  sort: Accessor<SortState | null>
  multiSort: Accessor<SortState[]>
  cycleSort(key: string): void
  setSort(sort: SortState | null): void
  cycleMultiSort(key: string): void
  setMultiSort(sorts: SortState[]): void
} {
  const latest = options
  const model = useGridFeature<Row, GridSortingModel>(core, 'sorting', 'getSortingModel', () =>
    createGridSortingFeature<Row>({
      mode: options.mode,
      defaultSort: options.sort !== undefined ? options.sort : options.defaultSort,
      defaultMultiSort:
        options.multiSortState !== undefined ? options.multiSortState : options.defaultMultiSort,
      onSortChange: (v) => latest.onSortChange?.(v),
      onMultiSortChange: (v) => latest.onMultiSortChange?.(v),
    }),
  )
  const state = useStore(model.store)
  let wasSortControlled = options.sort !== undefined
  let hasUncontrolledSort = !wasSortControlled
  let uncontrolledSort = cloneSort(state().sort)
  let lastControlledSort = cloneSort(options.sort ?? null)
  let wasMultiSortControlled = options.multiSortState !== undefined
  let hasUncontrolledMultiSort = !wasMultiSortControlled
  let uncontrolledMultiSort = cloneSorts(state().multiSort)
  let lastControlledMultiSort = cloneSorts(options.multiSortState ?? [])

  createEffect(() => {
    const sort = options.sort
    const multiSortState = options.multiSortState
    const sortControlled = sort !== undefined
    const multiSortControlled = multiSortState !== undefined
    // Read nested fields so reactive prop proxies also observe in-place changes.
    void JSON.stringify(sort)
    void JSON.stringify(multiSortState)

    if (sortControlled) {
      lastControlledSort = cloneSort(sort ?? null)
      model.syncSort(sort)
    } else if (wasSortControlled) {
      const restore = hasUncontrolledSort ? uncontrolledSort : lastControlledSort
      if (!hasUncontrolledSort) {
        uncontrolledSort = cloneSort(restore)
        hasUncontrolledSort = true
      }
      model.syncSort(restore)
    }
    if (multiSortControlled) {
      lastControlledMultiSort = cloneSorts(multiSortState)
      model.syncMultiSort(multiSortState)
    } else if (wasMultiSortControlled) {
      const restore = hasUncontrolledMultiSort ? uncontrolledMultiSort : lastControlledMultiSort
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledMultiSort = cloneSorts(restore)
      hasUncontrolledMultiSort = true
      model.syncMultiSort(restore)
    }
    wasSortControlled = sortControlled
    wasMultiSortControlled = multiSortControlled
  })
  createEffect(() => {
    const current = state()
    if (!wasSortControlled) {
      uncontrolledSort = cloneSort(current.sort)
      hasUncontrolledSort = true
    }
    if (!wasMultiSortControlled) {
      uncontrolledMultiSort = cloneSorts(current.multiSort)
      hasUncontrolledMultiSort = true
    }
  })
  return {
    model,
    sort: () => {
      const sort = options.sort
      if (sort !== undefined) return cloneSort(sort)
      return cloneSort(
        wasSortControlled
          ? hasUncontrolledSort
            ? uncontrolledSort
            : lastControlledSort
          : state().sort,
      )
    },
    multiSort: () => {
      const multiSortState = options.multiSortState
      if (multiSortState !== undefined) return cloneSorts(multiSortState)
      return cloneSorts(
        wasMultiSortControlled
          ? hasUncontrolledMultiSort
            ? uncontrolledMultiSort
            : lastControlledMultiSort
          : state().multiSort,
      )
    },
    cycleSort: (key) => {
      const sort = options.sort
      if (sort !== undefined) model.syncSort(sort)
      model.cycleSort(key)
    },
    setSort: (v) => model.setSort(v),
    cycleMultiSort: (key) => {
      const multiSortState = options.multiSortState
      if (multiSortState !== undefined) model.syncMultiSort(multiSortState)
      model.cycleMultiSort(key)
    },
    setMultiSort: (v) => model.setMultiSort(v),
  }
}

export interface UseGridFilteringOptions {
  filters?: Record<string, string>
  defaultFilters?: Record<string, string>
  onFiltersChange?: (filters: Record<string, string>) => void
  filterValues?: GridFilterValues
  defaultFilterValues?: GridFilterValues
  onFilterValuesChange?: (values: GridFilterValues) => void
}

function cloneFilters(filters: Readonly<Record<string, string>>): Record<string, string> {
  return { ...filters }
}

function cloneFilterValues(filterValues: Readonly<GridFilterValues>): GridFilterValues {
  return Object.fromEntries(Object.entries(filterValues).map(([key, values]) => [key, [...values]]))
}

export function useGridFiltering<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridFilteringOptions = {},
): {
  model: GridFilteringModel
  filters: Accessor<Record<string, string>>
  filterValues: Accessor<GridFilterValues>
} {
  const latest = options
  const model = useGridFeature<Row, GridFilteringModel>(
    core,
    'filtering',
    'getFilteringModel',
    () =>
      createGridFilteringFeature<Row>({
        defaultFilters: options.filters !== undefined ? options.filters : options.defaultFilters,
        defaultFilterValues:
          options.filterValues !== undefined ? options.filterValues : options.defaultFilterValues,
        onFiltersChange: (v) => latest.onFiltersChange?.(v),
        onFilterValuesChange: (v) => latest.onFilterValuesChange?.(v),
      }),
  )
  const state = useStore(model.store)
  let wasFiltersControlled = options.filters !== undefined
  let hasUncontrolledFilters = !wasFiltersControlled
  let uncontrolledFilters = cloneFilters(state().filters)
  let lastControlledFilters = cloneFilters(options.filters ?? {})
  let wasFilterValuesControlled = options.filterValues !== undefined
  let hasUncontrolledFilterValues = !wasFilterValuesControlled
  let uncontrolledFilterValues = cloneFilterValues(state().filterValues)
  let lastControlledFilterValues = cloneFilterValues(options.filterValues ?? {})

  createEffect(() => {
    const filters = options.filters
    const filterValues = options.filterValues
    const filtersControlled = filters !== undefined
    const filterValuesControlled = filterValues !== undefined
    // Read nested fields so reactive prop proxies also observe in-place changes.
    void JSON.stringify(filters)
    void JSON.stringify(filterValues)

    if (filtersControlled) {
      lastControlledFilters = cloneFilters(filters)
      model.syncFilters(filters)
    } else if (wasFiltersControlled) {
      const restore = hasUncontrolledFilters ? uncontrolledFilters : lastControlledFilters
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledFilters = cloneFilters(restore)
      hasUncontrolledFilters = true
      model.syncFilters(restore)
    }
    if (filterValuesControlled) {
      lastControlledFilterValues = cloneFilterValues(filterValues)
      model.syncFilterValues(filterValues)
    } else if (wasFilterValuesControlled) {
      const restore = hasUncontrolledFilterValues
        ? uncontrolledFilterValues
        : lastControlledFilterValues
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledFilterValues = cloneFilterValues(restore)
      hasUncontrolledFilterValues = true
      model.syncFilterValues(restore)
    }
    wasFiltersControlled = filtersControlled
    wasFilterValuesControlled = filterValuesControlled
  })
  createEffect(() => {
    const current = state()
    if (!wasFiltersControlled) {
      uncontrolledFilters = cloneFilters(current.filters)
      hasUncontrolledFilters = true
    }
    if (!wasFilterValuesControlled) {
      uncontrolledFilterValues = cloneFilterValues(current.filterValues)
      hasUncontrolledFilterValues = true
    }
  })
  return {
    model,
    filters: () => {
      const filters = options.filters
      if (filters !== undefined) return cloneFilters(filters)
      return cloneFilters(
        wasFiltersControlled
          ? hasUncontrolledFilters
            ? uncontrolledFilters
            : lastControlledFilters
          : state().filters,
      )
    },
    filterValues: () => {
      const filterValues = options.filterValues
      if (filterValues !== undefined) return cloneFilterValues(filterValues)
      return cloneFilterValues(
        wasFilterValuesControlled
          ? hasUncontrolledFilterValues
            ? uncontrolledFilterValues
            : lastControlledFilterValues
          : state().filterValues,
      )
    },
  }
}

export interface UseGridVirtualOptions<Item> {
  items: readonly Item[]
  estimateSize: number | ((index: number) => number)
  viewportSize?: number
  scrollOffset?: number
  buffer?: number
  getItemKey?: (item: Item, index: number) => string | number
  onRangeChange?: (change: GridVirtualRangeChange) => void
}
export function useGridVirtual<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Item = Row,
>(
  core: GridCore<Row>,
  options: UseGridVirtualOptions<Item>,
): { model: GridVirtualModel; state: Accessor<VirtualizerState> } {
  const model = useGridFeature<Row, GridVirtualModel>(core, 'virtual', 'getVirtualModel', () =>
    createGridVirtualFeature<Row>({
      count: options.items.length,
      estimateSize: (index) => {
        const estimate = options.estimateSize
        return typeof estimate === 'function' ? estimate(index) : estimate
      },
      viewportSize: options.viewportSize,
      scrollOffset: options.scrollOffset,
      buffer: options.buffer,
      fixedSize: typeof options.estimateSize === 'number' ? options.estimateSize : null,
      getItemKey: (index) => {
        const item = options.items[index]
        return item !== undefined && options.getItemKey ? options.getItemKey(item, index) : index
      },
      onRangeChange: options.onRangeChange,
    }),
  )
  createEffect(() => model.setCount(options.items.length))
  createEffect(() => model.setBuffer(options.buffer ?? 0))
  createEffect(() => {
    const estimate = options.estimateSize
    model.setFixedSize(typeof estimate === 'number' ? estimate : null)
    model.remeasure()
  })
  createEffect(() => {
    const size = options.viewportSize
    if (size !== undefined) model.setViewportSize(size)
  })
  createEffect(() => {
    const offset = options.scrollOffset
    if (offset !== undefined) model.setScroll(offset)
  })
  return { model, state: useStore(model) }
}

export type { GridColumnPin, GridCore, GridFeature, GridRowsCommitOptions }
export {
  useGridClipboard,
  type UseGridClipboardOptions,
  type UseGridClipboardResult,
} from './useGridClipboard'
