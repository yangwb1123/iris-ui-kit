import { reconcileTreeRows } from './grid-tree-rows'

export interface ReconcileProjectedRowsOptions<Row extends Record<string, unknown>> {
  /** The effective visible rows used to render and edit the table. */
  readonly visibleRows: readonly Row[]
  /** Resolve a row key using the row's position in the supplied list. */
  readonly getRowKey: (row: Row, index: number) => string | number
  /** Read nested rows when the effective projection represents a tree. */
  readonly getChildren?: (row: Row) => readonly Row[] | undefined
  /** Replace nested rows when `getChildren` is not a direct property. */
  readonly setChildren?: (row: Row, children: Row[]) => Row
}

/**
 * Reconcile immutable replacements from an effective table projection back to
 * the canonical source list.
 *
 * Clipboard and range operations work on sorted, filtered, or flattened rows,
 * while the rows feature owns the source list. A changed projected row is
 * matched by the identity/key it had in the visible projection; rows that are
 * not visible fall back to their source-list index. Tree sources delegate to
 * `reconcileTreeRows`, preserving ancestor rebuilding and untouched row
 * identity. A no-op returns the original source list reference. The
 * projection and source arrays are never mutated.
 */
export function reconcileProjectedRows<Row extends Record<string, unknown>>(
  sourceRows: readonly Row[],
  previousRows: readonly Row[],
  projectedRows: readonly Row[],
  options: ReconcileProjectedRowsOptions<Row>,
): Row[] {
  const visibleKeys = new Map<Row, string | number>()
  options.visibleRows.forEach((row, index) => {
    visibleKeys.set(row, options.getRowKey(row, index))
  })

  const flatSourceIndexes = new Map<Row, number | null>()
  sourceRows.forEach((row, index) => {
    flatSourceIndexes.set(row, flatSourceIndexes.has(row) ? null : index)
  })

  const keyOf = (row: Row, index: number, source?: readonly Row[]): string | number => {
    const visibleKey = visibleKeys.get(row)
    if (visibleKey !== undefined) return visibleKey
    const sourceIndex = source?.indexOf(row) ?? -1
    return options.getRowKey(row, sourceIndex >= 0 ? sourceIndex : index)
  }

  const patches = new Map<string | number, Row>()
  const flatPatches = new Map<number, Row>()
  projectedRows.forEach((row, index) => {
    if (Object.is(row, previousRows[index])) return
    const previous = previousRows[index]
    if (previous === undefined) return
    const sourceIndex = flatSourceIndexes.get(previous)
    // Flat sources can address the exact source slot by row identity, which
    // keeps duplicate keys from fanning one patch across every sibling. A
    // duplicated row object is ambiguous, so skip it and stay fail-closed.
    if (sourceIndex !== undefined && sourceIndex !== null) flatPatches.set(sourceIndex, row)
    patches.set(keyOf(previous, sourceIndex ?? index, sourceRows), row)
  })

  if (options.getChildren !== undefined) {
    // A keyed patch cannot identify which source node to replace when the
    // canonical tree contains the same key more than once. The lower-level
    // walker intentionally keeps its first-match read semantics, but a
    // projection write-back must not guess and silently update the wrong
    // branch. Preserve the source snapshot and let the host retry with a
    // unique key instead.
    if (patches.size > 0 && hasAmbiguousTreeIdentity(sourceRows, keyOf, options.getChildren)) {
      return sourceRows as Row[]
    }
    return reconcileTreeRows(sourceRows, patches, {
      getRowKey: (row, index) => keyOf(row, index),
      getChildren: options.getChildren,
      setChildren: options.setChildren,
    })
  }

  const next = sourceRows.map((row, index) => flatPatches.get(index) ?? row)
  return next.every((row, index) => Object.is(row, sourceRows[index]))
    ? (sourceRows as Row[])
    : next
}

function hasAmbiguousTreeIdentity<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  getRowKey: (row: Row, index: number) => string | number,
  getChildren: (row: Row) => readonly Row[] | undefined,
): boolean {
  const seenRows = new Set<Row>()
  const seenKeys = new Set<string | number>()
  const visit = (siblings: readonly Row[]): boolean => {
    for (const [index, row] of siblings.entries()) {
      if (seenRows.has(row)) return true
      seenRows.add(row)
      const key = getRowKey(row, index)
      if (seenKeys.has(key)) return true
      seenKeys.add(key)
      const children = getChildren(row)
      if (children?.length && visit(children)) return true
    }
    return false
  }
  return visit(nodes)
}
