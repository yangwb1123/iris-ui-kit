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
   * Resolves to the children array; tree caches the result so subsequent
   * expansions are instant.
   */
  loadChildren?: () => Promise<IrisTreeNode[]>
}

export type IrisTreeSelectionMode = 'none' | 'single' | 'multi'
