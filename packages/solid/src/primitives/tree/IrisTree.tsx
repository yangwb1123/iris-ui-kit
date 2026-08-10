import {
  createSignal,
  createEffect,
  createMemo,
  mergeProps,
  splitProps,
  Show,
  For,
  type JSX,
} from 'solid-js'
import { createTreeSelection, type TreeSelectionNode } from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'

export interface IrisTreeNode {
  id: string
  label: string
  children?: IrisTreeNode[]
  isLeaf?: boolean
  disabled?: boolean
  /**
   * Lazy children loader. Called the first time the node is expanded.
   * Resolves to the children array; the tree caches the result so subsequent
   * expansions are instant. On rejection the node shows an error state and
   * collapses. (Parity with the React/Vue/Svelte adapters.)
   */
  loadChildren?: () => Promise<IrisTreeNode[]>
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
  /** Accessible name for the tree container. Defaults to the localized "Tree". */
  ariaLabel?: string
  /** Show the loading state instead of nodes. */
  loading?: boolean
  /** Show the error state instead of nodes (takes precedence over loading). */
  error?: boolean
  /** Custom empty-state node (defaults to the localized `tree.empty`). */
  emptyState?: JSX.Element
  /** Custom loading-state node (defaults to the localized `tree.loading`). */
  loadingState?: JSX.Element
  /** Custom error-state node (defaults to the localized `tree.error`). */
  errorState?: JSX.Element
}

function IrisTreeNodeItem(nodeProps: {
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
}): JSX.Element {
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

/**
 * Tree view: expandable nodes, checkable mode, single/multi-select.
 * Solid port of the Vue IrisTree.
 *
 * Supports lazy-loaded children via `IrisTreeNode.loadChildren` — called
 * on the first expansion, cached thereafter, and collapses on rejection
 * with a visual error indicator. (Parity with the React/Vue/Svelte
 * adapters.)
 *
 * Checkable mode renders a checkbox per node with parent/child cascade and
 * indeterminate (tri-state) propagation, driven by the framework-agnostic
 * `createTreeSelection` from `@iris-ui-kit/core` (no cascade logic lives here).
 */
export function IrisTree(props: IrisTreeProps): JSX.Element {
  const { t } = useI18n()
  const merged = mergeProps(
    {
      nodes: [] as IrisTreeNode[],
      defaultSelectedIds: [] as string[],
      defaultExpandedIds: [] as string[],
      selectionMode: 'single' as IrisTreeSelectionMode,
      checkable: false,
      disabled: false,
      loading: false,
      error: false,
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
    'ariaLabel',
    'loading',
    'error',
    'emptyState',
    'loadingState',
    'errorState',
  ])

  const noContent = local.nodes.length === 0 && !local.loading && !local.error

  const [internalSelected, setInternalSelected] = createSignal<string[]>(local.defaultSelectedIds)
  const [internalExpanded, setInternalExpanded] = createSignal<string[]>(local.defaultExpandedIds)

  const selectedIds = () => local.selectedIds ?? internalSelected()
  const expandedIds = () => local.expandedIds ?? internalExpanded()

  // Lazy-loaded children cache + per-node loading/error state (parity with
  // the React/Vue/Svelte adapters).
  const [lazyCache, setLazyCache] = createSignal<Map<string, IrisTreeNode[]>>(new Map())
  const [loadingIds, setLoadingIds] = createSignal<Set<string>>(new Set())
  const [errorIds, setErrorIds] = createSignal<Set<string>>(new Set())

  // Resolve children for a node: eager children > lazy cache.
  const childrenOf = (node: IrisTreeNode): IrisTreeNode[] | null => {
    if (node.children && node.children.length > 0) return node.children
    const cached = lazyCache().get(node.id)
    return cached ?? null
  }

  // Whether a node can have children (eager, cached, or has a loader).
  const hasChildrenFn = (node: IrisTreeNode): boolean => {
    if (node.isLeaf) return false
    if (node.children && node.children.length > 0) return true
    if ((lazyCache().get(node.id)?.length ?? 0) > 0) return true
    return Boolean(node.loadChildren)
  }

  // Checkable mode: flatten the FULL tree (every node, including collapsed and
  // not-yet-rendered children) into `{ key, parentKey, disabled }` so the
  // cascade is correct even for collapsed branches, and drive it with the core
  // `createTreeSelection`. Also includes lazy-cached children.
  const checkNodes = (): TreeSelectionNode[] => {
    const out: TreeSelectionNode[] = []
    const walk = (ns: IrisTreeNode[], parentKey: string | undefined) => {
      for (const node of ns) {
        out.push({ key: node.id, parentKey, disabled: node.disabled })
        const kids = node.children ?? lazyCache().get(node.id)
        if (kids && kids.length > 0) walk(kids, node.id)
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

  const setExpanded = (next: string[]) => {
    if (!local.expandedIds) setInternalExpanded(next)
    local.onExpand?.(next)
  }

  const expandNode = async (node: IrisTreeNode) => {
    if (!hasChildrenFn(node)) return
    if (!expandedIds().includes(node.id)) setExpanded([...expandedIds(), node.id])
    // Trigger lazy load on first expansion of a loader-backed node.
    if (
      node.loadChildren &&
      !lazyCache().has(node.id) &&
      !(node.children && node.children.length > 0)
    ) {
      setLoadingIds((prev) => new Set(prev).add(node.id))
      try {
        const kids = await node.loadChildren()
        setLazyCache((prev) => new Map(prev).set(node.id, kids))
      } catch {
        setErrorIds((prev) => new Set(prev).add(node.id))
        // Collapse on failure.
        setExpanded(expandedIds().filter((x) => x !== node.id))
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
    setExpanded(expandedIds().filter((x) => x !== id))
  }

  const toggleExpand = (node: IrisTreeNode) => {
    if (expandedIds().includes(node.id)) collapseNode(node.id)
    else void expandNode(node)
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

  // Flattened list of the currently-VISIBLE nodes (depth-first, respecting
  // expansion) — the linear order keyboard navigation moves through. Mirrors the
  // React/Vue/Svelte adapters so arrow-key behavior is identical across all four.
  interface FlatNode {
    node: IrisTreeNode
    depth: number
    parentId: string | null
    hasChildren: boolean
  }
  const flat = createMemo<FlatNode[]>(() => {
    const out: FlatNode[] = []
    const expandedNow = expandedIds()
    const walk = (ns: IrisTreeNode[], depth: number, parentId: string | null): void => {
      for (const node of ns) {
        const hc = hasChildrenFn(node)
        out.push({ node, depth, parentId, hasChildren: hc })
        if (hc && expandedNow.includes(node.id)) {
          const kids = childrenOf(node)
          if (kids) walk(kids, depth + 1, node.id)
        }
      }
    }
    walk(local.nodes, 0, null)
    return out
  })

  // Roving focus: exactly one node is the keyboard target (tabindex=0). Seed it to
  // the first visible node and keep it valid as the visible set changes.
  const [activeId, setActiveId] = createSignal<string | null>(null)
  createEffect(() => {
    const list = flat()
    const cur = activeId()
    if (!cur || !list.some((f) => f.node.id === cur)) {
      setActiveId(list[0]?.node.id ?? null)
    }
  })

  const moveActive = (delta: 1 | -1): void => {
    const list = flat()
    if (list.length === 0) return
    const cur = activeId()
    const idx = cur ? list.findIndex((f) => f.node.id === cur) : -1
    let next = idx + delta
    if (next < 0) next = 0
    if (next >= list.length) next = list.length - 1
    setActiveId(list[next]!.node.id)
  }

  // WAI-ARIA tree keyboard pattern (container-level handler reads the active node,
  // so it works regardless of which item bubbled the event):
  //   ↑/↓ move · → expand or into-first-child · ← collapse or to-parent ·
  //   Home/End first/last · Enter/Space (de)select.
  const onKeyDown = (e: KeyboardEvent): void => {
    if (local.disabled) return
    const cur = activeId()
    if (!cur) return
    const list = flat()
    const current = list.find((f) => f.node.id === cur)
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
          if (expandedIds().includes(cur)) moveActive(1)
          else toggleExpand(current.node)
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (current.hasChildren && expandedIds().includes(cur)) collapseNode(cur)
        else if (current.parentId) setActiveId(current.parentId)
        break
      case 'Home':
        e.preventDefault()
        setActiveId(list[0]!.node.id)
        break
      case 'End':
        e.preventDefault()
        setActiveId(list[list.length - 1]!.node.id)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        selectNode(cur)
        break
    }
  }

  const isNodeLoading = (id: string): boolean => loadingIds().has(id)
  const isNodeErrored = (id: string): boolean => errorIds().has(id)

  const renderNodes = (nodes: IrisTreeNode[], depth: number): JSX.Element => (
    <For each={nodes}>
      {(node) => (
        <IrisTreeNodeItem
          node={node}
          depth={depth}
          expanded={() => expandedIds().includes(node.id)}
          selected={() => selectedIds().includes(node.id)}
          active={() => activeId() === node.id}
          checked={() => isChecked(node.id)}
          indeterminate={() => isIndeterminate(node.id)}
          checkable={local.checkable}
          disabled={local.disabled}
          loading={isNodeLoading(node.id)}
          errored={isNodeErrored(node.id)}
          onToggleExpand={() => toggleExpand(node)}
          onSelect={() => selectNode(node.id)}
          onActivate={() => setActiveId(node.id)}
          onCheck={() => checkModel.toggle(node.id)}
        >
          {renderChildren(node, depth)}
        </IrisTreeNodeItem>
      )}
    </For>
  )

  const renderChildren = (node: IrisTreeNode, depth: number): JSX.Element | undefined => {
    const kids = childrenOf(node)
    if (!kids || kids.length === 0) return undefined
    return renderNodes(kids, depth + 1)
  }

  // Top-level state rendering: error > loading > empty > tree content.
  if (local.error) {
    return (
      <div
        data-iris-tree-state="error"
        style={{
          padding: '12px',
          'text-align': 'center',
          color: 'var(--iris-muted)',
          'font-size': 'var(--iris-font-size-md, 14px)',
        }}
      >
        {local.errorState ?? t('tree.error')}
      </div>
    )
  }
  if (local.loading) {
    return (
      <div
        data-iris-tree-state="loading"
        style={{
          padding: '12px',
          'text-align': 'center',
          color: 'var(--iris-muted)',
          'font-size': 'var(--iris-font-size-md, 14px)',
        }}
      >
        {local.loadingState ?? t('tree.loading')}
      </div>
    )
  }
  if (noContent) {
    return (
      <div
        data-iris-tree-state="empty"
        style={{
          padding: '12px',
          'text-align': 'center',
          color: 'var(--iris-muted)',
          'font-size': 'var(--iris-font-size-md, 14px)',
        }}
      >
        {local.emptyState ?? t('tree.empty')}
      </div>
    )
  }

  return (
    <ul
      data-iris-tree=""
      role="tree"
      aria-label={local.ariaLabel ?? t('tree.label')}
      aria-busy={local.loading ? 'true' : undefined}
      data-disabled={local.disabled ? '' : undefined}
      tabindex={-1}
      onKeyDown={onKeyDown}
      style={{ 'list-style': 'none', margin: '0', padding: '0' }}
    >
      {renderNodes(local.nodes, 0)}
    </ul>
  )
}
