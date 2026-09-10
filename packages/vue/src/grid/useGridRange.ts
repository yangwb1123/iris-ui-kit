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
    // Read the bridged snapshot to retain Vue reactivity; normalization stays
    // in the framework-neutral Core range controller.
    void state.value
    return model.getRange()
  })
  return { model, state, range }
}
