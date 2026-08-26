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
  const range = derived(state, ({ anchor, active }): CellRange | null => {
    if (!anchor || !active) return null
    return {
      start: {
        row: Math.min(anchor.row, active.row),
        col: Math.min(anchor.col, active.col),
      },
      end: {
        row: Math.max(anchor.row, active.row),
        col: Math.max(anchor.col, active.col),
      },
    }
  })
  return { model, state, range }
}
