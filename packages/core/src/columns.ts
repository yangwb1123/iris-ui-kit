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

/** Count the leaf descendants of a node (itself if it has no children). */
function leafCount(node: ColumnTreeNode): number {
  if (!node.children || node.children.length === 0) return 1
  return node.children.reduce((sum, child) => sum + leafCount(child), 0)
}

/** Maximum nesting depth of a column forest (a flat forest has depth 1). */
function forestDepth(nodes: readonly ColumnTreeNode[]): number {
  let max = 0
  for (const node of nodes) {
    const d = node.children && node.children.length > 0 ? 1 + forestDepth(node.children) : 1
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
  const walk = (node: C): void => {
    const children = node.children as C[] | undefined
    if (!children || children.length === 0) out.push(node)
    else for (const child of children) walk(child)
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
  const walk = (node: C, level: number): void => {
    const children = node.children as C[] | undefined
    const isLeaf = !children || children.length === 0
    const colStart = leafCursor
    rows[level].push({
      column: node,
      colSpan: leafCount(node),
      rowSpan: isLeaf ? depth - level : 1,
      level,
      colStart,
    })
    if (isLeaf) leafCursor += 1
    else for (const child of children) walk(child, level + 1)
  }
  for (const node of columns) walk(node, 0)
  return rows
}
