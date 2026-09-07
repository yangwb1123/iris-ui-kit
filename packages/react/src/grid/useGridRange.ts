import * as React from 'react'
import {
  createGridRangeFeature,
  type GridCore,
  type GridRangeChange,
  type GridRangeModel,
} from '@iris-ui-kit/core/grid'
import type { CellRange, CellRangeState } from '@iris-ui-kit/core'
import { useGridFeature } from './useGridFeature'

export interface UseGridRangeOptions {
  onChange?: (change: GridRangeChange) => void
}

export interface UseGridRangeResult<Row extends Record<string, unknown>> {
  core: GridCore<Row>
  model: GridRangeModel
  state: CellRangeState
  range: CellRange | null
}

/** Installs the range feature and bridges its controller snapshot into React. */
export function useGridRange<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridRangeOptions = {},
): UseGridRangeResult<Row> {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridRangeModel>(core, 'range', 'getRangeModel', () =>
    createGridRangeFeature<Row>({
      onChange: (change) => latest.current.onChange?.(change),
    }),
  )
  const state = React.useSyncExternalStore(model.subscribe, model.getState, model.getState)
  // Keep the subscription as the render dependency, but let the Core model
  // own normalization so adapters cannot drift on inverted ranges.
  const range = React.useMemo(() => model.getRange(), [model, state])

  return { core, model, state, range }
}
