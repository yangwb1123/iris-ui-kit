import { leftPinnedCount, pinnedCountFromBudget } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

export function createPinnedDragMath<Row extends Record<string, unknown>>(options: {
  enabled: () => boolean | undefined
  columns: () => IrisTableColumn<Row>[]
  widthOf: (column: IrisTableColumn<Row>) => number
  onColumnPinnedChange?: (key: string, side: 'left' | 'right' | null) => void
  onPinnedCountChange?: (count: number) => void
}): {
  boundaryKey: () => string | null
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
} {
  const firstRightPinnedIndex = (): number => {
    const columns = options.columns()
    const index = columns.findIndex((column) => column.pinned === 'right')
    return index < 0 ? columns.length : index
  }
  const boundaryKey = (): string | null => {
    if (!options.enabled()) return null
    const columns = options.columns()
    for (let index = firstRightPinnedIndex() - 1; index >= 0; index -= 1) {
      if (columns[index]?.pinned === 'left') return columns[index]!.key
    }
    return null
  }
  const resolvePinnedCount = (dx: number): number => {
    const columns = options.columns()
    const cap = firstRightPinnedIndex()
    const current = leftPinnedCount(columns, cap)
    let currentWidth = 0
    for (let index = 0; index < current; index += 1)
      currentWidth += options.widthOf(columns[index]!)
    return pinnedCountFromBudget(columns, options.widthOf, currentWidth + dx, cap)
  }
  const commitPinnedCount = (count: number): void => {
    if (!options.enabled()) return
    const columns = options.columns()
    const cap = firstRightPinnedIndex()
    const clamped = Math.max(0, Math.min(cap, count))
    const current = leftPinnedCount(columns, cap)
    if (clamped === current) return
    for (let index = 0; index < cap; index += 1) {
      const column = columns[index]!
      const target: 'left' | null = index < clamped ? 'left' : null
      if (column.pinned === target) continue
      options.onColumnPinnedChange?.(column.key, target)
    }
    options.onPinnedCountChange?.(clamped)
  }
  return { boundaryKey, resolvePinnedCount, commitPinnedCount }
}
