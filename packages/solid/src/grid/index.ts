import { createEffect, onCleanup, onMount, type Accessor } from 'solid-js'
import {
  createGridCore,
  createGridEditingFeature,
  createGridExpansionFeature,
  createGridRowsFeature,
  createGridSelectionFeature,
  type GridColumnPin,
  type GridCore,
  type GridExpansionKey,
  type GridFeature,
  type GridEditingCommit,
  type GridEditingFeatureOptions,
  type GridEditingKey,
  type GridEditingModel,
  type GridEditingValidation,
  type GridRowKey,
  type GridRowsCommitOptions,
  type GridRowsModel,
  type GridRowsTransaction,
  type SelectionKey,
  type SelectionMode,
  type SelectionModel,
} from '@iris-ui-kit/core/grid'
import { useStore, useStoreSelector } from '../useStore'
import { useGridFeature } from './useGridFeature'
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
      if (!wasControlled) {
        // Store.batch updates the Core state before notifying this bridge, so
        // capture the live pre-sync value rather than the stale Solid mirror.
        uncontrolledSnapshot = [...model.store.getState()]
        hasUncontrolledSnapshot = true
      }
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
      getChildren: options.getChildren ? (row) => latest.getChildren?.(row) : undefined,
      setChildren: options.setChildren
        ? (row, children) => latest.setChildren?.(row, children) as Row
        : undefined,
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
      getValue: (row, columnKey) => {
        const getValue = latest.getValue
        return getValue ? getValue(row, columnKey) : row[columnKey]
      },
      setValue: (row, columnKey, value) =>
        latest.setValue?.(row, columnKey, value) ?? { ...row, [columnKey]: value },
      coerce: (draft, row, columnKey) => {
        const coerce = latest.coerce
        return coerce ? coerce(draft, row, columnKey) : draft
      },
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

export { useGridColumns, type UseGridColumnsOptions } from './useGridColumns'
export { useGridPagination, type UseGridPaginationOptions } from './useGridPagination'
export { useGridSorting, type UseGridSortingOptions } from './useGridSorting'
export { useGridFiltering, type UseGridFilteringOptions } from './useGridFiltering'
export { useGridVirtual, type UseGridVirtualOptions } from './useGridVirtual'

export type { GridColumnPin, GridCore, GridFeature, GridRowsCommitOptions }
export {
  useGridClipboard,
  type UseGridClipboardOptions,
  type UseGridClipboardResult,
} from './useGridClipboard'
