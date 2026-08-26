import { computed, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
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
  state: Readonly<ShallowRef<CellRangeState>>
  range: ComputedRef<CellRange | null>
}

/** Installs the range feature and bridges its controller snapshot into Vue. */
export function useGridRange<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridRangeOptions = {},
): UseGridRangeResult {
  const latest = shallowRef(options)
  if (!core.hasFeature('range')) {
    core.use(
      createGridRangeFeature<Row>({
        onChange: (change) => latest.value.onChange?.(change),
      }),
    )
  }
  const model = core.invoke<GridRangeModel>('getRangeModel')
  const state = useStore(model)
  const range = computed(() => {
    const { anchor, active } = state.value
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
