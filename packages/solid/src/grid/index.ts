import { createEffect, onCleanup, onMount, type Accessor } from 'solid-js'
import {
  createGridColumnsFeature,
  createGridCore,
  createGridEditingFeature,
  createGridExpansionFeature,
  createGridFilteringFeature,
  createGridPaginationFeature,
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
import { useStore } from '../useStore'
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
      defaultSelected: options.value ?? options.defaultValue,
      getKeys: () => latest.getKeys?.() ?? [],
      onChange: (keys) => latest.onChange?.(keys),
    }),
  )
  const internal = useStore(model.store)
  const controlled = () => options.value !== undefined
  return {
    model,
    controlled,
    selection: () => {
      const current = internal()
      return controlled() ? (options.value ?? []) : current
    },
    rebase: () => {
      if (latest.value !== undefined) model.sync(latest.value)
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
  return { model, expandedKeys: useStore(model.store) }
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
  return { model, rows: useStore(model.store) }
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
  const state = useStore(model.store)
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
  const state = useStore(model.store)
  return {
    model,
    state,
    setVisibility: (v) => model.setVisibility(v),
    toggleVisibility: (k) => model.toggleVisibility(k),
    setOrder: (v) => model.setOrder(v),
    clearOrder: () => model.setOrder(undefined),
    setWidths: (v) => model.setWidths(v),
    setWidth: (k, v) => model.setWidth(k, v),
    resetWidths: () => model.setWidths({}),
    setPinned: (k, v) => model.setPinned(k, v),
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
  return {
    model,
    pagination: useStore(model.store),
    setPage: (v) => model.setPage(v),
    setPageSize: (v) => model.setPageSize(v),
    setPagination: (page, size) => model.set(page, size),
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
      defaultSort: options.sort ?? options.defaultSort,
      defaultMultiSort: options.multiSortState ?? options.defaultMultiSort,
      onSortChange: (v) => latest.onSortChange?.(v),
      onMultiSortChange: (v) => latest.onMultiSortChange?.(v),
    }),
  )
  const state = useStore(model.store)
  return {
    model,
    sort: () => (options.sort !== undefined ? options.sort : state().sort),
    multiSort: () =>
      options.multiSortState !== undefined ? options.multiSortState : state().multiSort,
    cycleSort: (key) => model.cycleSort(key),
    setSort: (v) => model.setSort(v),
    cycleMultiSort: (key) => model.cycleMultiSort(key),
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
        defaultFilters: options.filters ?? options.defaultFilters,
        defaultFilterValues: options.filterValues ?? options.defaultFilterValues,
        onFiltersChange: (v) => latest.onFiltersChange?.(v),
        onFilterValuesChange: (v) => latest.onFilterValuesChange?.(v),
      }),
  )
  const state = useStore(model.store)
  return {
    model,
    filters: () => options.filters ?? state().filters,
    filterValues: () => options.filterValues ?? state().filterValues,
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
  return { model, state: useStore(model.store) }
}

export type { GridColumnPin, GridCore, GridFeature, GridRowsCommitOptions }
export {
  useGridClipboard,
  type UseGridClipboardOptions,
  type UseGridClipboardResult,
} from './useGridClipboard'
