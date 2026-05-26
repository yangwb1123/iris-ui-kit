export type IrisPageItem = number | 'ellipsis-left' | 'ellipsis-right'

/**
 * Compute the visible page list with two-sided ellipsis insertion.
 *
 * Algorithm:
 *   - Always show first, last, and the `siblingCount` pages on either side
 *     of `current`.
 *   - Insert `'ellipsis-left'` / `'ellipsis-right'` when there's a gap of
 *     ≥ 2 between the kept segments (one missing page renders as the
 *     missing number itself, not an ellipsis).
 *
 * Examples (sibling=1):
 *   total=5,  current=3 → [1,2,3,4,5]
 *   total=20, current=1 → [1,2,3,'ellipsis-right',20]
 *   total=20, current=10→ [1,'ellipsis-left',9,10,11,'ellipsis-right',20]
 */
export function getPageRange(
  current: number,
  totalPages: number,
  siblingCount = 1,
): IrisPageItem[] {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [1]

  const left = Math.max(2, current - siblingCount)
  const right = Math.min(totalPages - 1, current + siblingCount)
  const items: IrisPageItem[] = [1]
  if (left > 2) items.push('ellipsis-left')
  else if (left === 2) {
    // No gap — skip the ellipsis token entirely.
  }
  for (let i = left; i <= right; i += 1) items.push(i)
  if (right < totalPages - 1) items.push('ellipsis-right')
  if (totalPages > 1) items.push(totalPages)
  return items
}
