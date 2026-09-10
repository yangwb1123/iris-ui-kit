import {
  computePinnedCountPlan,
  firstRightPinnedIndex as getFirstRightPinnedIndex,
  pinnedBoundaryIndex,
  pinnedCountFromDelta,
} from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

type Pin = 'left' | 'right' | null

export function createPinnedDragMath<Row extends Record<string, unknown>>(options: {
  enabled: () => boolean | undefined
  columns: () => IrisTableColumn<Row>[]
  widthOf: (column: IrisTableColumn<Row>) => number
  pinOf?: (column: IrisTableColumn<Row>) => Pin
  controlled?: () => boolean
  setPinned?: (key: string, side: Pin) => void
  onColumnPinnedChange?: (key: string, side: Pin) => void
  onPinnedCountChange?: (count: number) => void
}): {
  boundaryKey: () => string | null
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
} {
  const pinOf = options.pinOf ?? ((column: IrisTableColumn<Row>): Pin => column.pinned ?? null)
  const firstRightPinnedIndex = (): number => getFirstRightPinnedIndex(options.columns(), pinOf)
  const boundaryKey = (): string | null => {
    if (!options.enabled()) return null
    const columns = options.columns()
    const index = pinnedBoundaryIndex(columns, pinOf, firstRightPinnedIndex())
    return index >= 0 ? columns[index]!.key : null
  }
  const resolvePinnedCount = (dx: number): number =>
    pinnedCountFromDelta(options.columns(), options.widthOf, dx, firstRightPinnedIndex(), pinOf)
  const commitPinnedCount = (count: number): void => {
    if (!options.enabled()) return
    const plan = computePinnedCountPlan(options.columns(), pinOf, count, firstRightPinnedIndex())
    if (plan.count === plan.current) return
    for (const update of plan.updates) {
      if (options.controlled?.()) options.setPinned?.(update.column.key, update.pinned)
      else options.onColumnPinnedChange?.(update.column.key, update.pinned)
    }
    options.onPinnedCountChange?.(plan.count)
  }
  return { boundaryKey, resolvePinnedCount, commitPinnedCount }
}
