import type { GridRowKey } from './grid-rows'
export { setTreeChildren } from './grid-tree-children'

export interface GridTreeRowsOptions<Row extends Record<string, unknown>> {
  /** Resolve the stable key for a row at its sibling index. */
  readonly getRowKey: (row: Row, index: number) => GridRowKey | undefined
  /** Read the nested rows owned by a row. */
  readonly getChildren: (row: Row) => readonly Row[] | undefined
  /** Replace nested rows immutably when the accessor is not a direct property. */
  readonly setChildren?: (row: Row, children: Row[]) => Row
}

export interface GridTreeMutationResult<Row> {
  readonly rows: Row[]
  readonly matched: boolean
  readonly changed: boolean
  readonly blocked: boolean
  /** Keys physically removed; deleting a parent includes reachable descendants. */
  readonly removed: ReadonlySet<GridRowKey>
}

/**
 * Find the first row with a resolved key in a nested tree (pre-order).
 *
 * This deliberately shares the mutation walkers' cycle/duplicate guard. A
 * tree consumer should be able to use the read path safely even when an
 * application accidentally reuses a node object or key in two branches.
 */
export function findTreeRow<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  key: GridRowKey,
  options: Pick<GridTreeRowsOptions<Row>, 'getRowKey' | 'getChildren'>,
): Row | undefined {
  const seenKeys = new Set<GridRowKey>()
  const seenRows = new Set<Row>()
  const find = (siblings: readonly Row[]): Row | undefined => {
    for (const [index, row] of siblings.entries()) {
      const rowKey = options.getRowKey(row, index)
      if (wasSeen(row, rowKey, seenKeys, seenRows)) continue
      if (Object.is(rowKey, key)) return row
      const children = options.getChildren(row)
      if (children?.length) {
        const match = find(children)
        if (match) return match
      }
    }
    return undefined
  }
  return find(nodes)
}

/**
 * Collect every reachable row in pre-order, independent of expansion state.
 *
 * This is the read-side companion to `findTreeRow` and the mutation walkers:
 * callers that need an edit/selection index get the same duplicate and cycle
 * protection without reimplementing a framework-specific recursive walk.
 */
export function collectTreeRows<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  options: Pick<GridTreeRowsOptions<Row>, 'getRowKey' | 'getChildren'>,
): Row[] {
  const seenKeys = new Set<GridRowKey>()
  const seenRows = new Set<Row>()
  const out: Row[] = []
  const collect = (siblings: readonly Row[]): void => {
    for (const [index, row] of siblings.entries()) {
      const rowKey = options.getRowKey(row, index)
      if (wasSeen(row, rowKey, seenKeys, seenRows)) continue
      out.push(row)
      const children = options.getChildren(row)
      if (children?.length) collect(children)
    }
  }
  collect(nodes)
  return out
}

/**
 * Reconcile keyed row replacements from a flattened/tree projection back to
 * the immutable root list.
 *
 * Grid features such as clipboard and range editing operate on the effective
 * visible row projection, while the rows feature owns the nested source tree.
 * This helper applies a map of full row replacements at any reachable depth,
 * rebuilding only the ancestor path of changed rows. The source rows and
 * every untouched row object keep their identity. Duplicate row objects/keys
 * and cycles use the same guard as the read and mutation walkers, so a bad
 * application tree cannot recurse forever or apply a patch twice.
 *
 * `setChildren` is required when `getChildren` reads a computed/non-property
 * child list. For ordinary `{ children: Row[] }` records the accessor is
 * inferred automatically, matching `updateTreeRows`.
 */
export function reconcileTreeRows<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  patches: ReadonlyMap<GridRowKey, Row>,
  options: GridTreeRowsOptions<Row>,
): Row[] {
  const seenKeys = new Set<GridRowKey>()
  const seenRows = new Set<Row>()

  const reconcile = (siblings: readonly Row[]): { rows: Row[]; changed: boolean } => {
    let changed = false
    const next: Row[] = []
    for (const [index, row] of siblings.entries()) {
      const rowKey = options.getRowKey(row, index)
      if (wasSeen(row, rowKey, seenKeys, seenRows)) {
        next.push(row)
        continue
      }

      const patched = rowKey === undefined ? undefined : patches.get(rowKey)
      let nextRow = patched ?? row
      let rowChanged = patched !== undefined && !Object.is(patched, row)
      const children = options.getChildren(nextRow) ?? options.getChildren(row)
      if (children?.length) {
        const childResult = reconcile(children)
        if (childResult.changed) {
          // A visible projection may replace a row with a shallow object that
          // omits collapsed children. Resolve the child slot against the
          // source row as a fallback so a nested patch cannot accidentally
          // drop descendants merely because the replacement omitted them.
          const replaced = replaceChildren(
            nextRow,
            children,
            childResult.rows,
            options.setChildren,
            row,
          )
          if (replaced) {
            nextRow = replaced
            rowChanged = true
          }
        }
      }
      if (rowChanged) changed = true
      next.push(nextRow)
    }
    // Preserve the exact sibling-list reference for a no-op. Besides avoiding
    // needless work, this lets rows transactions remain event-free when a
    // projection patch targets a key that is no longer reachable.
    return { rows: changed ? next : (siblings as Row[]), changed }
  }

  return reconcile(nodes).rows
}

/**
 * Reorder two keyed rows that belong to the same sibling list.
 *
 * Row drag handles are rendered from a flattened visible projection, while
 * the rows feature owns the nested source tree.  A flat `splice` on that
 * projection would either erase the hierarchy or write a child into the root
 * list.  This helper resolves both keys in the source tree, performs the same
 * remove-then-insert operation used by the flat adapters, and rebuilds only
 * the ancestor path of that sibling list.  Cross-parent moves are deliberately
 * blocked until a future drop-position contract can describe re-parenting.
 *
 * The source rows, sibling arrays, and untouched row objects are never
 * mutated.  Duplicate row objects/keys and cycles share the same guard as the
 * other tree walkers. `position` is useful when the source order differs from
 * the visible projection (for example while a tree level is sorted); `auto`
 * preserves the historical remove-then-insert direction.
 */
export function reorderTreeRows<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  fromKey: GridRowKey,
  toKey: GridRowKey,
  options: GridTreeRowsOptions<Row>,
  position: 'auto' | 'before' | 'after' = 'auto',
): GridTreeMutationResult<Row> {
  if (Object.is(fromKey, toKey)) {
    return {
      rows: nodes as Row[],
      matched: false,
      changed: false,
      blocked: false,
      removed: new Set(),
    }
  }

  type Ancestor = {
    readonly siblings: readonly Row[]
    readonly index: number
    readonly row: Row
    readonly children: readonly Row[]
  }
  type Location = {
    readonly siblings: readonly Row[]
    readonly index: number
    readonly ancestors: readonly Ancestor[]
  }

  const seenKeys = new Set<GridRowKey>()
  const seenRows = new Set<Row>()
  let from: Location | undefined
  let to: Location | undefined

  const visit = (siblings: readonly Row[], ancestors: readonly Ancestor[]): void => {
    for (const [index, row] of siblings.entries()) {
      const rowKey = options.getRowKey(row, index)
      if (wasSeen(row, rowKey, seenKeys, seenRows)) continue
      if (!from && Object.is(rowKey, fromKey)) {
        from = { siblings, index, ancestors }
      } else if (!to && Object.is(rowKey, toKey)) {
        to = { siblings, index, ancestors }
      }
      const children = options.getChildren(row)
      if (children?.length && (!from || !to)) {
        visit(children, [...ancestors, { siblings, index, row, children }])
      }
      if (from && to) return
    }
  }
  visit(nodes, [])

  if (!from || !to) {
    return {
      rows: nodes as Row[],
      matched: false,
      changed: false,
      blocked: false,
      removed: new Set(),
    }
  }
  if (!Object.is(from.siblings, to.siblings)) {
    return {
      rows: nodes as Row[],
      matched: true,
      changed: false,
      blocked: true,
      removed: new Set(),
    }
  }

  const reordered = [...from.siblings]
  const [moved] = reordered.splice(from.index, 1)
  if (!moved) {
    return {
      rows: nodes as Row[],
      matched: true,
      changed: false,
      blocked: true,
      removed: new Set(),
    }
  }
  const targetIndex = to.index - (from.index < to.index ? 1 : 0)
  const insertionIndex =
    position === 'after' ? targetIndex + 1 : position === 'before' ? targetIndex : to.index
  reordered.splice(insertionIndex, 0, moved)
  const sourceSiblings = from.siblings
  if (reordered.every((row, index) => Object.is(row, sourceSiblings[index]))) {
    return {
      rows: nodes as Row[],
      matched: true,
      changed: false,
      blocked: false,
      removed: new Set(),
    }
  }

  let rebuilt: Row[] = reordered
  for (let index = from.ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = from.ancestors[index]!
    const replaced = replaceChildren(ancestor.row, ancestor.children, rebuilt, options.setChildren)
    if (!replaced) {
      return {
        rows: nodes as Row[],
        matched: true,
        changed: false,
        blocked: true,
        removed: new Set(),
      }
    }
    const parentSiblings = [...ancestor.siblings]
    parentSiblings[ancestor.index] = replaced
    rebuilt = parentSiblings
  }

  return {
    rows: rebuilt,
    matched: true,
    changed: true,
    blocked: false,
    removed: new Set(),
  }
}

function replaceChildren<Row extends Record<string, unknown>>(
  row: Row,
  currentChildren: readonly Row[],
  children: Row[],
  setChildren?: (row: Row, children: Row[]) => Row,
  sourceRow?: Row,
): Row | undefined {
  if (setChildren) return setChildren(row, children)
  const childKey =
    Object.keys(row).find((key) => (row as Record<string, unknown>)[key] === currentChildren) ??
    (sourceRow
      ? Object.keys(sourceRow).find(
          (key) => (sourceRow as Record<string, unknown>)[key] === currentChildren,
        )
      : undefined)
  if (!childKey) return undefined
  return { ...row, [childKey]: children } as Row
}

function wasSeen<Row extends Record<string, unknown>>(
  row: Row,
  rowKey: GridRowKey | undefined,
  seenKeys: Set<GridRowKey>,
  seenRows: Set<Row>,
): boolean {
  if (seenRows.has(row)) return true
  seenRows.add(row)
  if (rowKey === undefined) return false
  if (seenKeys.has(rowKey)) return true
  seenKeys.add(rowKey)
  return false
}

function updateNodes<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  key: GridRowKey,
  patch: Partial<Row>,
  options: GridTreeRowsOptions<Row>,
  seenKeys: Set<GridRowKey>,
  seenRows: Set<Row>,
): GridTreeMutationResult<Row> {
  let matched = false
  let changed = false
  let blocked = false
  const next: Row[] = []
  for (const [index, row] of nodes.entries()) {
    const rowKey = options.getRowKey(row, index)
    if (wasSeen(row, rowKey, seenKeys, seenRows)) {
      next.push(row)
      continue
    }
    if (!matched && Object.is(rowKey, key)) {
      next.push({ ...row, ...patch } as Row)
      matched = true
      changed = true
      continue
    }
    const children = options.getChildren(row)
    if (!matched && children?.length) {
      const result = updateNodes(children, key, patch, options, seenKeys, seenRows)
      if (result.matched) {
        matched = true
        if (result.blocked) {
          blocked = true
          next.push(row)
        } else {
          const replaced = replaceChildren(row, children, result.rows, options.setChildren)
          if (!replaced) {
            blocked = true
            next.push(row)
          } else {
            changed = true
            next.push(replaced)
          }
        }
        continue
      }
    }
    next.push(row)
  }
  return { rows: changed ? next : [...nodes], matched, changed, blocked, removed: new Set() }
}

function removeNodes<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  keys: ReadonlySet<GridRowKey>,
  options: GridTreeRowsOptions<Row>,
  seenKeys: Set<GridRowKey>,
  seenRows: Set<Row>,
): GridTreeMutationResult<Row> {
  let changed = false
  let blocked = false
  const next: Row[] = []
  const removed = new Set<GridRowKey>()
  for (const [index, row] of nodes.entries()) {
    const rowKey = options.getRowKey(row, index)
    if (wasSeen(row, rowKey, seenKeys, seenRows)) {
      next.push(row)
      continue
    }
    if (rowKey !== undefined && keys.has(rowKey)) {
      // Removing a parent removes its complete reachable subtree. Report all
      // descendant keys as part of the same result so selection/lookup
      // consumers can prune keys that disappeared with the parent; walking
      // with the shared guard keeps malformed cyclic or duplicate trees safe.
      removed.add(rowKey)
      const children = options.getChildren(row)
      if (children?.length) {
        collectRemovedKeys(children, options, seenKeys, seenRows, removed)
      }
      changed = true
      continue
    }
    const children = options.getChildren(row)
    if (children?.length) {
      const result = removeNodes(children, keys, options, seenKeys, seenRows)
      if (result.removed.size > 0) {
        result.removed.forEach((key) => removed.add(key))
        if (result.blocked) {
          blocked = true
          next.push(row)
        } else {
          const replaced = replaceChildren(row, children, result.rows, options.setChildren)
          if (!replaced) {
            blocked = true
            next.push(row)
          } else {
            changed = true
            next.push(replaced)
          }
        }
        continue
      }
    }
    next.push(row)
  }
  return {
    rows: changed ? next : [...nodes],
    matched: removed.size > 0,
    changed,
    blocked,
    removed,
  }
}

function collectRemovedKeys<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  options: Pick<GridTreeRowsOptions<Row>, 'getRowKey' | 'getChildren'>,
  seenKeys: Set<GridRowKey>,
  seenRows: Set<Row>,
  removed: Set<GridRowKey>,
): void {
  for (const [index, row] of nodes.entries()) {
    const rowKey = options.getRowKey(row, index)
    if (wasSeen(row, rowKey, seenKeys, seenRows)) continue
    if (rowKey !== undefined) removed.add(rowKey)
    const children = options.getChildren(row)
    if (children?.length) collectRemovedKeys(children, options, seenKeys, seenRows, removed)
  }
}

/** Update one row anywhere in a nested tree without mutating source nodes. */
export function updateTreeRows<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  key: GridRowKey,
  patch: Partial<Row>,
  options: GridTreeRowsOptions<Row>,
): GridTreeMutationResult<Row> {
  return updateNodes(nodes, key, patch, options, new Set(), new Set())
}

/** Remove requested rows anywhere in a nested tree in one root transaction. */
export function removeTreeRows<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  keys: ReadonlySet<GridRowKey>,
  options: GridTreeRowsOptions<Row>,
): GridTreeMutationResult<Row> {
  return removeNodes(nodes, keys, options, new Set(), new Set())
}
