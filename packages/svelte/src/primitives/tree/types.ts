export interface IrisTreeNode {
  id: string
  label: string
  children?: IrisTreeNode[]
  isLeaf?: boolean
  disabled?: boolean
  loadChildren?: () => Promise<IrisTreeNode[]>
}

export type IrisTreeSelectionMode = 'none' | 'single' | 'multi'
