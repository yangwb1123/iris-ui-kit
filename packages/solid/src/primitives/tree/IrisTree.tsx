import { createSignal, createEffect, mergeProps, splitProps, Show, For, type JSX } from 'solid-js'
import { createTreeSelection, type TreeSelectionNode } from '@iris-ui/core'
import { useStore } from '../../useStore'

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
  /**
   * Show a checkbox per node with parent/child cascade + indeterminate
   * (tri-state) propagation, independent of `selectionMode`. Driven by the
   * framework-agnostic `createTreeSelection`.
   */
  checkable?: boolean
  /** Initially checked node ids (uncontrolled; reconciled through the cascade). */
  defaultChecked?: string[]
  /** Notified with the fully-reconciled checked node ids on every check change. */
  onCheckedChange?: (checked: string[]) => void
  disabled?: boolean
  onSelect?: (ids: string[]) => void
  onExpand?: (ids: string[]) => void
}

function IrisTreeNodeItem(nodeProps: {
  node: IrisTreeNode
  depth: number
  expanded: () => boolean
  selected: () => boolean
  checked: () => boolean
  indeterminate: () => boolean
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

  // `indeterminate` is a DOM *property*, not an attribute — set it imperatively
  // and keep it in sync with the reactive tri-state from the cascade engine.
  let checkboxEl: HTMLInputElement | undefined
  createEffect(() => {
    if (checkboxEl) checkboxEl.indeterminate = nodeProps.indeterminate()
  })

  return (
    <li
      role="treeitem"
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
            ref={(el) => {
              checkboxEl = el
            }}
            type="checkbox"
            data-iris-tree-checkbox={nodeProps.node.id}
            checked={nodeProps.checked()}
            aria-checked={nodeProps.indeterminate() ? 'mixed' : nodeProps.checked()}
            aria-label={nodeProps.node.label}
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
 *
 * Checkable mode renders a checkbox per node with parent/child cascade and
 * indeterminate (tri-state) propagation, driven by the framework-agnostic
 * `createTreeSelection` from `@iris-ui/core` (no cascade logic lives here).
 */
export function IrisTree(props: IrisTreeProps): JSX.Element {
  const merged = mergeProps(
    {
      nodes: [] as IrisTreeNode[],
      defaultSelectedIds: [] as string[],
      defaultExpandedIds: [] as string[],
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
    'defaultChecked',
    'onCheckedChange',
    'disabled',
    'onSelect',
    'onExpand',
  ])

  const [internalSelected, setInternalSelected] = createSignal<string[]>(local.defaultSelectedIds)
  const [internalExpanded, setInternalExpanded] = createSignal<string[]>(local.defaultExpandedIds)

  const selectedIds = () => local.selectedIds ?? internalSelected()
  const expandedIds = () => local.expandedIds ?? internalExpanded()

  // Checkable mode: flatten the FULL tree (every node, including collapsed and
  // not-yet-rendered children) into `{ key, parentKey, disabled }` so the
  // cascade is correct even for collapsed branches, and drive it with the core
  // `createTreeSelection`. No cascade logic lives in this adapter.
  const checkNodes = (): TreeSelectionNode[] => {
    const out: TreeSelectionNode[] = []
    const walk = (ns: IrisTreeNode[], parentKey: string | undefined) => {
      for (const node of ns) {
        out.push({ key: node.id, parentKey, disabled: node.disabled })
        if (node.children && node.children.length > 0) walk(node.children, node.id)
      }
    }
    walk(local.nodes, undefined)
    return out
  }

  const checkModel = createTreeSelection({
    nodes: checkNodes(),
    defaultChecked: local.defaultChecked,
    onChange: (keys) => local.onCheckedChange?.(keys),
  })
  // Bridge the model's store into Solid reactivity so checkbox rows re-render on
  // every check change — the same store-binding the rest of the package uses.
  const checkState = useStore(checkModel.selection.store)
  const isChecked = (id: string): boolean => {
    checkState() // track the store so derived check state stays reactive
    return checkModel.isChecked(id)
  }
  const isIndeterminate = (id: string): boolean => {
    checkState()
    return checkModel.isIndeterminate(id)
  }

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

  const renderNodes = (nodes: IrisTreeNode[], depth: number): JSX.Element => (
    <For each={nodes}>
      {(node) => (
        <IrisTreeNodeItem
          node={node}
          depth={depth}
          expanded={() => expandedIds().includes(node.id)}
          selected={() => selectedIds().includes(node.id)}
          checked={() => isChecked(node.id)}
          indeterminate={() => isIndeterminate(node.id)}
          checkable={local.checkable}
          disabled={local.disabled}
          onToggleExpand={() => toggleExpand(node.id)}
          onSelect={() => selectNode(node.id)}
          onCheck={() => checkModel.toggle(node.id)}
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
