export interface IrisCommandItem {
  /** Stable unique id. */
  id: string
  /** Display label. */
  label: string
  /** Searchable extra terms (e.g. synonyms). */
  keywords?: string[]
  /** Optional grouping. Items with the same `group` cluster together. */
  group?: string
  /** Icon prefix (string emoji). */
  icon?: string
  /** Shortcut hint shown on the right of the row. */
  shortcut?: string
  disabled?: boolean
  /** Triggered on Enter / click. */
  action?: () => void
}

/**
 * Default fuzzy match: a query matches an item when each query character
 * appears in order in the item label or keywords. Case-insensitive.
 * Returns a score (lower = better) or null if no match.
 */
export function defaultFilter(query: string, item: IrisCommandItem): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const haystacks: string[] = [item.label, ...(item.keywords ?? [])].map((s) => s.toLowerCase())
  let best: number | null = null
  for (const h of haystacks) {
    let qi = 0
    let lastIdx = -1
    let score = 0
    for (let i = 0; i < h.length && qi < q.length; i += 1) {
      if (h[i] === q[qi]) {
        score += lastIdx === -1 ? i : i - lastIdx - 1
        lastIdx = i
        qi += 1
      }
    }
    if (qi === q.length) {
      if (best === null || score < best) best = score
    }
  }
  return best
}
