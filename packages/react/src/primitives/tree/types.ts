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
}

export type IrisTreeSelectionMode = 'none' | 'single' | 'multi'
