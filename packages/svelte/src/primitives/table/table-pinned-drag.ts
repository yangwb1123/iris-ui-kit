import {
  computePinnedCountPlan,
  firstRightPinnedIndex as getFirstRightPinnedIndex,
  pinnedBoundaryIndex,
  pinnedCountFromDelta,
} from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

export function createPinnedDragMath(options: {
  enabled: () => boolean
  columns: () => IrisTableColumn[]
  pinOf: (column: IrisTableColumn) => 'left' | 'right' | null
  widthOf: (column: IrisTableColumn) => number
  controlled: () => boolean
  setPinned?: (key: string, side: 'left' | 'right' | null) => void
  onColumnPinnedChange?: (key: string, side: 'left' | 'right' | null) => void
  onPinnedCountChange?: (count: number) => void
}): {
  boundaryKey: () => string | null
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
} {
  const firstRightPinnedIndex = (): number =>
    getFirstRightPinnedIndex(options.columns(), options.pinOf)
  const boundaryKey = (): string | null => {
    if (!options.enabled()) return null
    const columns = options.columns()
    const index = pinnedBoundaryIndex(columns, options.pinOf, firstRightPinnedIndex())
    return index >= 0 ? columns[index]!.key : null
  }
  const resolvePinnedCount = (dx: number): number =>
    pinnedCountFromDelta(
      options.columns(),
      options.widthOf,
      dx,
      firstRightPinnedIndex(),
      options.pinOf,
    )
  const commitPinnedCount = (count: number): void => {
    if (!options.enabled()) return
    const plan = computePinnedCountPlan(
      options.columns(),
      options.pinOf,
      count,
      firstRightPinnedIndex(),
    )
    if (plan.count === plan.current) return
    for (const update of plan.updates) {
      if (options.controlled()) options.setPinned?.(update.column.key, update.pinned)
      else options.onColumnPinnedChange?.(update.column.key, update.pinned)
    }
    options.onPinnedCountChange?.(plan.count)
  }
  return { boundaryKey, resolvePinnedCount, commitPinnedCount }
}
