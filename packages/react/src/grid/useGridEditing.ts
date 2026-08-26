import * as React from 'react'
import {
  createGridEditingFeature,
  type GridCore,
  type GridEditingCommit,
  type GridEditingFeatureOptions,
  type GridEditingKey,
  type GridEditingModel,
  type GridEditingValidation,
} from '@iris-ui-kit/core/grid'
import type { CellEditState } from '@iris-ui-kit/core'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

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
  state: CellEditState<GridEditingKey>
  startCellEdit(rowKey: GridEditingKey, columnKey: string, initialDraft?: unknown): boolean
  setCellDraft(value: unknown): void
  cancelCellEdit(): void
  commitCellEdit(value?: unknown): boolean
  isCellEditing(rowKey: GridEditingKey, columnKey: string): boolean
}

/** Installs the framework-independent editing feature and bridges its state. */
export function useGridEditing<Row extends Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridEditingOptions<Row>,
): UseGridEditingResult<Row> {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridEditingModel>(core, 'editing', 'getEditingModel', () =>
    createGridEditingFeature<Row>({
      getRowKey: (row, index) => latest.current.getRowKey(row, index),
      getRowIndex: (rowKey, row, rootRows) => latest.current.getRowIndex?.(rowKey, row, rootRows),
      getRules: (columnKey) => latest.current.getRules?.(columnKey),
      getValue: (row, columnKey) => latest.current.getValue?.(row, columnKey) ?? row[columnKey],
      setValue: (row, columnKey, value) =>
        latest.current.setValue?.(row, columnKey, value) ?? { ...row, [columnKey]: value },
      coerce: (draft, row, columnKey) => latest.current.coerce?.(draft, row, columnKey) ?? draft,
      validate: (value, row, columnKey) => latest.current.validate?.(value, row, columnKey) ?? null,
      isEditable: (row, columnKey) => latest.current.isEditable?.(row, columnKey) ?? true,
      missingRowMessage: options.missingRowMessage,
      commitOptions: () => {
        const configured = latest.current.commitOptions
        return typeof configured === 'function' ? configured() : (configured ?? {})
      },
      onStateChange: (state) => latest.current.onStateChange?.(state),
      onValidation: (validation) => latest.current.onValidation?.(validation),
      onCommit: (commit) => latest.current.onCommit?.(commit),
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
