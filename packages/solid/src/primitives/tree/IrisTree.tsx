import { createSignal, mergeProps, splitProps, Show, For, type JSX } from 'solid-js'

export interface IrisTreeNode {
  id: string
  label: string
  children?: IrisTreeNode[]
  isLeaf?: boolean
  disabled?: boolean
}

export type IrisTreeSelectionMode = 'none' | 'single' | 'multi'

export interface IrisTreeProps {
  nodes?: IrisTreeNode[]
  selectedIds?: string[]
  defaultSelectedIds?: string[]
  expandedIds?: string[]
  defaultExpandedIds?: string[]
  selectionMode?: IrisTreeSelectionMode
  checkable?: boolean
  checkedIds?: string[]
  defaultCheckedIds?: string[]
  disabled?: boolean
  onSelect?: (ids: string[]) => void
  onExpand?: (ids: string[]) => void
  onCheck?: (ids: string[]) => void
}

function IrisTreeNodeItem(nodeProps: {
  node: IrisTreeNode
  depth: number
  expanded: () => boolean
  selected: () => boolean
  checked: () => boolean
  checkable: boolean
  disabled: boolean
  onToggleExpand: () => void
  onSelect: () => void
  onCheck: () => void
  children?: JSX.Element
}): JSX.Element {
  const hasChildren = () => (nodeProps.node.children?.length ?? 0) > 0
  const isLeaf = () => nodeProps.node.isLeaf || (!hasChildren() && !nodeProps.node.children)
  const isDisabled = () => nodeProps.disabled || nodeProps.node.disabled

  return (
    <li
      role={nodeProps.checkable ? 'treeitem' : 'treeitem'}
      aria-selected={nodeProps.selected()}
      aria-expanded={!isLeaf() ? nodeProps.expanded() : undefined}
      data-iris-tree-node={nodeProps.node.id}
      data-depth={nodeProps.depth}
    >
      <div
        data-iris-tree-node-row=""
        onClick={() => {
          if (isDisabled()) return
          if (!isLeaf()) nodeProps.onToggleExpand()
          nodeProps.onSelect()
        }}
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '4px',
          padding: `4px 8px 4px ${nodeProps.depth * 20 + 8}px`,
          cursor: isDisabled() ? 'not-allowed' : 'pointer',
          opacity: isDisabled() ? '0.5' : '1',
          background: nodeProps.selected()
            ? 'var(--iris-primary-ghost, rgba(59,130,246,0.1))'
            : 'transparent',
          'border-radius': 'var(--iris-radius-sm, 4px)',
        }}
      >
        <Show when={!isLeaf()}>
          <span
            data-iris-tree-expand=""
            style={{
              'font-size': '10px',
              transition: 'transform 150ms',
              transform: nodeProps.expanded() ? 'rotate(90deg)' : 'none',
              'user-select': 'none',
            }}
          >
            ▶
          </span>
        </Show>
        <Show when={nodeProps.checkable}>
          <input
            type="checkbox"
            data-iris-tree-checkbox={nodeProps.node.id}
            checked={nodeProps.checked()}
            disabled={isDisabled() || undefined}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              if (!isDisabled()) nodeProps.onCheck()
            }}
          />
        </Show>
        <span style={{ 'font-size': '14px', color: 'var(--iris-foreground)' }}>
          {nodeProps.node.label}
        </span>
      </div>
      <Show when={nodeProps.expanded() && !isLeaf()}>
        <ul
          role="group"
          data-iris-tree-children=""
          style={{ 'list-style': 'none', margin: '0', padding: '0' }}
        >
          {nodeProps.children}
        </ul>
      </Show>
    </li>
  )
}

/**
 * Tree view: expandable nodes, checkable mode, single/multi-select.
 * Solid port of the Vue IrisTree.
 */
export function IrisTree(props: IrisTreeProps): JSX.Element {
  const merged = mergeProps(
    {
      nodes: [] as IrisTreeNode[],
      defaultSelectedIds: [] as string[],
      defaultExpandedIds: [] as string[],
      defaultCheckedIds: [] as string[],
      selectionMode: 'single' as IrisTreeSelectionMode,
      checkable: false,
      disabled: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'nodes',
    'selectedIds',
    'defaultSelectedIds',
    'expandedIds',
    'defaultExpandedIds',
    'selectionMode',
    'checkable',
    'checkedIds',
    'defaultCheckedIds',
    'disabled',
    'onSelect',
    'onExpand',
    'onCheck',
  ])

  const [internalSelected, setInternalSelected] = createSignal<string[]>(local.defaultSelectedIds)
  const [internalExpanded, setInternalExpanded] = createSignal<string[]>(local.defaultExpandedIds)
  const [internalChecked, setInternalChecked] = createSignal<string[]>(local.defaultCheckedIds)

  const selectedIds = () => local.selectedIds ?? internalSelected()
  const expandedIds = () => local.expandedIds ?? internalExpanded()
  const checkedIds = () => local.checkedIds ?? internalChecked()

  const toggleExpand = (id: string) => {
    const current = expandedIds()
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    if (!local.expandedIds) setInternalExpanded(next)
    local.onExpand?.(next)
  }

  const selectNode = (id: string) => {
    if (local.selectionMode === 'none') return
    const current = selectedIds()
    let next: string[]
    if (local.selectionMode === 'multi') {
      next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    } else {
      next = current.includes(id) ? [] : [id]
    }
    if (!local.selectedIds) setInternalSelected(next)
    local.onSelect?.(next)
  }

  const checkNode = (id: string) => {
    const current = checkedIds()
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    if (!local.checkedIds) setInternalChecked(next)
    local.onCheck?.(next)
  }

  const renderNodes = (nodes: IrisTreeNode[], depth: number): JSX.Element => (
    <For each={nodes}>
      {(node) => (
        <IrisTreeNodeItem
          node={node}
          depth={depth}
          expanded={() => expandedIds().includes(node.id)}
          selected={() => selectedIds().includes(node.id)}
          checked={() => checkedIds().includes(node.id)}
          checkable={local.checkable}
          disabled={local.disabled}
          onToggleExpand={() => toggleExpand(node.id)}
          onSelect={() => selectNode(node.id)}
          onCheck={() => checkNode(node.id)}
        >
          {node.children && node.children.length > 0
            ? renderNodes(node.children, depth + 1)
            : undefined}
        </IrisTreeNodeItem>
      )}
    </For>
  )

  return (
    <ul
      data-iris-tree=""
      role="tree"
      data-disabled={local.disabled ? '' : undefined}
      style={{ 'list-style': 'none', margin: '0', padding: '0' }}
    >
      {renderNodes(local.nodes, 0)}
    </ul>
  )
}
