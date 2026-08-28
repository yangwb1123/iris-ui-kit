import { pinnedCountFromBudget } from '@iris-ui-kit/core'
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
  const firstRightPinnedIndex = (): number => {
    const columns = options.columns()
    const index = columns.findIndex((column) => pinOf(column) === 'right')
    return index < 0 ? columns.length : index
  }
  const leadingLeftPinnedCount = (columns: IrisTableColumn<Row>[], cap: number): number => {
    let count = 0
    for (let index = 0; index < cap; index += 1) {
      if (pinOf(columns[index]!) === 'left') count = index + 1
      else return count
    }
    return count
  }
  const boundaryKey = (): string | null => {
    if (!options.enabled()) return null
    const columns = options.columns()
    for (let index = firstRightPinnedIndex() - 1; index >= 0; index -= 1) {
      if (pinOf(columns[index]!) === 'left') return columns[index]!.key
    }
    return null
  }
  const resolvePinnedCount = (dx: number): number => {
    const columns = options.columns()
    const cap = firstRightPinnedIndex()
    const current = leadingLeftPinnedCount(columns, cap)
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
    const current = leadingLeftPinnedCount(columns, cap)
    if (clamped === current) return
    for (let index = 0; index < cap; index += 1) {
      const column = columns[index]!
      const target: Pin = index < clamped ? 'left' : null
      if (pinOf(column) === target) continue
      if (options.controlled?.()) options.setPinned?.(column.key, target)
      else options.onColumnPinnedChange?.(column.key, target)
    }
    options.onPinnedCountChange?.(clamped)
  }
  return { boundaryKey, resolvePinnedCount, commitPinnedCount }
}
