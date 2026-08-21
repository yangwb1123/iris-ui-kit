import { createEffect, Show, type JSX } from 'solid-js'
import type { IrisTreeNode } from './IrisTree'

export interface IrisTreeNodeItemProps {
  node: IrisTreeNode
  depth: number
  expanded: () => boolean
  selected: () => boolean
  active: () => boolean
  checked: () => boolean
  indeterminate: () => boolean
  checkable: boolean
  disabled: boolean
  onToggleExpand: () => void
  onSelect: () => void
  onActivate: () => void
  onCheck: () => void
  loading?: boolean
  errored?: boolean
  children?: JSX.Element
}

/** Render one tree item and its recursively supplied child list. */
export function TreeNodeItem(nodeProps: IrisTreeNodeItemProps): JSX.Element {
  const hasChildren = () => {
    if (nodeProps.node.isLeaf) return false
    if (nodeProps.node.children && nodeProps.node.children.length > 0) return true
    return Boolean(nodeProps.node.loadChildren)
  }
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
      aria-level={nodeProps.depth + 1}
      aria-disabled={isDisabled() ? 'true' : undefined}
      aria-busy={nodeProps.loading ? 'true' : undefined}
      data-error={nodeProps.errored ? '' : undefined}
      tabindex={nodeProps.active() ? 0 : -1}
      data-iris-tree-node={nodeProps.node.id}
      data-depth={nodeProps.depth}
      data-state={nodeProps.selected() ? 'selected' : nodeProps.active() ? 'active' : 'idle'}
      onFocus={() => nodeProps.onActivate()}
    >
      <div
        data-iris-tree-node-row=""
        onClick={() => {
          if (isDisabled()) return
          nodeProps.onActivate()
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
          <Show
            when={!nodeProps.loading}
            fallback={
              <span
                data-iris-tree-loading=""
                style={{
                  'font-size': 'var(--iris-font-size-xs, 12px)',
                  'user-select': 'none',
                  color: 'var(--iris-muted, #64748b)',
                }}
              >
                ⟳
              </span>
            }
          >
            <span
              data-iris-tree-expand=""
              style={{
                'font-size': 'var(--iris-font-size-xs, 12px)',
                transition: 'transform 150ms',
                transform: nodeProps.expanded() ? 'rotate(90deg)' : 'none',
                'user-select': 'none',
              }}
            >
              ▶
            </span>
          </Show>
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
        <span
          style={{ 'font-size': 'var(--iris-font-size-md, 14px)', color: 'var(--iris-foreground)' }}
        >
          {nodeProps.node.label}
        </span>
        <Show when={nodeProps.errored}>
          <span
            data-iris-tree-error=""
            style={{
              'font-size': 'var(--iris-font-size-xs, 12px)',
              'margin-left': '4px',
              color: 'var(--iris-danger, #ef4444)',
            }}
          >
            !
          </span>
        </Show>
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
