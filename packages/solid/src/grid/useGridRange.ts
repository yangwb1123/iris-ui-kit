import { createMemo, type Accessor } from 'solid-js'
import {
  createGridRangeFeature,
  type GridCore,
  type GridRangeChange,
  type GridRangeModel,
} from '@iris-ui-kit/core/grid'
import type { CellRange, CellRangeState } from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseGridRangeOptions {
  onChange?: (change: GridRangeChange) => void
}

export interface UseGridRangeResult {
  model: GridRangeModel
  state: Accessor<CellRangeState>
  range: Accessor<CellRange | null>
}

/** Installs the range feature and bridges its controller snapshot into Solid. */
export function useGridRange<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridRangeOptions = {},
): UseGridRangeResult {
  const latest = options
  if (!core.hasFeature('range')) {
    core.use(
      createGridRangeFeature<Row>({
        onChange: (change) => latest.onChange?.(change),
      }),
    )
  }
  const model = core.invoke<GridRangeModel>('getRangeModel')
  const state = useStore(model)
  const range = createMemo(() => {
    const { anchor, active } = state()
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
