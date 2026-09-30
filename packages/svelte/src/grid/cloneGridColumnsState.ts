import type { GridColumnsModel } from '@iris-ui-kit/core/grid'

export function cloneGridColumnsState(
  state: ReturnType<GridColumnsModel['get']>,
): ReturnType<GridColumnsModel['get']> {
  return {
    visibility: { ...state.visibility },
    order: [...state.order],
    widths: { ...state.widths },
    pinned: { ...state.pinned },
  }
}
