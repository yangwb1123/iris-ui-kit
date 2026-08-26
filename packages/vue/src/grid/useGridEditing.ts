import { shallowRef, type ShallowRef } from 'vue'
import {
  createGridEditingFeature,
  type GridCore,
  type GridEditingCommit,
  type GridEditingFeatureOptions,
  type GridEditingKey,
  type GridEditingModel,
  type GridEditingValidation,
  type GridFeature,
} from '@iris-ui-kit/core/grid'
import type { CellEditState } from '@iris-ui-kit/core'
import { useStore } from '../useStore'

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
  state: Readonly<ShallowRef<CellEditState<GridEditingKey>>>
  startCellEdit(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): boolean
  setCellDraft(value: unknown): void
  cancelCellEdit(): void
  commitCellEdit(value?: unknown): boolean
  isCellEditing(rowKey: GridEditingKey, columnKey: string): boolean
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

/** Installs the framework-independent editing feature and bridges its state into Vue. */
export function useGridEditing<Row extends Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridEditingOptions<Row>,
): UseGridEditingResult<Row> {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridEditingModel>(core, 'editing', 'getEditingModel', () =>
    createGridEditingFeature<Row>({
      getRowKey: (row, index) => latest.value.getRowKey(row, index),
      getRowIndex: (rowKey, row, rootRows) => latest.value.getRowIndex?.(rowKey, row, rootRows),
      getRules: (columnKey) => latest.value.getRules?.(columnKey),
      getValue: (row, columnKey) => latest.value.getValue?.(row, columnKey) ?? row[columnKey],
      setValue: (row, columnKey, value) =>
        latest.value.setValue?.(row, columnKey, value) ?? { ...row, [columnKey]: value },
      coerce: (draft, row, columnKey) => latest.value.coerce?.(draft, row, columnKey) ?? draft,
      validate: (value, row, columnKey) => latest.value.validate?.(value, row, columnKey) ?? null,
      isEditable: (row, columnKey) => latest.value.isEditable?.(row, columnKey) ?? true,
      missingRowMessage: options.missingRowMessage,
      commitOptions: () => {
        const configured = latest.value.commitOptions
        return typeof configured === 'function' ? configured() : (configured ?? {})
      },
      onStateChange: (state) => latest.value.onStateChange?.(state),
      onValidation: (validation) => latest.value.onValidation?.(validation),
      onCommit: (commit) => latest.value.onCommit?.(commit),
    }),
  )
  const state = useStore(model.store) as ShallowRef<CellEditState<GridEditingKey>>
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
