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
    // Subscribe through the bridge, while Core remains the single range
    // normalization owner for inverted anchor/active coordinates.
    void state()
    return model.getRange()
  })
  return { model, state, range }
}
