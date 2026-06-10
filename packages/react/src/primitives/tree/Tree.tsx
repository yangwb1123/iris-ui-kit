import * as React from 'react'
import { createTreeSelection, type TreeSelectionNode } from '@iris-ui/core'
import { useI18n } from '../../i18n'
import { useDataState } from '../../motion'
import type { IrisTreeNode, IrisTreeSelectionMode } from './types'

interface FlatNode {
  node: IrisTreeNode
  depth: number
  parentId: string | null
  hasChildren: boolean
}

export interface IrisTreeProps {
  nodes: IrisTreeNode[]
  expanded?: string[]
  defaultExpanded?: string[]
  onExpandedChange?: (next: string[]) => void
  selected?: string[]
  defaultSelected?: string[]
  onSelectedChange?: (next: string[]) => void
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
  ariaLabel?: string
  /** Show the loading state instead of nodes. */
  loading?: boolean
  /** Show the error state instead of nodes (takes precedence over loading). */
  error?: boolean
  /** Custom empty-state node (defaults to the localized `tree.empty`). */
  emptyState?: React.ReactNode
  /** Custom loading-state node (defaults to the localized `tree.loading`). */
  loadingState?: React.ReactNode
  /** Custom error-state node (defaults to the localized `tree.error`). */
  errorState?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const TREE_STATE_STYLE: React.CSSProperties = {
  padding: '12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
  fontSize: 14,
}

/**
 * Tree control. Renders a hierarchy of `IrisTreeNode`s with expand/collapse,
 * single/multi selection, and optional lazy-loaded children. WAI-ARIA Tree
 * pattern: root `role="tree"`, each node `role="treeitem"`, roving tabindex.
 *
 * Keyboard:
 *   - ↓/↑ : move active node
 *   - → : expand (or move into first child)
 *   - ← : collapse (or move to parent)
 *   - Enter / Space : (de)select active node
 *   - Home / End : first / last visible node
 *
 * Async lifecycle: pass `loading` / `error` (and empty `nodes`) to render the
 * animated loading / error / empty state in place of the tree. Per-node
 * `loadChildren` lazy loading is independent of this top-level state. Semantic
 * parity with the Vue adapter's `IrisTree`.
 */
export function IrisTree({
  nodes,
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  selected: selectedProp,
  defaultSelected = [],
  onSelectedChange,
  selectionMode = 'single',
  checkable = false,
  defaultChecked,
  onCheckedChange,
  ariaLabel,
  loading = false,
  error = false,
  emptyState,
  loadingState,
  errorState,
  style,
  className,
}: IrisTreeProps): React.ReactElement {
  const expControlled = expandedProp !== undefined
  const selControlled = selectedProp !== undefined
  const [expInternal, setExpInternal] = React.useState<string[]>(defaultExpanded)
  const [selInternal, setSelInternal] = React.useState<string[]>(defaultSelected)
  const expanded = expControlled ? (expandedProp as string[]) : expInternal
  const selected = selControlled ? (selectedProp as string[]) : selInternal

  const { t } = useI18n()
  const { state, isContent, stateKey, stateProps } = useDataState({
    loading,
    error,
    empty: nodes.length === 0,
  })

  // Lazily-loaded children cache + per-node loading/error state (parity with
  // the Vue adapter, which supports `node.loadChildren`).
  const [lazyCache, setLazyCache] = React.useState<Map<string, IrisTreeNode[]>>(new Map())
  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(new Set())
  const [errorIds, setErrorIds] = React.useState<Set<string>>(new Set())

  const expandedSet = React.useMemo(() => new Set(expanded), [expanded])
  const selectedSet = React.useMemo(() => new Set(selected), [selected])

  const childrenOf = React.useCallback(
    (node: IrisTreeNode): IrisTreeNode[] | null => {
      if (node.children && node.children.length > 0) return node.children
      return lazyCache.get(node.id) ?? null
    },
    [lazyCache],
  )

  const hasChildrenFn = React.useCallback(
    (node: IrisTreeNode): boolean => {
      if (node.isLeaf) return false
      if (node.children && node.children.length > 0) return true
      if (lazyCache.has(node.id)) return (lazyCache.get(node.id)?.length ?? 0) > 0
      return Boolean(node.loadChildren)
    },
    [lazyCache],
  )

  const flat = React.useMemo(() => {
    const out: FlatNode[] = []
    const walk = (ns: IrisTreeNode[], depth: number, parentId: string | null) => {
      for (const node of ns) {
        const hasChildren = hasChildrenFn(node)
        out.push({ node, depth, parentId, hasChildren })
        if (hasChildren && expandedSet.has(node.id)) {
          const kids = childrenOf(node)
          if (kids) walk(kids, depth + 1, node.id)
        }
      }
    }
    walk(nodes, 0, null)
    return out
  }, [nodes, expandedSet, childrenOf, hasChildrenFn])

  // Checkable mode: flatten the FULL tree (every node, not just the visible
  // ones) into `{ key, parentKey, disabled }` so the cascade is correct even
  // for collapsed branches, and drive it with the core `createTreeSelection`.
  const checkNodes = React.useMemo<TreeSelectionNode[]>(() => {
    const out: TreeSelectionNode[] = []
    const walk = (ns: IrisTreeNode[], parentKey: string | undefined) => {
      for (const node of ns) {
        out.push({ key: node.id, parentKey, disabled: node.disabled })
        const kids = node.children ?? lazyCache.get(node.id)
        if (kids && kids.length > 0) walk(kids, node.id)
      }
    }
    walk(nodes, undefined)
    return out
  }, [nodes, lazyCache])

  const onCheckedRef = React.useRef(onCheckedChange)
  onCheckedRef.current = onCheckedChange
  // Rebuild when the tree shape changes; defaultChecked re-seeds then.
  const checkModel = React.useMemo(
    () =>
      createTreeSelection({
        nodes: checkNodes,
        defaultChecked,
        onChange: (keys) => onCheckedRef.current?.(keys),
      }),
    [checkNodes, defaultChecked],
  )
  // Re-render when the checked set changes.
  React.useSyncExternalStore(
    checkModel.selection.store.subscribe,
    checkModel.selection.get,
    checkModel.selection.get,
  )

  const [activeId, setActiveId] = React.useState<string | null>(flat[0]?.node.id ?? null)

  // Keep activeId valid as the visible set changes.
  React.useEffect(() => {
    if (!activeId || !flat.some((f) => f.node.id === activeId)) {
      setActiveId(flat[0]?.node.id ?? null)
    }
  }, [flat, activeId])

  // Always-current expanded list so the async error handler collapses against
  // the latest state rather than a stale render closure.
  const expandedRef = React.useRef(expanded)
  expandedRef.current = expanded

  const setExpanded = (next: string[]) => {
    if (!expControlled) setExpInternal(next)
    onExpandedChange?.(next)
  }
  const setSelected = (next: string[]) => {
    if (!selControlled) setSelInternal(next)
    onSelectedChange?.(next)
  }

  const expandNode = async (node: IrisTreeNode) => {
    if (!hasChildrenFn(node)) return
    if (!expandedSet.has(node.id)) setExpanded([...expanded, node.id])
    // Trigger lazy load on first expansion of a loader-backed node.
    if (
      node.loadChildren &&
      !lazyCache.has(node.id) &&
      !(node.children && node.children.length > 0)
    ) {
      setLoadingIds((prev) => new Set(prev).add(node.id))
      try {
        const kids = await node.loadChildren()
        setLazyCache((prev) => new Map(prev).set(node.id, kids))
      } catch {
        setErrorIds((prev) => new Set(prev).add(node.id))
        // Collapse on failure (against the latest expanded state).
        setExpanded(expandedRef.current.filter((x) => x !== node.id))
      } finally {
        setLoadingIds((prev) => {
          const n = new Set(prev)
          n.delete(node.id)
          return n
        })
      }
    }
  }

  const collapseNode = (id: string) => {
    setExpanded(expanded.filter((x) => x !== id))
  }

  const toggleExpand = (node: IrisTreeNode) => {
    if (expandedSet.has(node.id)) collapseNode(node.id)
    else void expandNode(node)
  }

  const selectNode = (id: string) => {
    if (selectionMode === 'none') return
    const node = flat.find((f) => f.node.id === id)?.node
    if (!node || node.disabled) return
    if (selectionMode === 'multi') {
      setSelected(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id])
      return
    }
    setSelected([id])
  }

  const moveActive = (delta: 1 | -1) => {
    if (flat.length === 0) return
    const idx = activeId ? flat.findIndex((f) => f.node.id === activeId) : -1
    let next = idx + delta
    if (next < 0) next = 0
    if (next >= flat.length) next = flat.length - 1
    setActiveId(flat[next]!.node.id)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isContent || !activeId) return
    const current = flat.find((f) => f.node.id === activeId)
    if (!current) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveActive(-1)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (current.hasChildren) {
          if (expandedSet.has(activeId)) moveActive(1)
          else void expandNode(current.node)
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (current.hasChildren && expandedSet.has(activeId)) {
          collapseNode(activeId)
        } else if (current.parentId) {
          setActiveId(current.parentId)
        }
        break
      case 'Home':
        e.preventDefault()
        setActiveId(flat[0]!.node.id)
        break
      case 'End':
        e.preventDefault()
        setActiveId(flat[flat.length - 1]!.node.id)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        selectNode(activeId)
        break
    }
  }

  const stateNode =
    state === 'error'
      ? (errorState ?? t('tree.error'))
      : state === 'loading'
        ? (loadingState ?? t('tree.loading'))
        : (emptyState ?? t('tree.empty'))

  return (
    <div
      role="tree"
      aria-label={ariaLabel ?? t('tree.label')}
      aria-busy={state === 'loading' ? true : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={className}
      data-iris-tree=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--iris-padding-sm, 4px)',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        fontSize: 14,
        ...style,
      }}
    >
      {isContent ? (
        flat.map(({ node, depth, hasChildren }) => {
          const isExpanded = expandedSet.has(node.id)
          const isSelected = selectedSet.has(node.id)
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
                  onClick={(e) => {
                    e.stopPropagation()
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
                    fontSize: 11,
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
                  ref={(el) => {
                    if (el) el.indeterminate = checkModel.isIndeterminate(node.id)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => checkModel.toggle(node.id)}
                  style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                />
              )}
              <span data-iris-tree-label="" style={{ flex: 1, minWidth: 0 }}>
                {node.label}
              </span>
            </div>
          )
        })
      ) : (
        <div
          key={stateKey}
          role="presentation"
          data-iris-tree-state={state}
          aria-live="polite"
          {...stateProps}
          style={TREE_STATE_STYLE}
        >
          {stateNode}
        </div>
      )}
    </div>
  )
}
