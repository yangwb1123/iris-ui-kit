import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type ComputedRef,
  type ShallowRef,
} from 'vue'
import {
  createGridColumnsFeature,
  createGridCore,
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
  type GridFilteringModel,
  type GridPaginationChange,
  type GridPaginationModel,
  type GridPaginationState,
  type GridRowKey,
  type GridRowsCommitOptions,
  type GridRowsModel,
  type GridRowsTransaction,
  type SelectionModel,
  type SelectionKey,
  type SelectionMode,
  type GridSortingModel,
  type GridVirtualModel,
  type GridVirtualRangeChange,
  type VirtualizerState,
  type SortState,
} from '@iris-ui-kit/core/grid'
import type { ExpansionModel } from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseGridCoreOptions<Row extends Record<string, unknown>> {
  readonly features?: readonly GridFeature<Row>[]
}

/** Vue lifecycle bridge for one framework-independent Grid Core instance. */
export function useGridCore<Row extends Record<string, unknown> = Record<string, unknown>>(
  options: UseGridCoreOptions<Row> = {},
): GridCore<Row> {
  const core = createGridCore(options)
  onMounted(() => core.ready())
  onBeforeUnmount(() => core.destroy())
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
  selection: ComputedRef<K[]>
  controlled: ComputedRef<boolean>
}
export function useGridSelection<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends SelectionKey = string,
>(core: GridCore<Row>, options: UseGridSelectionOptions<K> = {}): UseGridSelectionResult<K> {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, SelectionModel<K>>(core, 'selection', 'getSelectionModel', () =>
    createGridSelectionFeature<Row, K>({
      mode: options.mode,
      defaultSelected: options.value ?? options.defaultValue,
      getKeys: () => latest.value.getKeys?.() ?? [],
      onChange: (keys) => latest.value.onChange?.(keys),
    }),
  )
  const state = useStore(model.store)
  const controlled = computed(() => options.value !== undefined)
  watch(
    () => options.value,
    (value) => {
      if (value !== undefined) model.sync(value)
    },
    { immediate: true },
  )
  return {
    model,
    controlled,
    selection: computed(() => (controlled.value ? (options.value ?? []) : state.value)),
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
  expandedKeys: ShallowRef<K[]>
}
export function useGridExpansion<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends GridExpansionKey = string,
>(core: GridCore<Row>, options: UseGridExpansionOptions<K> = {}): UseGridExpansionResult<K> {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, ExpansionModel<K>>(core, 'expansion', 'getExpansionModel', () =>
    createGridExpansionFeature<Row, K>({
      mode: options.mode,
      defaultExpanded: options.defaultValue,
      getKeys: () => latest.value.getKeys?.() ?? [],
      onChange: (keys) => latest.value.onChange?.(keys),
    }),
  )
  return { model, expandedKeys: useStore(model.store) as ShallowRef<K[]> }
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
export interface UseGridRowsResult<Row extends Record<string, unknown>, Meta = unknown> {
  model: GridRowsModel<Row, Meta>
  rows: ShallowRef<Row[]>
}
export function useGridRows<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Meta = unknown,
>(
  core: GridCore<Row>,
  initialRows: readonly Row[],
  options: UseGridRowsOptions<Row, Meta> = {},
): UseGridRowsResult<Row, Meta> {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridRowsModel<Row, Meta>>(core, 'rows', 'getRowsModel', () =>
    createGridRowsFeature<Row, Meta>({
      defaultRows: initialRows,
      cloneDefaultRows: options.cloneDefaultRows,
      rowKeyField: options.rowKeyField,
      getRowKey: (row, index) => latest.value.getRowKey?.(row, index),
      getChildren: options.getChildren,
      setChildren: options.setChildren,
      onBeforeRowsChange: (tx) => latest.value.onBeforeRowsChange?.(tx),
      onRowsChange: (tx) => latest.value.onRowsChange?.(tx),
    }),
  )
  return { model, rows: useStore(model.store) as ShallowRef<Row[]> }
}

export interface UseGridColumnsOptions {
  visibility?: Record<string, boolean>
  defaultVisibility?: Record<string, boolean>
  onVisibilityChange?: (value: Record<string, boolean>) => void
  order?: string[]
  defaultOrder?: string[]
  orderControlled?: boolean
  onOrderChange?: (value: string[] | undefined) => void
  widths?: Record<string, number>
  defaultWidths?: Record<string, number>
  onWidthsChange?: (value: Record<string, number>) => void
  pinned?: Record<string, GridColumnPin>
  defaultPinned?: Record<string, GridColumnPin>
  onPinnedChange?: (key: string, side: GridColumnPin) => void
}
export interface UseGridColumnsResult {
  model: GridColumnsModel
  state: ShallowRef<GridColumnsState>
  setVisibility(value: Record<string, boolean>): void
  toggleVisibility(key: string): void
  setOrder(value: string[] | undefined): void
  clearOrder(): void
  setWidth(key: string, width: number): void
  setWidths(value: Record<string, number>): void
  resetWidths(): void
  setPinned(key: string, side: GridColumnPin): void
}
export function useGridColumns<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridColumnsOptions = {},
): UseGridColumnsResult {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridColumnsModel>(core, 'columns', 'getColumnsModel', () =>
    createGridColumnsFeature<Row>({
      defaultVisibility: options.visibility ?? options.defaultVisibility,
      defaultOrder: options.order ?? options.defaultOrder,
      defaultWidths: options.widths ?? options.defaultWidths,
      defaultPinned: options.pinned ?? options.defaultPinned,
      onVisibilityChange: (v) => latest.value.onVisibilityChange?.(v),
      onOrderChange: (v) => latest.value.onOrderChange?.(v),
      onWidthsChange: (v) => latest.value.onWidthsChange?.(v),
      onPinnedChange: (k, v) => latest.value.onPinnedChange?.(k, v),
    }),
  )
  const state = useStore(model.store)
  watch(
    () => options.visibility,
    (v) => v !== undefined && model.syncVisibility(v),
  )
  watch(
    () => options.order,
    (v) => v !== undefined && model.syncOrder(v),
  )
  watch(
    () => options.widths,
    (v) => v !== undefined && model.syncWidths(v),
  )
  watch(
    () => options.pinned,
    (v) => v !== undefined && model.syncPinned(v),
  )
  return {
    model,
    state,
    setVisibility: (v) => model.setVisibility(v),
    toggleVisibility: (k) => model.toggleVisibility(k),
    setOrder: (v) => model.setOrder(v),
    clearOrder: () => model.setOrder(undefined),
    setWidth: (k, v) => model.setWidth(k, v),
    setWidths: (v) => model.setWidths(v),
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
export interface UseGridPaginationResult {
  model: GridPaginationModel
  pagination: ShallowRef<GridPaginationState>
  setPage(page: number): void
  setPageSize(pageSize: number): void
  setPagination(page: number, pageSize: number): void
}
export function useGridPagination<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridPaginationOptions = {},
): UseGridPaginationResult {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridPaginationModel>(
    core,
    'pagination',
    'getPaginationModel',
    () =>
      createGridPaginationFeature<Row>({
        defaultPage: options.page ?? options.defaultPage,
        defaultPageSize: options.pageSize ?? options.defaultPageSize,
        defaultTotal: options.total ?? options.defaultTotal,
        onChange: (change) => latest.value.onChange?.(change),
      }),
  )
  const pagination = useStore(model.store)
  watch(
    () => [options.page, options.pageSize, options.total] as const,
    ([page, pageSize, total]) => model.sync({ page, pageSize, total }),
    { immediate: true },
  )
  return {
    model,
    pagination,
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
export interface UseGridSortingResult {
  model: GridSortingModel
  sort: ComputedRef<SortState | null>
  multiSort: ComputedRef<SortState[]>
  cycleSort(key: string): void
  setSort(sort: SortState | null): void
  cycleMultiSort(key: string): void
  setMultiSort(sorts: SortState[]): void
}
export function useGridSorting<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridSortingOptions = {},
): UseGridSortingResult {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridSortingModel>(core, 'sorting', 'getSortingModel', () =>
    createGridSortingFeature<Row>({
      mode: options.mode,
      defaultSort: options.sort ?? options.defaultSort,
      defaultMultiSort: options.multiSortState ?? options.defaultMultiSort,
      onSortChange: (v) => latest.value.onSortChange?.(v),
      onMultiSortChange: (v) => latest.value.onMultiSortChange?.(v),
    }),
  )
  const state = useStore(model.store)
  watch(
    () => options.sort,
    (v) => v !== undefined && model.syncSort(v),
  )
  watch(
    () => options.multiSortState,
    (v) => v !== undefined && model.syncMultiSort(v),
  )
  return {
    model,
    sort: computed(() => (options.sort !== undefined ? options.sort : state.value.sort)),
    multiSort: computed(() =>
      options.multiSortState !== undefined ? options.multiSortState : state.value.multiSort,
    ),
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
export interface UseGridFilteringResult {
  model: GridFilteringModel
  filters: ComputedRef<Record<string, string>>
  filterValues: ComputedRef<GridFilterValues>
}
export function useGridFiltering<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridFilteringOptions = {},
): UseGridFilteringResult {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridFilteringModel>(
    core,
    'filtering',
    'getFilteringModel',
    () =>
      createGridFilteringFeature<Row>({
        defaultFilters: options.filters ?? options.defaultFilters,
        defaultFilterValues: options.filterValues ?? options.defaultFilterValues,
        onFiltersChange: (v) => latest.value.onFiltersChange?.(v),
        onFilterValuesChange: (v) => latest.value.onFilterValuesChange?.(v),
      }),
  )
  const state = useStore(model.store)
  watch(
    () => options.filters,
    (v) => v !== undefined && model.syncFilters(v),
  )
  watch(
    () => options.filterValues,
    (v) => v !== undefined && model.syncFilterValues(v),
  )
  return {
    model,
    filters: computed(() => options.filters ?? state.value.filters),
    filterValues: computed(() => options.filterValues ?? state.value.filterValues),
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
export interface UseGridVirtualResult {
  model: GridVirtualModel
  state: ShallowRef<VirtualizerState>
}
export function useGridVirtual<
  Row extends Record<string, unknown> = Record<string, unknown>,
  Item = Row,
>(core: GridCore<Row>, options: UseGridVirtualOptions<Item>): UseGridVirtualResult {
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
  watch(
    () => options.items,
    (items) => model.setCount(items.length),
  )
  watch(
    () => options.buffer,
    (buffer) => model.setBuffer(buffer ?? 0),
  )
  watch(
    () => options.estimateSize,
    (estimate) => {
      model.setFixedSize(typeof estimate === 'number' ? estimate : null)
      model.remeasure()
    },
  )
  watch(
    () => options.viewportSize,
    (size) => size !== undefined && model.setViewportSize(size),
  )
  watch(
    () => options.scrollOffset,
    (offset) => offset !== undefined && model.setScroll(offset),
  )
  return { model, state: useStore(model.store) }
}

export type { GridColumnPin, GridCore, GridFeature, GridRowsCommitOptions }
export {
  useGridClipboard,
  type UseGridClipboardOptions,
  type UseGridClipboardResult,
} from './useGridClipboard'
export {
  useGridEditing,
  type UseGridEditingOptions,
  type UseGridEditingResult,
} from './useGridEditing'
export { useGridRange, type UseGridRangeOptions, type UseGridRangeResult } from './useGridRange'
