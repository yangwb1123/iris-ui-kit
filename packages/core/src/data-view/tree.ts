/**
 * Tree flattening utilities for hierarchical data grids.
 *
 * Pure C-layer material: flatten a nested row tree into a visible flat list,
 * wrap children with sort, and filter trees while keeping ancestor context.
 */

import type { TreeRow, FlattenTreeOptions } from './types'

/**
 * Flatten a nested row tree into the visible flat list (pre-order).
 * Children of a collapsed node are omitted. Cycle/duplicate-guarded.
 */
export function flattenTree<Row>(
  roots: readonly Row[],
  options: FlattenTreeOptions<Row>,
): Array<TreeRow<Row>> {
  const { getKey, getChildren, isExpanded } = options
  const out: Array<TreeRow<Row>> = []
  const seen = new Set<string>()
  const walk = (nodes: readonly Row[], depth: number): void => {
    const setSize = nodes.length
    nodes.forEach((row, i) => {
      const key = getKey(row)
      if (seen.has(key)) return
      seen.add(key)
      const children = getChildren(row)
      const hasChildren = !!children && children.length > 0
      const expanded = hasChildren && isExpanded(key)
      out.push({ row, key, depth, hasChildren, expanded, setSize, posInset: i + 1 })
      if (expanded) walk(children!, depth + 1)
    })
  }
  walk(roots, 0)
  return out
}

/**
 * Wrap a `getChildren` accessor so children are returned sorted.
 * Combine with sorting root rows to sort a whole tree hierarchically.
 */
export function withSortedChildren<Row>(
  getChildren: (row: Row) => readonly Row[] | undefined,
  compare: (a: Row, b: Row) => number,
): (row: Row) => readonly Row[] | undefined {
  return (row) => {
    const children = getChildren(row)
    return children ? [...children].sort(compare) : children
  }
}

/**
 * The set of keys to KEEP when filtering a tree.
 * A node is kept when it OR any descendant satisfies `predicate`.
 */
export function treeMatchKeys<Row>(
  roots: readonly Row[],
  predicate: (row: Row) => boolean,
  options: {
    getKey: (row: Row) => string
    getChildren: (row: Row) => readonly Row[] | undefined
  },
): Set<string> {
  const { getKey, getChildren } = options
  const keep = new Set<string>()
  const seen = new Set<string>()
  const visit = (row: Row): boolean => {
    const key = getKey(row)
    if (seen.has(key)) return keep.has(key)
    seen.add(key)
    let anyChild = false
    for (const child of getChildren(row) ?? []) {
      if (visit(child)) anyChild = true
    }
    const kept = predicate(row) || anyChild
    if (kept) keep.add(key)
    return kept
  }
  for (const row of roots) visit(row)
  return keep
}
