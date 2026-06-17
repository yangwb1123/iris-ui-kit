/**
 * Pagination math utilities.
 *
 * Pure C-layer material: slice a page from a row set, compute page count,
 * and compute the visible page range with ellipsis insertion.
 */

import type { PageItem } from './types'

/**
 * Slice the page-th page (1-based) of `pageSize` rows.
 */
export function paginate<Row>(rows: readonly Row[], page: number, pageSize: number): Row[] {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

/**
 * Total pages for `total` rows at `pageSize` (minimum 1).
 */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * Compute the visible page list with two-sided ellipsis insertion.
 * Always shows the first page, the last page, and `siblingCount` pages
 * on either side of `current`.
 */
export function getPageRange(current: number, totalPages: number, siblingCount = 1): PageItem[] {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [1]

  const left = Math.max(2, current - siblingCount)
  const right = Math.min(totalPages - 1, current + siblingCount)
  const items: PageItem[] = [1]
  if (left > 2) items.push('ellipsis-left')
  for (let i = left; i <= right; i += 1) items.push(i)
  if (right < totalPages - 1) items.push('ellipsis-right')
  items.push(totalPages)
  return items
}
