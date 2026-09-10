import { derived, type Readable } from 'svelte/store'
import {
  createGridRangeFeature,
  type GridCore,
  type GridRangeChange,
  type GridRangeModel,
} from '@iris-ui-kit/core/grid'
import type { CellRange, CellRangeState } from '@iris-ui-kit/core'
import { toStore } from '../useStore'

export interface UseGridRangeOptions {
  onChange?: (change: GridRangeChange) => void
}

export interface UseGridRangeResult {
  model: GridRangeModel
  state: Readable<CellRangeState>
  range: Readable<CellRange | null>
}

/** Installs the range feature and exposes its snapshots as Svelte readable stores. */
export function useGridRange<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridRangeOptions = {},
): UseGridRangeResult {
  if (!core.hasFeature('range')) {
    core.use(createGridRangeFeature<Row>({ onChange: options.onChange }))
  }
  const model = core.invoke<GridRangeModel>('getRangeModel')
  const state = toStore(model)
  const range = derived(state, (): CellRange | null => {
    // `state` is the reactive dependency; Core owns range normalization.
    return model.getRange()
  })
  return { model, state, range }
}
