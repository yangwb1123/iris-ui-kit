export type IrisPageItem = number | 'ellipsis-left' | 'ellipsis-right'

/**
 * Compute the visible page list with two-sided ellipsis insertion.
 *
 * Always shows first, last, and the `siblingCount` pages on either side of
 * `current`. Inserts an ellipsis token when there's a gap of ≥ 2 between kept
 * segments (a single missing page renders as the number itself, not '…').
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
  for (let i = left; i <= right; i += 1) items.push(i)
  if (right < totalPages - 1) items.push('ellipsis-right')
  if (totalPages > 1) items.push(totalPages)
  return items
}
