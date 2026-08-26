import { onDestroy, onMount } from 'svelte'
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
  type GridRowKey,
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
import type { ExpansionModel } from '@iris-ui-kit/core'
import type { CellEditState } from '@iris-ui-kit/core'
import { toStore } from '../useStore'
import type { Readable } from 'svelte/store'

export interface UseGridCoreOptions<Row extends Record<string, unknown>> {
  readonly features?: readonly GridFeature<Row>[]
}

/** Svelte lifecycle bridge. Call from a component script; SSR stays created until mount. */
export function useGridCore<Row extends Record<string, unknown> = Record<string, unknown>>(
  options: UseGridCoreOptions<Row> = {},
): GridCore<Row> {
  const core = createGridCore(options)
  onMount(() => core.ready())
  onDestroy(() => core.destroy())
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
export function useGridSelection<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends SelectionKey = string,
>(
  core: GridCore<Row>,
  options: UseGridSelectionOptions<K> = {},
): {
  model: SelectionModel<K>
  selection: Readable<K[]>
  controlled: boolean
} {
  const model = useGridFeature<Row, SelectionModel<K>>(core, 'selection', 'getSelectionModel', () =>
    createGridSelectionFeature<Row, K>({
      mode: options.mode,
      defaultSelected: options.value ?? options.defaultValue,
      getKeys: options.getKeys,
      onChange: options.onChange,
    }),
  )
  return { model, selection: toStore(model.store), controlled: options.value !== undefined }
}

export interface UseGridExpansionOptions<K extends GridExpansionKey = string> {
  mode?: 'single' | 'multiple'
  defaultValue?: K[]
  onChange?: (keys: K[]) => void
  getKeys?: () => readonly K[]
}
export function useGridExpansion<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends GridExpansionKey = string,
>(
  core: GridCore<Row>,
  options: UseGridExpansionOptions<K> = {},
): {
  model: ExpansionModel<K>
  expandedKeys: Readable<K[]>
} {
  const model = useGridFeature<Row, ExpansionModel<K>>(core, 'expansion', 'getExpansionModel', () =>
    createGridExpansionFeature<Row, K>({
      mode: options.mode,
      defaultExpanded: options.defaultValue,
      getKeys: options.getKeys,
      onChange: options.onChange,
    }),
  )
  return { model, expandedKeys: toStore(model.store) }
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
): { model: GridRowsModel<Row, Meta>; rows: Readable<Row[]> } {
  const model = useGridFeature<Row, GridRowsModel<Row, Meta>>(core, 'rows', 'getRowsModel', () =>
    createGridRowsFeature<Row, Meta>({
      defaultRows: initialRows,
      cloneDefaultRows: options.cloneDefaultRows,
      rowKeyField: options.rowKeyField,
      getRowKey: options.getRowKey,
      getChildren: options.getChildren,
      setChildren: options.setChildren,
      onBeforeRowsChange: options.onBeforeRowsChange,
      onRowsChange: options.onRowsChange,
    }),
  )
  return { model, rows: toStore(model.store) }
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
  state: Readable<CellEditState<GridEditingKey>>
  startCellEdit(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): boolean
  setCellDraft(value: unknown): void
  cancelCellEdit(): void
  commitCellEdit(value?: unknown): boolean
  isCellEditing(rowKey: GridEditingKey, columnKey: string): boolean
}

/** Installs the framework-independent editing feature and bridges its state into Svelte. */
export function useGridEditing<Row extends Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridEditingOptions<Row>,
): UseGridEditingResult<Row> {
  const model = useGridFeature<Row, GridEditingModel>(core, 'editing', 'getEditingModel', () =>
    createGridEditingFeature<Row>({
      getRowKey: options.getRowKey,
      getRowIndex: options.getRowIndex,
      getRules: options.getRules,
      getValue: (row, columnKey) => options.getValue?.(row, columnKey) ?? row[columnKey],
      setValue: (row, columnKey, value) =>
        options.setValue?.(row, columnKey, value) ?? { ...row, [columnKey]: value },
      coerce: options.coerce,
      validate: options.validate,
      isEditable: options.isEditable,
      missingRowMessage: options.missingRowMessage,
      commitOptions: options.commitOptions,
      onStateChange: options.onStateChange,
      onValidation: options.onValidation,
      onCommit: options.onCommit,
    }),
  )
  return {
    core,
    model,
    state: toStore(model.store),
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
  onOrderChange?: (value: string[] | undefined) => void
  widths?: Record<string, number>
  defaultWidths?: Record<string, number>
  onWidthsChange?: (value: Record<string, number>) => void
  pinned?: Record<string, GridColumnPin>
  defaultPinned?: Record<string, GridColumnPin>
  onPinnedChange?: (key: string, side: GridColumnPin) => void
}
export function useGridColumns<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridColumnsOptions = {},
): { model: GridColumnsModel; state: Readable<ReturnType<GridColumnsModel['get']>> } & {
  setVisibility(value: Record<string, boolean>): void
  toggleVisibility(key: string): void
  setOrder(value: string[] | undefined): void
  clearOrder(): void
  setWidths(value: Record<string, number>): void
  setWidth(key: string, width: number): void
  resetWidths(): void
  setPinned(key: string, side: GridColumnPin): void
} {
  const model = useGridFeature<Row, GridColumnsModel>(core, 'columns', 'getColumnsModel', () =>
    createGridColumnsFeature<Row>({
      defaultVisibility: options.visibility ?? options.defaultVisibility,
      defaultOrder: options.order ?? options.defaultOrder,
      defaultWidths: options.widths ?? options.defaultWidths,
      defaultPinned: options.pinned ?? options.defaultPinned,
      onVisibilityChange: options.onVisibilityChange,
      onOrderChange: options.onOrderChange,
      onWidthsChange: options.onWidthsChange,
      onPinnedChange: options.onPinnedChange,
    }),
  )
  return {
    model,
    state: toStore(model.store),
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
): { model: GridPaginationModel; pagination: Readable<ReturnType<GridPaginationModel['get']>> } & {
  setPage(page: number): void
  setPageSize(pageSize: number): void
  setPagination(page: number, pageSize: number): void
} {
  const model = useGridFeature<Row, GridPaginationModel>(
    core,
    'pagination',
    'getPaginationModel',
    () =>
      createGridPaginationFeature<Row>({
        defaultPage: options.page ?? options.defaultPage,
        defaultPageSize: options.pageSize ?? options.defaultPageSize,
        defaultTotal: options.total ?? options.defaultTotal,
        onChange: options.onChange,
      }),
  )
  return {
    model,
    pagination: toStore(model.store),
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
  sort: Readable<SortState | null>
  multiSort: Readable<SortState[]>
} & {
  cycleSort(key: string): void
  setSort(sort: SortState | null): void
  cycleMultiSort(key: string): void
  setMultiSort(sorts: SortState[]): void
} {
  const model = useGridFeature<Row, GridSortingModel>(core, 'sorting', 'getSortingModel', () =>
    createGridSortingFeature<Row>({
      mode: options.mode,
      defaultSort: options.sort ?? options.defaultSort,
      defaultMultiSort: options.multiSortState ?? options.defaultMultiSort,
      onSortChange: options.onSortChange,
      onMultiSortChange: options.onMultiSortChange,
    }),
  )
  const state = toStore(model.store)
  return {
    model,
    sort: {
      subscribe: (run) =>
        state.subscribe((v) => run(options.sort !== undefined ? options.sort : v.sort)),
    },
    multiSort: {
      subscribe: (run) =>
        state.subscribe((v) =>
          run(options.multiSortState !== undefined ? options.multiSortState : v.multiSort),
        ),
    },
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
  filters: Readable<Record<string, string>>
  filterValues: Readable<GridFilterValues>
} {
  const model = useGridFeature<Row, GridFilteringModel>(
    core,
    'filtering',
    'getFilteringModel',
    () =>
      createGridFilteringFeature<Row>({
        defaultFilters: options.filters ?? options.defaultFilters,
        defaultFilterValues: options.filterValues ?? options.defaultFilterValues,
        onFiltersChange: options.onFiltersChange,
        onFilterValuesChange: options.onFilterValuesChange,
      }),
  )
  const state = toStore(model.store)
  return {
    model,
    filters: { subscribe: (run) => state.subscribe((v) => run(options.filters ?? v.filters)) },
    filterValues: {
      subscribe: (run) => state.subscribe((v) => run(options.filterValues ?? v.filterValues)),
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
): { model: GridVirtualModel; state: Readable<VirtualizerState> } {
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
  return { model, state: toStore(model.store) }
}

export type { GridColumnPin, GridCore, GridFeature }
