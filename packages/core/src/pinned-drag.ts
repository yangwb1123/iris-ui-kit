/** Minimal column shape consumed by the pinned-boundary math. */
export interface PinnedColumnLike {
  pinned?: 'left' | 'right'
}

/** Number of consecutive left-pinned columns at the leading edge. */
export function leftPinnedCount<Column extends PinnedColumnLike>(
  columns: readonly Column[],
  cap: number,
): number {
  let count = 0
  for (let index = 0; index < cap; index += 1) {
    if (columns[index]?.pinned === 'left') count = index + 1
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
  let accumulated = 0
  for (let index = 0; index < cap; index += 1) {
    const width = widthOf(columns[index]!)
    if (accumulated + width <= budget) accumulated += width
    else return index
  }
  return cap
}
