import * as React from 'react'
import {
  createTreeSelection,
  flattenTreeSelectionNodes,
  type TreeSelectionNode,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useDataState } from '../../motion'
import { IrisVirtualScroll, type IrisVirtualScrollHandle } from '../virtual-scroll/VirtualScroll'
import type { IrisTreeNode, IrisTreeSelectionMode, IrisTreeVirtualOptions } from './types'
import { TreeNodeView, type IrisTreeFlatNode } from './TreeNode'

type FlatNode = IrisTreeFlatNode

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
  /**
   * Opt-in windowed rendering: only the visible window + buffer of `treeitem`
   * rows is mounted, via `IrisVirtualScroll` / the core `createVirtualizer`.
   * Keyboard navigation scrolls the active row into view. Default off.
   */
  virtual?: IrisTreeVirtualOptions
}

const TREE_STATE_STYLE: React.CSSProperties = {
  padding: '12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
  fontSize: 'var(--iris-font-size-md, 14px)',
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
 *
 * Opt-in `virtual` prop: pass {@link IrisTreeVirtualOptions} to render only the
 * visible window of treeitems (uniform rows) via `IrisVirtualScroll`.
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
  virtual,
  ...rest
}: IrisTreeProps): React.ReactElement {
  const safeNodes = nodes ?? []
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
    empty: safeNodes.length === 0,
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
    walk(safeNodes, 0, null)
    return out
  }, [safeNodes, expandedSet, childrenOf, hasChildrenFn])

  // Checkable mode: flatten the FULL tree (every node, not just the visible
  // ones) into `{ key, parentKey, disabled }` so the cascade is correct even
  // for collapsed branches, and drive it with the core `createTreeSelection`.
  const checkNodes = React.useMemo<TreeSelectionNode[]>(() => {
    return flattenTreeSelectionNodes(safeNodes, {
      getKey: (node) => node.id,
      getChildren: (node) => node.children ?? lazyCache.get(node.id),
      isDisabled: (node) => node.disabled === true,
    })
  }, [safeNodes, lazyCache])

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

  // --- Virtual mode -------------------------------------------------------
  const vsRef = React.useRef<IrisVirtualScrollHandle | null>(null)
  // Set by the six keyboard keys that move activeId; consumed by the
  // focus-follows effect below so only keyboard moves steal focus (mount and
  // pointer-driven changes keep today's no-autofocus behavior).
  const keyboardMoveRef = React.useRef(false)
  // Last flat index the scroll effect targeted. Guards the effect so `flat`
  // changes (expand/collapse) never reset the user's scroll position when the
  // active row did not move — only activeId moves trigger a scroll.
  const lastScrolledIndexRef = React.useRef<number | null>(null)
  // Latest activeId, read by the (rAF-deferred) focus-follows tick so stale
  // chains from superseded keyboard moves drop out instead of stealing focus
  // when their target row later mounts.
  const activeIdRef = React.useRef(activeId)
  activeIdRef.current = activeId

  // Scroll the active row into view (virtual only). `refresh()` re-syncs the
  // window from the element's real scrollTop via rAF, so it is deterministic
  // even where no native scroll event fires (jsdom).
  React.useEffect(() => {
    if (!virtual) return
    if (!activeId) return
    const idx = flat.findIndex((f) => f.node.id === activeId)
    if (idx < 0) return
    if (lastScrolledIndexRef.current === idx) return
    lastScrolledIndexRef.current = idx
    vsRef.current?.scrollToIndex(idx, 'start')
    vsRef.current?.refresh()
  }, [virtual, activeId, flat])

  // Follow the active row with focus across the window (virtual + keyboard
  // only): a row that scrolls out unmounts and focus would drop to <body>.
  // Poll via rAF (max 5 frames ≈ 80ms) until the row remounts, then focus it.
  // Declared after the scroll effect so its rAF registers after the scroll
  // rAF — the final window is rendered before the focus re-check runs.
  React.useEffect(() => {
    if (!virtual || !keyboardMoveRef.current) return
    keyboardMoveRef.current = false
    const targetId = activeId
    let frames = 0
    const tick = () => {
      frames += 1
      if (frames > 5) return
      // A newer keyboard move superseded this chain — drop it instead of
      // stealing focus when the old target row later mounts.
      if (activeIdRef.current !== targetId) return
      const el = Array.from(document.querySelectorAll<HTMLElement>('[data-iris-tree-node]')).find(
        (n) => n.getAttribute('data-iris-tree-node') === targetId,
      )
      if (el) el.focus()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [virtual, activeId])

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
        keyboardMoveRef.current = true
        moveActive(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        keyboardMoveRef.current = true
        moveActive(-1)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (current.hasChildren) {
          if (expandedSet.has(activeId)) {
            keyboardMoveRef.current = true
            moveActive(1)
          } else void expandNode(current.node)
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (current.hasChildren && expandedSet.has(activeId)) {
          collapseNode(activeId)
        } else if (current.parentId) {
          keyboardMoveRef.current = true
          setActiveId(current.parentId)
        }
        break
      case 'Home':
        e.preventDefault()
        keyboardMoveRef.current = true
        setActiveId(flat[0]!.node.id)
        break
      case 'End':
        e.preventDefault()
        keyboardMoveRef.current = true
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

  const renderFlatNode = (flatNode: FlatNode): React.ReactElement => (
    <TreeNodeView
      key={flatNode.node.id}
      flatNode={flatNode}
      expanded={expandedSet}
      selected={selectedSet}
      activeId={activeId}
      loadingIds={loadingIds}
      errorIds={errorIds}
      selectionMode={selectionMode}
      checkable={checkable}
      checkModel={checkModel}
      keyboardMoveRef={keyboardMoveRef}
      setActiveId={setActiveId}
      selectNode={selectNode}
      toggleExpand={toggleExpand}
    />
  )

  if (virtual && isContent) {
    return (
      <IrisVirtualScroll
        ref={vsRef}
        items={flat}
        itemHeight={virtual.itemHeight}
        height={virtual.height}
        buffer={virtual.buffer}
        keyOf={(f) => f.node.id}
        renderItem={(f) => renderFlatNode(f)}
        role="tree"
        aria-label={ariaLabel ?? t('tree.label')}
        aria-busy={state === 'loading' ? true : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={className}
        data-iris-tree=""
        {...rest}
        style={{
          padding: 'var(--iris-padding-sm, 4px)',
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          ...style,
        }}
      />
    )
  }

  return (
    <div
      role="tree"
      aria-label={ariaLabel ?? t('tree.label')}
      aria-busy={state === 'loading' ? true : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={className}
      data-iris-tree=""
      {...rest}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--iris-padding-sm, 4px)',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        fontSize: 'var(--iris-font-size-md, 14px)',
        ...style,
      }}
    >
      {isContent ? (
        flat.map((f) => renderFlatNode(f))
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
