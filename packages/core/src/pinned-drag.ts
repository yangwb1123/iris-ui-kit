/** Minimal column shape consumed by the pinned-boundary math. */
export interface PinnedColumnLike {
  pinned?: 'left' | 'right'
}

type PinnedSide = 'left' | 'right' | null

/** Optional effective-pin resolver used by controlled column maps. */
export type PinnedColumnResolver<Column> = (column: Column) => PinnedSide

/** Keep a column count in the integer range addressable by the source list. */
function normalizeCap(length: number, cap: number): number {
  if (cap === Number.POSITIVE_INFINITY) return length
  if (!Number.isFinite(cap)) return 0
  return Math.max(0, Math.min(length, Math.trunc(cap)))
}

/** Treat malformed resolver output as unpinned and never call it for a hole. */
function resolvePin<Column>(
  column: Column | undefined | null,
  pinOf: PinnedColumnResolver<Column>,
): PinnedSide {
  if (column === undefined || column === null) return null
  const pin = pinOf(column)
  return pin === 'left' || pin === 'right' ? pin : null
}

/** Widths used by this math must be finite, non-negative pixel values. */
function isValidPinnedWidth(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Count a validated width prefix without allowing numeric overflow through. */
function countWidthsWithinBudget(widths: readonly number[], budget: number, cap: number): number {
  if (Number.isNaN(budget)) return 0
  let accumulated = 0
  for (let index = 0; index < cap; index += 1) {
    const width = widths[index]
    if (!isValidPinnedWidth(width)) return index
    const next = accumulated + width
    if (!Number.isFinite(next) || next > budget) return index
    accumulated = next
  }
  return cap
}

/** Index of the first right-pinned column, or the list length when absent. */
export function firstRightPinnedIndex<Column>(
  columns: readonly Column[],
  pinOf: PinnedColumnResolver<Column>,
): number {
  for (let index = 0; index < columns.length; index += 1) {
    if (resolvePin(columns[index], pinOf) === 'right') return index
  }
  return columns.length
}

/** Index of the last left-pinned leaf before the right block. */
export function pinnedBoundaryIndex<Column>(
  columns: readonly Column[],
  pinOf: PinnedColumnResolver<Column>,
  cap = firstRightPinnedIndex(columns, pinOf),
): number {
  const boundedCap = normalizeCap(columns.length, cap)
  for (let index = boundedCap - 1; index >= 0; index -= 1) {
    if (resolvePin(columns[index], pinOf) === 'left') return index
  }
  return -1
}

/** Number of consecutive left-pinned columns at the leading edge. */
export function leftPinnedCount<Column extends PinnedColumnLike>(
  columns: readonly Column[],
  cap: number,
): number
export function leftPinnedCount<Column>(
  columns: readonly Column[],
  cap: number,
  pinOf: PinnedColumnResolver<Column>,
): number
export function leftPinnedCount<Column>(
  columns: readonly Column[],
  cap: number,
  pinOf?: PinnedColumnResolver<Column>,
): number {
  const resolve = pinOf ?? ((column: Column) => (column as PinnedColumnLike).pinned ?? null)
  const boundedCap = normalizeCap(columns.length, cap)
  let count = 0
  for (let index = 0; index < boundedCap; index += 1) {
    const column = columns[index]
    if (column === undefined || column === null) return count
    if (resolvePin(column, resolve) === 'left') count = index + 1
    else return count
  }
  return count
}

/** Return the widest prefix whose cumulative width fits the drag budget. */
export function pinnedCountFromBudget<Column>(
  columns: readonly Column[],
  widthOf: (column: Column) => number,
  budget: number,
  cap: number,
): number {
  const boundedCap = normalizeCap(columns.length, cap)
  if (Number.isNaN(budget)) return 0
  let accumulated = 0
  for (let index = 0; index < boundedCap; index += 1) {
    const column = columns[index]
    if (column === undefined || column === null) return index
    const width = widthOf(column)
    if (!isValidPinnedWidth(width)) return index
    const next = accumulated + width
    if (!Number.isFinite(next) || next > budget) return index
    accumulated = next
  }
  return boundedCap
}

/**
 * Resolve a pinned-prefix count from the separator displacement. The budget
 * starts at the current consecutive left prefix, not at every column marked
 * `left`; this preserves the gapped-pin no-op contract.
 */
export function pinnedCountFromDelta<Column>(
  columns: readonly Column[],
  widthOf: (column: Column) => number,
  delta: number,
  cap: number,
  pinOf: PinnedColumnResolver<Column>,
): number {
  const boundedCap = normalizeCap(columns.length, cap)
  const current = leftPinnedCount(columns, boundedCap, pinOf)
  // An invalid or zero displacement is a no-op, even when a gapped state has
  // zero-width columns whose budget would otherwise admit an extra column.
  if (!Number.isFinite(delta) || delta === 0) return current

  const widths: number[] = []
  let currentWidth = 0
  for (let index = 0; index < boundedCap; index += 1) {
    const column = columns[index]
    if (column === undefined || column === null) return current
    const width = widthOf(column)
    if (!isValidPinnedWidth(width)) return current
    widths.push(width)
    if (index < current) {
      currentWidth += width
      if (!Number.isFinite(currentWidth)) return current
    }
  }

  const budget = currentWidth + delta
  if (!Number.isFinite(budget)) return current
  return countWidthsWithinBudget(widths, budget, boundedCap)
}

export interface PinnedColumnUpdate<Column> {
  readonly index: number
  readonly column: Column
  readonly pinned: 'left' | null
}

export interface PinnedCountPlan<Column> {
  readonly cap: number
  readonly current: number
  readonly count: number
  readonly updates: readonly PinnedColumnUpdate<Column>[]
}

/**
 * Compute the effective pin changes needed to reach a left-pinned prefix
 * count. Adapters apply the returned updates through their controlled or
 * uncontrolled callback channels; no column objects or maps are mutated here.
 */
export function computePinnedCountPlan<Column>(
  columns: readonly Column[],
  pinOf: PinnedColumnResolver<Column>,
  count: number,
  cap = firstRightPinnedIndex(columns, pinOf),
): PinnedCountPlan<Column> {
  const boundedCap = normalizeCap(columns.length, cap)
  const current = leftPinnedCount(columns, boundedCap, pinOf)
  const requestedCount = Number.isFinite(count) ? Math.trunc(count) : null
  const boundedCount =
    requestedCount === null ? current : Math.max(0, Math.min(boundedCap, requestedCount))
  if (boundedCount === current) {
    return { cap: boundedCap, current, count: current, updates: [] }
  }

  // Do not produce a partial plan for a sparse/malformed column list. A
  // missing entry cannot be addressed by the adapter's key callback safely.
  for (let index = 0; index < boundedCap; index += 1) {
    if (columns[index] === undefined || columns[index] === null) {
      return { cap: boundedCap, current, count: current, updates: [] }
    }
  }

  const updates: PinnedColumnUpdate<Column>[] = []
  for (let index = 0; index < boundedCap; index += 1) {
    const column = columns[index]!
    const target: 'left' | null = index < boundedCount ? 'left' : null
    if (resolvePin(column, pinOf) !== target) updates.push({ index, column, pinned: target })
  }
  return { cap: boundedCap, current, count: boundedCount, updates }
}
