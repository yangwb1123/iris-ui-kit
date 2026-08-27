import type { GridRowKey } from './grid-rows'
import type { GridTreeMutationResult, GridTreeRowsOptions } from './grid-tree-rows'

/**
 * Replace the child list of one reachable tree row without mutating the
 * source tree.
 *
 * Lazy tree loaders need a write boundary that is a little different from a
 * shallow row patch: a freshly loaded parent often has no child property yet,
 * while custom accessors may keep children outside the row object entirely.
 * This helper resolves the parent by its stable key, delegates the actual row
 * replacement to `setChildren` when one is supplied, and otherwise infers a
 * conventional `children` property. A missing setter for a computed child
 * list fails closed, just like the other tree mutation helpers.
 */
export function setTreeChildren<Row extends Record<string, unknown>>(
  nodes: readonly Row[],
  key: GridRowKey,
  children: readonly Row[],
  options: GridTreeRowsOptions<Row>,
): GridTreeMutationResult<Row> {
  const nextChildren = [...children]
  const seenKeys = new Set<GridRowKey>()
  const seenRows = new Set<Row>()

  const replace = (row: Row, current: readonly Row[] | undefined): Row | undefined => {
    if (options.setChildren) return options.setChildren(row, nextChildren)
    if (current !== undefined) {
      const replaced = replaceChildren(row, current, nextChildren)
      if (replaced) return replaced
    }
    // A lazy source commonly declares `children?: Row[]` but leaves it
    // undefined until the first load. Preserve the fail-closed behavior for
    // arbitrary computed accessors while supporting that conventional shape.
    if (Object.prototype.hasOwnProperty.call(row, 'children')) {
      return { ...row, children: nextChildren } as Row
    }
    return undefined
  }

  const visit = (siblings: readonly Row[]): GridTreeMutationResult<Row> => {
    let matched = false
    let changed = false
    let blocked = false
    const next: Row[] = []
    for (const [index, row] of siblings.entries()) {
      const rowKey = options.getRowKey(row, index)
      if (wasSeen(row, rowKey, seenKeys, seenRows)) {
        next.push(row)
        continue
      }
      if (!matched && Object.is(rowKey, key)) {
        matched = true
        const current = options.getChildren(row)
        const same =
          current !== undefined &&
          current.length === nextChildren.length &&
          current.every((child, childIndex) => Object.is(child, nextChildren[childIndex]))
        if (same) {
          next.push(row)
          continue
        }
        const replaced = replace(row, current)
        if (!replaced) {
          blocked = true
          next.push(row)
        } else {
          changed = true
          next.push(replaced)
        }
        continue
      }
      const current = options.getChildren(row)
      if (!matched && current?.length) {
        const result = visit(current)
        if (result.matched) {
          matched = true
          blocked = result.blocked
          changed = result.changed
          if (result.blocked) {
            next.push(row)
          } else if (!result.changed) {
            // A reachable child key may already contain the exact same list.
            // Preserve every ancestor reference in that case so a no-op does
            // not become a synthetic rows transaction at the root.
            next.push(row)
          } else {
            const replaced = replaceChildren(row, current, result.rows, options.setChildren)
            if (!replaced) {
              blocked = true
              changed = false
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
      rows: changed ? next : [...siblings],
      matched,
      changed,
      blocked,
      removed: new Set(),
    }
  }

  return visit(nodes)
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
