export interface IrisTreeNode {
  /** Stable unique identifier. */
  id: string
  /** Display label. */
  label: string
  /** Eagerly populated children. */
  children?: IrisTreeNode[]
  /** When true, this node is a leaf and the expand affordance is hidden. */
  isLeaf?: boolean
  /** Disabled — non-selectable. */
  disabled?: boolean
  /**
   * Lazy children loader. Called the first time the node is expanded.
   * Resolves to the children array; the tree caches the result so subsequent
   * expansions are instant. On rejection the node shows an error state and
   * collapses. (Parity with the Vue adapter's `IrisTreeNode`.)
   */
  loadChildren?: () => Promise<IrisTreeNode[]>
}

export type IrisTreeSelectionMode = 'none' | 'single' | 'multi'

/**
 * Opt-in windowed rendering for {@link IrisTree}. Mirrors
 * `IrisTableVirtualOptions`. Tree rows are uniform height (padding 4px +
 * line-height of `--iris-font-size-md`); `itemHeight` must be ≥ the rendered
 * row height for the active font.
 */
export interface IrisTreeVirtualOptions {
  /** Per-row height in px (uniform). */
  itemHeight: number
  /** Viewport height. Number → px; string → CSS length passed through. */
  height: number | string
  /** Extra rows rendered above and below the viewport (default 4). */
  buffer?: number
}
