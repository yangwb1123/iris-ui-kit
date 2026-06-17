<script lang="ts">
  import { createTreeSelection, type TreeSelectionNode } from '@iris-ui/core'
  import { useI18n } from '../../i18n'
  import type { IrisTreeNode, IrisTreeSelectionMode } from './types'

  interface FlatNode {
    node: IrisTreeNode
    depth: number
    parentId: string | null
    hasChildren: boolean
  }

  interface Props {
    nodes?: IrisTreeNode[]
    expanded?: string[]
    defaultExpanded?: string[]
    selected?: string[]
    defaultSelected?: string[]
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
    loading?: boolean
    error?: boolean
    onExpandedChange?: (ids: string[]) => void
    onSelectedChange?: (ids: string[]) => void
    onExpand?: (id: string) => void
    onCollapse?: (id: string) => void
    onSelect?: (id: string, node: IrisTreeNode) => void
    style?: string
    class?: string
  }

  let {
    nodes = [],
    expanded: expandedProp,
    defaultExpanded = [],
    selected: selectedProp,
    defaultSelected = [],
    selectionMode = 'single',
    checkable = false,
    defaultChecked,
    onCheckedChange,
    ariaLabel,
    loading = false,
    error = false,
    onExpandedChange,
    onSelectedChange,
    onExpand,
    onCollapse,
    onSelect,
    style,
    class: className,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  const isExpandedControlled = $derived(expandedProp !== undefined)
  const isSelectedControlled = $derived(selectedProp !== undefined)

  // svelte-ignore state_referenced_locally
  let internalExpanded = $state<Set<string>>(new Set(defaultExpanded))
  // svelte-ignore state_referenced_locally
  let internalSelected = $state<Set<string>>(new Set(defaultSelected))

  // Lazy children cache
  let childrenCache = $state<Map<string, IrisTreeNode[]>>(new Map())
  let loadingNodes = $state<Set<string>>(new Set())

  const expandedSet = $derived(
    isExpandedControlled ? new Set(expandedProp ?? []) : internalExpanded,
  )

  const selectedSet = $derived(
    isSelectedControlled ? new Set(selectedProp ?? []) : internalSelected,
  )

  let activeId = $state<string | null>(null)

  // Build flat list of visible nodes
  function flatten(nodeList: IrisTreeNode[], depth: number, parentId: string | null): FlatNode[] {
    const out: FlatNode[] = []
    for (const node of nodeList) {
      const cachedChildren = childrenCache.get(node.id)
      const resolvedChildren = cachedChildren ?? node.children
      const hasChildren = node.isLeaf
        ? false
        : resolvedChildren
          ? resolvedChildren.length > 0
          : !!node.loadChildren
      out.push({ node, depth, parentId, hasChildren })
      if (hasChildren && expandedSet.has(node.id)) {
        out.push(...flatten(resolvedChildren ?? [], depth + 1, node.id))
      }
    }
    return out
  }

  const flat = $derived(flatten(nodes, 0, null))

  // Checkable mode: flatten the FULL tree (every node, not just the visible
  // ones) into `{ key, parentKey, disabled }` so the cascade is correct even
  // for collapsed branches, and drive it with the core `createTreeSelection`.
  function flattenCheckNodes(
    nodeList: IrisTreeNode[],
    parentKey: string | undefined,
  ): TreeSelectionNode[] {
    const out: TreeSelectionNode[] = []
    for (const node of nodeList) {
      out.push({ key: node.id, parentKey, disabled: node.disabled })
      const kids = node.children ?? childrenCache.get(node.id)
      if (kids && kids.length > 0) out.push(...flattenCheckNodes(kids, node.id))
    }
    return out
  }

  const checkNodes = $derived(flattenCheckNodes(nodes, undefined))

  // Rebuild the cascade model when the tree shape changes; `defaultChecked`
  // re-seeds then. The model owns its checked-set store.
  const checkModel = $derived(
    createTreeSelection({
      nodes: checkNodes,
      defaultChecked,
      onChange: (keys) => onCheckedChange?.(keys),
    }),
  )

  // Re-render when the checked set changes. Mirror the model's store into local
  // reactive state (re-subscribing whenever the model is rebuilt); reading
  // `checkedKeys` inside the `{#each}` makes `isChecked`/`isIndeterminate`
  // reactive.
  // svelte-ignore state_referenced_locally
  let checkedKeys = $state<string[]>(checkModel.selection.get())
  $effect(() => {
    const model = checkModel
    checkedKeys = model.selection.get()
    return model.selection.store.subscribe((v) => {
      checkedKeys = v
    })
  })

  // Resolve check state through the model. `keys` is the reactive checked-set
  // snapshot — passing it in makes these reads re-run when the set changes.
  function checkChecked(id: string, keys: string[]): boolean {
    void keys
    return checkModel.isChecked(id)
  }
  function checkIndeterminate(id: string, keys: string[]): boolean {
    void keys
    return checkModel.isIndeterminate(id)
  }

  // `indeterminate` is a DOM property, not an attribute. Set it via an action
  // whose `update` re-runs whenever the passed boolean changes.
  function setIndeterminate(el: HTMLInputElement, value: boolean) {
    el.indeterminate = value
    return {
      update(next: boolean) {
        el.indeterminate = next
      },
    }
  }

  function setExpanded(ids: string[]) {
    if (!isExpandedControlled) internalExpanded = new Set(ids)
    onExpandedChange?.(ids)
  }

  function setSelected(ids: string[]) {
    if (!isSelectedControlled) internalSelected = new Set(ids)
    onSelectedChange?.(ids)
  }

  function toggleExpand(node: IrisTreeNode) {
    const exp = expandedSet
    if (exp.has(node.id)) {
      const next = new Set(exp)
      next.delete(node.id)
      setExpanded([...next])
      onCollapse?.(node.id)
    } else {
      const next = new Set(exp)
      next.add(node.id)
      setExpanded([...next])
      onExpand?.(node.id)

      // Lazy loading
      if (node.loadChildren && !childrenCache.has(node.id)) {
        const ls = new Set(loadingNodes)
        ls.add(node.id)
        loadingNodes = ls
        node.loadChildren().then((children) => {
          const cache = new Map(childrenCache)
          cache.set(node.id, children)
          childrenCache = cache
          const ls2 = new Set(loadingNodes)
          ls2.delete(node.id)
          loadingNodes = ls2
        })
      }
    }
  }

  function selectNode(node: IrisTreeNode) {
    if (node.disabled || selectionMode === 'none') return
    const sel = selectedSet
    if (selectionMode === 'single') {
      setSelected([node.id])
    } else {
      const next = new Set(sel)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      setSelected([...next])
    }
    onSelect?.(node.id, node)
  }

  function onKeyDown(e: KeyboardEvent, fn: FlatNode, idx: number) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (flat[idx + 1]) activeId = flat[idx + 1].node.id
        break
      case 'ArrowUp':
        e.preventDefault()
        if (flat[idx - 1]) activeId = flat[idx - 1].node.id
        break
      case 'ArrowRight':
        e.preventDefault()
        if (fn.hasChildren && !expandedSet.has(fn.node.id)) toggleExpand(fn.node)
        else if (fn.hasChildren && flat[idx + 1]) activeId = flat[idx + 1].node.id
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (fn.hasChildren && expandedSet.has(fn.node.id)) toggleExpand(fn.node)
        else if (fn.parentId) activeId = fn.parentId
        break
      case 'Home':
        e.preventDefault()
        if (flat[0]) activeId = flat[0].node.id
        break
      case 'End':
        e.preventDefault()
        if (flat[flat.length - 1]) activeId = flat[flat.length - 1].node.id
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        selectNode(fn.node)
        break
    }
  }
</script>

<div
  role="tree"
  aria-label={ariaLabel ?? t('tree.label')}
  data-iris-tree
  style:display="flex"
  style:flex-direction="column"
  {style}
  class={className}
  {...rest}
>
  {#if loading}
    <div
      data-iris-state="loading"
      style:padding="12px"
      style:color="var(--iris-muted)"
      style:font-size="14px"
    >
      {t('tree.loading')}
    </div>
  {:else if error}
    <div
      data-iris-state="error"
      style:padding="12px"
      style:color="var(--iris-danger)"
      style:font-size="14px"
    >
      {t('tree.error')}
    </div>
  {:else if nodes.length === 0}
    <div
      data-iris-state="empty"
      style:padding="12px"
      style:color="var(--iris-muted)"
      style:font-size="14px"
    >
      {t('tree.empty')}
    </div>
  {:else}
    {#each flat as fn, idx (fn.node.id)}
      {@const isExpanded = expandedSet.has(fn.node.id)}
      {@const isSelected = selectedSet.has(fn.node.id)}
      {@const isFocused = activeId === fn.node.id}
      {@const isChecked = checkChecked(fn.node.id, checkedKeys)}
      {@const isIndeterminate = checkIndeterminate(fn.node.id, checkedKeys)}
      <div
        role="treeitem"
        aria-expanded={fn.hasChildren ? isExpanded : undefined}
        aria-selected={selectionMode !== 'none' ? isSelected : undefined}
        aria-disabled={fn.node.disabled ? 'true' : undefined}
        aria-level={fn.depth + 1}
        tabindex={isFocused || (idx === 0 && !activeId) ? 0 : -1}
        data-iris-tree-item
        data-state={isSelected ? 'selected' : 'idle'}
        onkeydown={(e) => onKeyDown(e, fn, idx)}
        onfocus={() => {
          activeId = fn.node.id
        }}
        onclick={() => {
          activeId = fn.node.id
          selectNode(fn.node)
        }}
        style:display="flex"
        style:align-items="center"
        style:gap="4px"
        style:padding="4px 8px"
        style:padding-left={`${8 + fn.depth * 16}px`}
        style:cursor={fn.node.disabled ? 'default' : 'pointer'}
        style:border-radius="var(--iris-radius-sm, 4px)"
        style:background={isSelected ? 'var(--iris-surface-hover)' : 'transparent'}
        style:color={fn.node.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)'}
        style:font-size="14px"
        style:outline={isFocused ? '2px solid var(--iris-primary)' : 'none'}
        style:outline-offset="1px"
      >
        {#if fn.hasChildren}
          <button
            type="button"
            aria-hidden="true"
            tabindex={-1}
            onclick={(e) => {
              e.stopPropagation()
              toggleExpand(fn.node)
            }}
            style:width="16px"
            style:height="16px"
            style:display="inline-flex"
            style:align-items="center"
            style:justify-content="center"
            style:border="none"
            style:background="transparent"
            style:color="var(--iris-muted)"
            style:cursor="pointer"
            style:padding="0"
            style:font-size="10px"
            style:flex-shrink="0">{isExpanded ? '▼' : '▶'}</button
          >
        {:else}
          <span style:width="16px" style:flex-shrink="0"></span>
        {/if}
        {#if checkable}
          <input
            type="checkbox"
            data-iris-tree-checkbox
            checked={isChecked}
            aria-checked={isIndeterminate ? 'mixed' : isChecked}
            aria-label={fn.node.label}
            disabled={fn.node.disabled}
            use:setIndeterminate={isIndeterminate}
            onclick={(e) => e.stopPropagation()}
            onchange={() => checkModel.toggle(fn.node.id)}
            style:cursor={fn.node.disabled ? 'not-allowed' : 'pointer'}
            style:flex-shrink="0"
          />
        {/if}
        {#if loadingNodes.has(fn.node.id)}
          <span aria-hidden="true" style:color="var(--iris-muted)" style:font-size="11px">…</span>
        {/if}
        <span>{fn.node.label}</span>
      </div>
    {/each}
  {/if}
</div>
