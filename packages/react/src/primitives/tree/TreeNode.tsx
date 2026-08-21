import * as React from 'react'
import type { IrisTreeNode, IrisTreeSelectionMode } from './types'

export interface IrisTreeFlatNode {
  node: IrisTreeNode
  depth: number
  parentId: string | null
  hasChildren: boolean
}

interface TreeCheckModel {
  isChecked: (id: string) => boolean
  isIndeterminate: (id: string) => boolean
  toggle: (id: string) => void
}

export interface IrisTreeNodeProps {
  flatNode: IrisTreeFlatNode
  expanded: Set<string>
  selected: Set<string>
  activeId: string | null
  loadingIds: Set<string>
  errorIds: Set<string>
  selectionMode: IrisTreeSelectionMode
  checkable: boolean
  checkModel: TreeCheckModel
  keyboardMoveRef: React.MutableRefObject<boolean>
  setActiveId: (id: string) => void
  selectNode: (id: string) => void
  toggleExpand: (node: IrisTreeNode) => void
}

export function TreeNodeView({
  flatNode,
  expanded,
  selected,
  activeId,
  loadingIds,
  errorIds,
  selectionMode,
  checkable,
  checkModel,
  keyboardMoveRef,
  setActiveId,
  selectNode,
  toggleExpand,
}: IrisTreeNodeProps): React.ReactElement {
  const { node, depth, hasChildren } = flatNode
  const isExpanded = expanded.has(node.id)
  const isSelected = selected.has(node.id)
  const isActive = node.id === activeId
  const isLoading = loadingIds.has(node.id)
  const isError = errorIds.has(node.id)
  const disabled = Boolean(node.disabled)
  return (
    <div
      key={node.id}
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={selectionMode !== 'none' ? isSelected : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      aria-level={depth + 1}
      tabIndex={isActive ? 0 : -1}
      data-iris-tree-node={node.id}
      data-state={isSelected ? 'selected' : isActive ? 'active' : 'idle'}
      data-loading={isLoading ? '' : undefined}
      data-error={isError ? '' : undefined}
      onClick={() => {
        keyboardMoveRef.current = false
        setActiveId(node.id)
        selectNode(node.id)
      }}
      onFocus={() => setActiveId(node.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        paddingInlineStart: 6 + depth * 16,
        paddingTop: 4,
        paddingBottom: 4,
        paddingInlineEnd: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: isSelected
          ? 'var(--iris-primary)'
          : isActive
            ? 'var(--iris-surface-hover)'
            : 'transparent',
        color: isSelected ? 'var(--iris-primary-foreground, #fff)' : 'inherit',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        outline: 'none',
        userSelect: 'none',
      }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          data-iris-tree-toggle=""
          onClick={(event) => {
            event.stopPropagation()
            toggleExpand(node)
          }}
          style={{
            width: 16,
            height: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            fontSize: 'var(--iris-font-size-xs, 12px)',
            fontFamily: 'inherit',
            transition: 'transform 120ms ease',
            transform: isLoading ? 'none' : isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {isLoading ? (
            <svg
              className="iris-button-spinner"
              viewBox="0 0 24 24"
              width={12}
              height={12}
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx={12}
                cy={12}
                r={10}
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={3}
              />
              <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </svg>
          ) : (
            '▸'
          )}
        </button>
      ) : (
        <span style={{ width: 16, display: 'inline-block' }} />
      )}
      {checkable && (
        <input
          type="checkbox"
          data-iris-tree-checkbox=""
          checked={checkModel.isChecked(node.id)}
          aria-checked={
            checkModel.isIndeterminate(node.id) ? 'mixed' : checkModel.isChecked(node.id)
          }
          aria-label={node.label}
          disabled={disabled}
          ref={(element) => {
            if (element) element.indeterminate = checkModel.isIndeterminate(node.id)
          }}
          onClick={(event) => event.stopPropagation()}
          onChange={() => checkModel.toggle(node.id)}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
      )}
      <span data-iris-tree-label="" style={{ flex: 1, minWidth: 0 }}>
        {node.label}
      </span>
    </div>
  )
}
