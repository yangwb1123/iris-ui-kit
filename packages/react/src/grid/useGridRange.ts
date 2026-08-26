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

function rangeOf(state: CellRangeState): CellRange | null {
  if (!state.anchor || !state.active) return null
  return {
    start: {
      row: Math.min(state.anchor.row, state.active.row),
      col: Math.min(state.anchor.col, state.active.col),
    },
    end: {
      row: Math.max(state.anchor.row, state.active.row),
      col: Math.max(state.anchor.col, state.active.col),
    },
  }
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
  const range = React.useMemo(() => rangeOf(state), [state])

  return { core, model, state, range }
}
