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
  createGridPaginationFeature,
  createGridPaginationProjection,
  createGridRowsFeature,
  createGridSelectionFeature,
  type GridColumnPin,
  type GridColumnsModel,
  type GridColumnsState,
  type GridCore,
  type GridExpansionKey,
  type GridFeature,
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
} from '@iris-ui-kit/core/grid'
import type { ExpansionModel } from '@iris-ui-kit/core'
import { useStore, useStoreSelector } from '../useStore'
import { useGridFeature } from './useGridFeature'

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
        if (!wasControlled) {
          // Store.batch updates Core before Vue's store mirror is notified.
          uncontrolledSnapshot.value = [...model.store.getState()]
          hasUncontrolledSnapshot = true
        }
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
      getChildren: options.getChildren ? (row) => latest.value.getChildren?.(row) : undefined,
      setChildren: options.setChildren
        ? (row, children) => latest.value.setChildren?.(row, children) as Row
        : undefined,
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
      if (controlled && !wasControlled) {
        // Capture the live Core state before synchronizing this channel.
        uncontrolledVisibility.value = { ...model.store.getState().visibility }
      }
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
      if (controlled && !wasControlled) {
        uncontrolledOrder.value = [...model.store.getState().order]
      }
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
      const controlled = value !== undefined
      if (controlled && !wasControlled) {
        uncontrolledWidths.value = { ...model.store.getState().widths }
      }
      widthsPropControlled.value = controlled
      if (value !== undefined) model.syncWidths(value)
      else if (wasControlled) model.syncWidths(uncontrolledWidths.value)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => options.pinned,
    (value) => {
      const wasControlled = pinnedPropControlled.value
      const controlled = value !== undefined
      if (controlled && !wasControlled) {
        uncontrolledPinned.value = { ...model.store.getState().pinned }
      }
      pinnedPropControlled.value = controlled
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

export {
  useGridSorting,
  type UseGridSortingOptions,
  type UseGridSortingResult,
} from './useGridSorting'
export {
  useGridFiltering,
  type UseGridFilteringOptions,
  type UseGridFilteringResult,
} from './useGridFiltering'
export {
  useGridVirtual,
  type UseGridVirtualOptions,
  type UseGridVirtualResult,
} from './useGridVirtual'

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
