/**
 * Pure column-visibility fade projection.
 *
 * Scheduling, reduced-motion detection, focus recovery, and DOM attributes
 * stay in the adapters. Core owns only the shared overlay transitions and the
 * grouped-column projection used by every table renderer.
 */

import { flattenLeafColumns, type ColumnTreeNode } from './columns'

export type ColumnFadeDirection = 'in' | 'out'
export type ColumnFadePhase = 'pending' | 'run'

export interface ColumnFadeEntry {
  readonly dir: ColumnFadeDirection
  readonly phase: ColumnFadePhase
}

export type ColumnFadeOverlay = Record<string, ColumnFadeEntry>
export type ColumnFadeVisibility = Readonly<Record<string, boolean>>

/**
 * Start or restart fade entries for visibility changes. Sparse visibility maps
 * treat missing keys as visible. Unknown keys can be rejected by the optional
 * predicate so a stale controlled map cannot create an orphaned overlay.
 */
export function startColumnFade(
  previous: ColumnFadeVisibility,
  next: ColumnFadeVisibility,
  current: Readonly<ColumnFadeOverlay> = {},
  isKnownKey?: (key: string) => boolean,
): ColumnFadeOverlay | undefined {
  const overlay = { ...current }
  let changed = false
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (isKnownKey && !isKnownKey(key)) continue
    const wasVisible = previous[key] !== false
    const isVisible = next[key] !== false
    if (wasVisible === isVisible) continue
    overlay[key] = { dir: isVisible ? 'in' : 'out', phase: 'pending' }
    changed = true
  }
  return changed ? overlay : undefined
}

/** Advance all pending entries to the transition-running phase. */
export function advanceColumnFade(
  current: Readonly<ColumnFadeOverlay>,
): ColumnFadeOverlay | undefined {
  let changed = false
  const next: ColumnFadeOverlay = {}
  for (const [key, entry] of Object.entries(current)) {
    if (entry.phase === 'pending') {
      next[key] = { dir: entry.dir, phase: 'run' }
      changed = true
    } else {
      next[key] = entry
    }
  }
  return changed ? next : undefined
}

/**
 * Drop entries whose requested visibility has been reached. An interrupted
 * fade remains in the overlay and can be restarted by `startColumnFade`.
 */
export function commitColumnFade(
  current: Readonly<ColumnFadeOverlay>,
  visibility: ColumnFadeVisibility,
): ColumnFadeOverlay | undefined {
  let changed = false
  const next: ColumnFadeOverlay = {}
  for (const [key, entry] of Object.entries(current)) {
    const visible = visibility[key] !== false
    const done = entry.dir === 'out' ? !visible : visible
    if (done) changed = true
    else next[key] = entry
  }
  return changed ? next : undefined
}

/** Keep in-flight columns mounted in the effective top-level visibility map. */
export function mergeColumnFadeVisibility(
  visibility: ColumnFadeVisibility | undefined,
  overlay: Readonly<ColumnFadeOverlay>,
): Record<string, boolean> | undefined {
  if (Object.keys(overlay).length === 0) return visibility
  const next = { ...(visibility ?? {}) }
  for (const key of Object.keys(overlay)) next[key] = true
  return next
}

/** Expand top-level fade entries to all leaf columns in grouped headers. */
export function expandColumnFadeToLeaves<C extends ColumnTreeNode>(
  overlay: Readonly<ColumnFadeOverlay>,
  columns: readonly C[],
): ColumnFadeOverlay {
  if (Object.keys(overlay).length === 0) return {}
  const topLevel = new Map(columns.map((column) => [column.key, column]))
  const next: ColumnFadeOverlay = {}
  for (const [key, entry] of Object.entries(overlay)) {
    const top = topLevel.get(key)
    if (!top) continue
    const leaves = top.children && top.children.length > 0 ? flattenLeafColumns([top]) : [top]
    for (const leaf of leaves) next[leaf.key] = entry
  }
  return next
}

/** Whether an entry's current phase is visually collapsed. */
export function isColumnFadeCollapsed(entry: ColumnFadeEntry): boolean {
  return (
    (entry.dir === 'out' && entry.phase === 'run') ||
    (entry.dir === 'in' && entry.phase === 'pending')
  )
}
