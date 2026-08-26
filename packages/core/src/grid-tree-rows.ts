import type { GridRowKey } from './grid-rows'

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
          const replaced = replaceChildren(nextRow, children, childResult.rows, options.setChildren)
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

function replaceChildren<Row extends Record<string, unknown>>(
  row: Row,
  currentChildren: readonly Row[],
  children: Row[],
  setChildren?: (row: Row, children: Row[]) => Row,
): Row | undefined {
  if (setChildren) return setChildren(row, children)
  const childKey = Object.keys(row).find(
    (key) => (row as Record<string, unknown>)[key] === currentChildren,
  )
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
      removed.add(rowKey)
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
