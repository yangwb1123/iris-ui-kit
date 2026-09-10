import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
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
import { useStore, useStoreSelector } from '../useStore'

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
  rebase(): void
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
  let wasControlled = controlled.value
  let hasUncontrolledSnapshot = !wasControlled
  const uncontrolledSnapshot = ref<K[]>(wasControlled ? [] : [...state.value])
  const lastControlledSnapshot = ref<K[]>([...(options.value ?? [])])
  watch(
    () => (options.value === undefined ? undefined : [...options.value]),
    (value) => {
      const nextControlled = value !== undefined
      if (nextControlled) {
        lastControlledSnapshot.value = [...value]
        model.sync(value)
      } else if (wasControlled) {
        const restore = (
          hasUncontrolledSnapshot ? uncontrolledSnapshot.value : lastControlledSnapshot.value
        ) as K[]
        if (!hasUncontrolledSnapshot) {
          uncontrolledSnapshot.value = [...restore]
          hasUncontrolledSnapshot = true
        }
        model.sync(restore)
      }
      wasControlled = nextControlled
    },
    { immediate: true },
  )
  watch(state, (value) => {
    if (!wasControlled) {
      uncontrolledSnapshot.value = [...value]
      hasUncontrolledSnapshot = true
    }
  })
  const rebase = (): void => {
    const value = options.value
    if (value !== undefined) model.sync(value)
  }
  return {
    model,
    controlled,
    selection: computed(() => (controlled.value ? [...(options.value ?? [])] : [...state.value])),
    rebase,
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
  expandedKeys: ComputedRef<K[]>
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
  const state = useStore(model.store)
  return { model, expandedKeys: computed(() => [...state.value]) }
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
  return {
    model,
    rows: useStoreSelector(model.store, (current) => [...current]) as ShallowRef<Row[]>,
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
  const state = useStoreSelector(model.store, (current) =>
    cloneGridColumnsState(current),
  ) as ShallowRef<GridColumnsState>
  const uncontrolledVisibility = shallowRef({ ...(options.defaultVisibility ?? {}) })
  const uncontrolledOrder = shallowRef([...(options.defaultOrder ?? [])])
  const uncontrolledWidths = shallowRef({ ...(options.defaultWidths ?? {}) })
  const uncontrolledPinned = shallowRef({ ...(options.defaultPinned ?? {}) })
  const visibilityPropControlled = ref(options.visibility !== undefined)
  const orderPropControlled = ref(options.orderControlled ?? options.order !== undefined)
  const widthsPropControlled = ref(options.widths !== undefined)
  const pinnedPropControlled = ref(options.pinned !== undefined)
  const rebaseControlled = (): void => {
    const current = latest.value
    if (visibilityPropControlled.value && current.visibility !== undefined)
      model.syncVisibility(current.visibility)
    if (orderPropControlled.value) model.syncOrder(current.order ?? [])
    if (widthsPropControlled.value && current.widths !== undefined) model.syncWidths(current.widths)
    if (pinnedPropControlled.value && current.pinned !== undefined) model.syncPinned(current.pinned)
  }

  watch(
    state,
    (current) => {
      if (!visibilityPropControlled.value) uncontrolledVisibility.value = { ...current.visibility }
      if (!orderPropControlled.value) uncontrolledOrder.value = [...current.order]
      if (!widthsPropControlled.value) uncontrolledWidths.value = { ...current.widths }
      if (!pinnedPropControlled.value) uncontrolledPinned.value = { ...current.pinned }

      rebaseControlled()
    },
    { flush: 'sync' },
  )
  watch(
    () => options.visibility,
    (value) => {
      const wasControlled = visibilityPropControlled.value
      const controlled = value !== undefined
      visibilityPropControlled.value = controlled
      if (controlled) model.syncVisibility(value)
      else if (wasControlled) model.syncVisibility(uncontrolledVisibility.value)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => ({
      controlled: options.orderControlled ?? options.order !== undefined,
      value: options.order,
    }),
    ({ controlled, value }) => {
      const wasControlled = orderPropControlled.value
      orderPropControlled.value = controlled
      if (controlled) model.syncOrder(value ?? [])
      else if (wasControlled) model.syncOrder(uncontrolledOrder.value)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => options.widths,
    (value) => {
      const wasControlled = widthsPropControlled.value
      widthsPropControlled.value = value !== undefined
      if (value !== undefined) model.syncWidths(value)
      else if (wasControlled) model.syncWidths(uncontrolledWidths.value)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => options.pinned,
    (value) => {
      const wasControlled = pinnedPropControlled.value
      pinnedPropControlled.value = value !== undefined
      if (value !== undefined) model.syncPinned(value)
      else if (wasControlled) model.syncPinned(uncontrolledPinned.value)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  const apply = (write: () => void): void => {
    rebaseControlled()
    write()
    rebaseControlled()
  }
  return {
    model,
    state,
    setVisibility: (v) => apply(() => model.setVisibility(v)),
    toggleVisibility: (k) => apply(() => model.toggleVisibility(k)),
    setOrder: (v) => apply(() => model.setOrder(v)),
    clearOrder: () => apply(() => model.setOrder(undefined)),
    setWidth: (k, v) => apply(() => model.setWidth(k, v)),
    setWidths: (v) => apply(() => model.setWidths(v)),
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
  const state = useStore(model.store)
  const controlledState = (): Partial<GridPaginationState> => ({
    ...(options.page !== undefined ? { page: options.page } : {}),
    ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
    ...(options.total !== undefined ? { total: options.total } : {}),
  })
  const projection = createGridPaginationProjection(model, controlledState())
  watch(
    () => [options.page, options.pageSize, options.total] as const,
    () => projection.sync(controlledState()),
    { immediate: true, flush: 'sync' },
  )
  onBeforeUnmount(() => projection.dispose())
  const pagination = computed(() => projection.project(state.value, controlledState()))
  return {
    model,
    pagination,
    setPage: (v) => {
      projection.sync(controlledState())
      model.setPage(v)
    },
    setPageSize: (v) => {
      projection.sync(controlledState())
      model.setPageSize(v)
    },
    setPagination: (page, size) => {
      projection.sync(controlledState())
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
export interface UseGridSortingResult {
  model: GridSortingModel
  sort: ComputedRef<SortState | null>
  multiSort: ComputedRef<SortState[]>
  cycleSort(key: string): void
  setSort(sort: SortState | null): void
  cycleMultiSort(key: string): void
  setMultiSort(sorts: SortState[]): void
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
): UseGridSortingResult {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridSortingModel>(core, 'sorting', 'getSortingModel', () =>
    createGridSortingFeature<Row>({
      mode: options.mode,
      defaultSort: options.sort !== undefined ? options.sort : options.defaultSort,
      defaultMultiSort:
        options.multiSortState !== undefined ? options.multiSortState : options.defaultMultiSort,
      onSortChange: (v) => latest.value.onSortChange?.(v),
      onMultiSortChange: (v) => latest.value.onMultiSortChange?.(v),
    }),
  )
  const state = useStore(model.store)
  let wasSortControlled = options.sort !== undefined
  let hasUncontrolledSort = !wasSortControlled
  const uncontrolledSort = shallowRef<SortState | null>(
    wasSortControlled ? null : cloneSort(state.value.sort),
  )
  const lastControlledSort = shallowRef<SortState | null>(cloneSort(options.sort ?? null))
  let wasMultiSortControlled = options.multiSortState !== undefined
  let hasUncontrolledMultiSort = !wasMultiSortControlled
  const uncontrolledMultiSort = shallowRef<SortState[]>(
    wasMultiSortControlled ? [] : cloneSorts(state.value.multiSort),
  )
  const lastControlledMultiSort = shallowRef<SortState[]>(cloneSorts(options.multiSortState ?? []))

  watch(
    state,
    (current) => {
      if (!wasSortControlled) {
        uncontrolledSort.value = cloneSort(current.sort)
        hasUncontrolledSort = true
      }
      if (!wasMultiSortControlled) {
        uncontrolledMultiSort.value = cloneSorts(current.multiSort)
        hasUncontrolledMultiSort = true
      }
    },
    { flush: 'sync' },
  )
  watch(
    () => options.sort,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasSortControlled
      wasSortControlled = controlled
      if (controlled) {
        lastControlledSort.value = cloneSort(value ?? null)
        model.syncSort(value ?? null)
      } else if (wasControlled) {
        const restore = hasUncontrolledSort ? uncontrolledSort.value : lastControlledSort.value
        if (!hasUncontrolledSort) {
          uncontrolledSort.value = cloneSort(restore)
          hasUncontrolledSort = true
        }
        model.syncSort(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => options.multiSortState,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasMultiSortControlled
      wasMultiSortControlled = controlled
      if (controlled) {
        // Preserve model updates batched with the transition into control.
        if (!wasControlled) {
          uncontrolledMultiSort.value = cloneSorts(state.value.multiSort)
          hasUncontrolledMultiSort = true
        }
        lastControlledMultiSort.value = cloneSorts(value ?? [])
        model.syncMultiSort(value ?? [])
      } else if (wasControlled) {
        const restore = hasUncontrolledMultiSort
          ? uncontrolledMultiSort.value
          : lastControlledMultiSort.value
        // A no-op Core sync still establishes the handoff as the next
        // uncontrolled baseline for a later controlled detour.
        uncontrolledMultiSort.value = cloneSorts(restore)
        hasUncontrolledMultiSort = true
        model.syncMultiSort(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  return {
    model,
    sort: computed(() => {
      const value = options.sort
      const current = state.value
      if (value !== undefined) return cloneSort(value)
      return cloneSort(
        wasSortControlled
          ? hasUncontrolledSort
            ? uncontrolledSort.value
            : lastControlledSort.value
          : current.sort,
      )
    }),
    multiSort: computed(() => {
      const value = options.multiSortState
      const current = state.value
      if (value !== undefined) return cloneSorts(value ?? [])
      return cloneSorts(
        wasMultiSortControlled
          ? hasUncontrolledMultiSort
            ? uncontrolledMultiSort.value
            : lastControlledMultiSort.value
          : current.multiSort,
      )
    }),
    cycleSort: (key) => {
      const value = options.sort
      if (value !== undefined) model.syncSort(value)
      model.cycleSort(key)
    },
    setSort: (v) => model.setSort(v),
    cycleMultiSort: (key) => {
      const value = options.multiSortState
      if (value !== undefined) model.syncMultiSort(value)
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

function cloneFilters(
  filters: Readonly<Record<string, string>> | null | undefined,
): Record<string, string> {
  return { ...(filters ?? {}) }
}

function cloneFilterValues(
  filterValues: Readonly<GridFilterValues> | null | undefined,
): GridFilterValues {
  return Object.fromEntries(
    Object.entries(filterValues ?? {}).map(([key, values]) => [key, [...values]]),
  )
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
        defaultFilters:
          options.filters !== undefined ? (options.filters ?? {}) : options.defaultFilters,
        defaultFilterValues:
          options.filterValues !== undefined
            ? (options.filterValues ?? {})
            : options.defaultFilterValues,
        onFiltersChange: (v) => latest.value.onFiltersChange?.(v),
        onFilterValuesChange: (v) => latest.value.onFilterValuesChange?.(v),
      }),
  )
  const state = useStore(model.store)
  let wasFiltersControlled = options.filters !== undefined
  let hasUncontrolledFilters = !wasFiltersControlled
  const uncontrolledFilters = shallowRef<Record<string, string>>(
    wasFiltersControlled ? {} : cloneFilters(state.value.filters),
  )
  const lastControlledFilters = shallowRef<Record<string, string>>(cloneFilters(options.filters))
  let wasFilterValuesControlled = options.filterValues !== undefined
  let hasUncontrolledFilterValues = !wasFilterValuesControlled
  const uncontrolledFilterValues = shallowRef<GridFilterValues>(
    wasFilterValuesControlled ? {} : cloneFilterValues(state.value.filterValues),
  )
  const lastControlledFilterValues = shallowRef<GridFilterValues>(
    cloneFilterValues(options.filterValues),
  )

  watch(
    state,
    (current) => {
      if (!wasFiltersControlled) {
        uncontrolledFilters.value = cloneFilters(current.filters)
        hasUncontrolledFilters = true
      }
      if (!wasFilterValuesControlled) {
        uncontrolledFilterValues.value = cloneFilterValues(current.filterValues)
        hasUncontrolledFilterValues = true
      }
    },
    { flush: 'sync' },
  )
  watch(
    () => options.filters,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasFiltersControlled
      wasFiltersControlled = controlled
      if (controlled) {
        // Preserve model updates batched with the transition into control.
        if (!wasControlled) {
          uncontrolledFilters.value = cloneFilters(state.value.filters)
          hasUncontrolledFilters = true
        }
        lastControlledFilters.value = cloneFilters(value)
        model.syncFilters(value ?? {})
      } else if (wasControlled) {
        const restore = hasUncontrolledFilters
          ? uncontrolledFilters.value
          : lastControlledFilters.value
        // A no-op Core sync still establishes the handoff as the next
        // uncontrolled baseline for a later controlled detour.
        uncontrolledFilters.value = cloneFilters(restore)
        hasUncontrolledFilters = true
        model.syncFilters(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => options.filterValues,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasFilterValuesControlled
      wasFilterValuesControlled = controlled
      if (controlled) {
        // Preserve model updates batched with the transition into control.
        if (!wasControlled) {
          uncontrolledFilterValues.value = cloneFilterValues(state.value.filterValues)
          hasUncontrolledFilterValues = true
        }
        lastControlledFilterValues.value = cloneFilterValues(value)
        model.syncFilterValues(value ?? {})
      } else if (wasControlled) {
        const restore = hasUncontrolledFilterValues
          ? uncontrolledFilterValues.value
          : lastControlledFilterValues.value
        // A no-op Core sync still establishes the handoff as the next
        // uncontrolled baseline for a later controlled detour.
        uncontrolledFilterValues.value = cloneFilterValues(restore)
        hasUncontrolledFilterValues = true
        model.syncFilterValues(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  return {
    model,
    filters: computed(() => {
      const value = options.filters
      const current = state.value
      if (value !== undefined) return cloneFilters(value)
      return cloneFilters(
        wasFiltersControlled
          ? hasUncontrolledFilters
            ? uncontrolledFilters.value
            : lastControlledFilters.value
          : current.filters,
      )
    }),
    filterValues: computed(() => {
      const value = options.filterValues
      const current = state.value
      if (value !== undefined) return cloneFilterValues(value)
      return cloneFilterValues(
        wasFilterValuesControlled
          ? hasUncontrolledFilterValues
            ? uncontrolledFilterValues.value
            : lastControlledFilterValues.value
          : current.filterValues,
      )
    }),
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
  return { model, state: useStore(model) }
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
