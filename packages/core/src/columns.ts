/**
 * Framework-agnostic column-tree material for MULTI-LEVEL (grouped) table
 * headers. A column may carry `children` to form a header group spanning its
 * descendants; the leaf columns still drive the body. These pure helpers turn
 * such a tree into (a) the flat leaf list the body renders and (b) the header
 * matrix (rows of cells with col/row spans) the header renders — so each adapter
 * composes them instead of re-deriving the span math per framework.
 */

/** Minimal shape a grouped column must expose. Your real column type extends it. */
export interface ColumnTreeNode {
  key: string
  children?: ColumnTreeNode[]
}

/** A header cell positioned in the header matrix, with its spans. */
export interface HeaderCell<C extends ColumnTreeNode> {
  column: C
  /** Number of leaf columns this cell spans (1 for a leaf). */
  colSpan: number
  /** Header rows this cell spans: a leaf reaches the bottom; a group spans 1. */
  rowSpan: number
  /** 0-based header row (nesting level) this cell sits in. */
  level: number
  /** 1-based leaf-column index where this cell begins — its grid column start. */
  colStart: number
}

/**
 * Minimal column shape needed to read a cell value: a stable `key` plus an
 * optional `dataIndex` (the row field to read; defaults to `key`). Real column
 * types — `DataViewColumn`, pro-table's `ProTableColumn`, etc. — extend it.
 */
export interface ColumnAccessor {
  key: string
  dataIndex?: string
}

/** The row field a column reads — its `dataIndex`, defaulting to `key`. */
export function dataIndexOf(column: ColumnAccessor): string {
  return column.dataIndex ?? column.key
}

/** Read a column's cell value out of a row. */
export function readCell<Row extends Record<string, unknown>>(
  row: Row,
  column: ColumnAccessor,
): unknown {
  const key = dataIndexOf(column)
  return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined
}

/**
 * Project a top-level order onto a column forest without mutating the source.
 * Unknown and repeated keys are ignored; omitted columns retain their source
 * order after the explicitly ordered columns. The empty/unset path preserves
 * the input reference so the default render remains allocation-free.
 */
export function applyColumnOrder<C extends ColumnTreeNode>(
  columns: C[],
  order: readonly string[] | undefined,
): C[] {
  if (!order || order.length === 0) return columns

  const orderIndex = new Map<string, number>()
  order.forEach((key, index) => {
    if (!orderIndex.has(key)) orderIndex.set(key, index)
  })
  const ordered = columns.filter((column) => orderIndex.has(column.key))
  const rest = columns.filter((column) => !orderIndex.has(column.key))
  ordered.sort((left, right) => orderIndex.get(left.key)! - orderIndex.get(right.key)!)
  return [...ordered, ...rest]
}

/**
 * Reorder two keyed columns in one immutable list. `auto` inserts at the
 * target's original index after removing the source, matching the flat table
 * drag contract; `before`/`after` are relative to the target after removal.
 * Unknown/same keys and identity-only moves preserve the source reference.
 */
export function reorderColumnsInList<C extends ColumnTreeNode>(
  columns: readonly C[],
  fromKey: string,
  toKey: string,
  position: 'auto' | 'before' | 'after' = 'auto',
): C[] {
  const fromIndex = columns.findIndex((column) => column.key === fromKey)
  const toIndex = columns.findIndex((column) => column.key === toKey)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return columns as C[]

  const next = [...columns]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return columns as C[]
  const targetIndex = toIndex - (fromIndex < toIndex ? 1 : 0)
  const insertionIndex =
    position === 'after' ? targetIndex + 1 : position === 'before' ? targetIndex : toIndex
  next.splice(insertionIndex, 0, moved)
  if (next.every((column, index) => Object.is(column, columns[index]))) return columns as C[]
  return next
}

/**
 * Reorder a keyed column to an insertion index expressed in the ORIGINAL
 * list. This is useful for drag indicators that resolve their drop line before
 * removing the source column. Invalid/identity-only moves preserve identity.
 */
export function reorderColumnsInListAt<C extends ColumnTreeNode>(
  columns: readonly C[],
  fromKey: string,
  insertIndex: number,
): C[] {
  const fromIndex = columns.findIndex((column) => column.key === fromKey)
  if (fromIndex < 0 || !Number.isFinite(insertIndex)) return columns as C[]
  const at = Math.max(0, Math.min(Math.trunc(insertIndex), columns.length))
  if (fromIndex === at) return columns as C[]

  const next = [...columns]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return columns as C[]
  next.splice(at, 0, moved)
  if (next.every((column, index) => Object.is(column, columns[index]))) return columns as C[]
  return next
}

/**
 * Apply a top-level visibility map without mutating the column forest.
 * An absent or empty map is the identity path; grouped columns are filtered at
 * the same top-level boundary as the table adapters.
 */
export function applyColumnVisibility<C extends ColumnTreeNode>(
  columns: C[],
  visibility: Readonly<Record<string, boolean>> | undefined,
): C[] {
  if (!visibility || Object.keys(visibility).length === 0) return columns
  return columns.filter(
    (column) =>
      !Object.prototype.hasOwnProperty.call(visibility, column.key) ||
      visibility[column.key] !== false,
  )
}

/** Sticky offset emitted for a pinned leaf column. */
export interface PinnedColumnOffset {
  side: 'left' | 'right'
  offset: number
}

/**
 * Compute sticky offsets for an already-flattened leaf sequence. Left offsets
 * start after leading tracks; right offsets accumulate from the far edge.
 * This is pure projection math, so every adapter can share the same pin
 * ordering semantics while retaining framework-specific style output.
 */
export function computePinnedColumnOffsets<C extends ColumnTreeNode>(
  columns: readonly C[],
  widthOf: (column: C) => number,
  pinOf: (column: C) => 'left' | 'right' | null,
  leadingWidth = 0,
): Record<string, PinnedColumnOffset> {
  const offsets: Record<string, PinnedColumnOffset> = {}
  const safeWidth = (width: number): number =>
    typeof width === 'number' && Number.isFinite(width) && width >= 0 ? width : 0
  const addWidth = (offset: number, width: number): number => {
    const next = offset + safeWidth(width)
    return Number.isFinite(next) ? next : offset
  }
  const setOffset = (key: string, value: PinnedColumnOffset): void => {
    // `__proto__` must be an ordinary own data property, not Object.prototype's
    // legacy setter; this also makes duplicate keys deterministically last-write-wins.
    Object.defineProperty(offsets, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
  }
  let left = safeWidth(leadingWidth)
  for (const column of columns) {
    if (pinOf(column) === 'left') {
      setOffset(column.key, { side: 'left', offset: left })
      left = addWidth(left, widthOf(column))
    }
  }
  let right = 0
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index]!
    if (pinOf(column) === 'right') {
      setOffset(column.key, { side: 'right', offset: right })
      right = addWidth(right, widthOf(column))
    }
  }
  return offsets
}

function isColumnNode(value: unknown): value is ColumnTreeNode {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
}

/** Treat malformed child collections as leaves and ignore malformed children. */
function childrenOf(node: unknown): readonly ColumnTreeNode[] | undefined {
  if (!isColumnNode(node) || !Array.isArray(node.children)) return undefined
  const children = node.children.filter(isColumnNode)
  return children.length > 0 ? children : undefined
}

/** Count the leaf descendants of a node (itself if it has no children). */
function leafCount(node: ColumnTreeNode, ancestors = new WeakSet<object>()): number {
  if (!isColumnNode(node) || ancestors.has(node)) return 1
  const children = childrenOf(node)
  if (!children) return 1
  ancestors.add(node)
  const count = children.reduce((sum, child) => sum + leafCount(child, ancestors), 0)
  ancestors.delete(node)
  return count
}

/** Maximum nesting depth of a column forest (a flat forest has depth 1). */
function forestDepth(nodes: readonly ColumnTreeNode[], ancestors = new WeakSet<object>()): number {
  let max = 0
  for (const node of nodes) {
    if (!isColumnNode(node) || ancestors.has(node)) {
      if (max < 1) max = 1
      continue
    }
    const children = childrenOf(node)
    ancestors.add(node)
    const d = children ? 1 + forestDepth(children, ancestors) : 1
    ancestors.delete(node)
    if (d > max) max = d
  }
  return max
}

/**
 * The leaf columns of a (possibly grouped) column forest, left-to-right. These
 * are the columns the table BODY renders — identical to the input when nothing
 * is grouped, so flat tables are unaffected.
 */
export function flattenLeafColumns<C extends ColumnTreeNode>(columns: readonly C[]): C[] {
  const out: C[] = []
  const walk = (node: C, ancestors = new WeakSet<object>()): void => {
    if (!isColumnNode(node)) return
    if (ancestors.has(node)) {
      out.push(node)
      return
    }
    const children = childrenOf(node)
    if (!children) {
      out.push(node)
      return
    }
    ancestors.add(node)
    for (const child of children) walk(child as C, ancestors)
    ancestors.delete(node)
  }
  for (const node of columns) walk(node)
  return out
}

/**
 * Build the header matrix for a (possibly grouped) column forest: one row per
 * nesting level, each cell carrying its `colSpan` (leaf-descendant count) and
 * `rowSpan` (a leaf spans down to the deepest row; a group spans one row). For a
 * FLAT forest the result is a single row of `rowSpan: 1` cells, so a plain table
 * renders exactly as before.
 */
export function buildHeaderMatrix<C extends ColumnTreeNode>(
  columns: readonly C[],
): HeaderCell<C>[][] {
  const depth = forestDepth(columns)
  const rows: HeaderCell<C>[][] = Array.from({ length: depth }, () => [])
  let leafCursor = 1 // 1-based leaf-column index, advances left-to-right
  const walk = (node: C, level: number, ancestors = new WeakSet<object>()): void => {
    if (!isColumnNode(node) || level >= rows.length) return
    if (ancestors.has(node)) {
      rows[level].push({
        column: node,
        colSpan: 1,
        rowSpan: depth - level,
        level,
        colStart: leafCursor,
      })
      leafCursor += 1
      return
    }
    const children = childrenOf(node)
    const isLeaf = !children
    const colStart = leafCursor
    rows[level].push({
      column: node,
      colSpan: isLeaf ? 1 : leafCount(node),
      rowSpan: isLeaf ? depth - level : 1,
      level,
      colStart,
    })
    if (isLeaf) {
      leafCursor += 1
      return
    }
    ancestors.add(node)
    for (const child of children) walk(child as C, level + 1, ancestors)
    ancestors.delete(node)
  }
  for (const node of columns) walk(node, 0)
  return rows
}
