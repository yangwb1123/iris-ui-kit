import { computed, defineComponent, h, ref, watch, type PropType, type VNode } from 'vue'
import type { IrisTreeNode, IrisTreeSelectionMode } from './types'

interface FlatNode {
  node: IrisTreeNode
  depth: number
  parentId: string | null
  hasChildren: boolean
}

/**
 * Tree control. Renders a hierarchy of `IrisTreeNode`s with expand/collapse,
 * single/multi selection, optional lazy-loaded children, and WAI-ARIA Tree
 * pattern semantics:
 *
 *   - Root has `role="tree"`; each node has `role="treeitem"`.
 *   - Roving tabindex (only the active node has `tabindex=0`).
 *   - Arrow keys: ↓/↑ to move, → to expand (or move into first child),
 *     ← to collapse (or move to parent), Enter/Space to select.
 *
 * Selection model is decoupled from expansion — a node can be expanded
 * without being selected, and vice versa.
 *
 * @example
 *   <IrisTree
 *     :nodes="files"
 *     v-model:expanded="expanded"
 *     v-model:selected="selected"
 *     selection-mode="single"
 *   />
 */
export const IrisTree = defineComponent({
  name: 'IrisTree',
  inheritAttrs: false,
  props: {
    nodes: { type: Array as PropType<IrisTreeNode[]>, required: true },
    /** Controlled expanded ids. */
    expanded: { type: Array as PropType<string[]>, default: undefined },
    defaultExpanded: { type: Array as PropType<string[]>, default: () => [] },
    /** Controlled selected ids. */
    selected: { type: Array as PropType<string[]>, default: undefined },
    defaultSelected: { type: Array as PropType<string[]>, default: () => [] },
    selectionMode: { type: String as PropType<IrisTreeSelectionMode>, default: 'single' },
    /** ARIA label. */
    ariaLabel: { type: String, default: 'Tree' },
  },
  emits: {
    'update:expanded': (_value: string[]) => true,
    'update:selected': (_value: string[]) => true,
    expand: (_id: string) => true,
    collapse: (_id: string) => true,
    select: (_id: string, _node: IrisTreeNode) => true,
  },
  setup(props, { attrs, emit }) {
    // Lazily-loaded children cache, keyed by node id.
    const lazyCache = ref<Map<string, IrisTreeNode[]>>(new Map())
    // Set of ids currently loading children.
    const loadingIds = ref<Set<string>>(new Set())
    // Set of ids that errored on load.
    const errorIds = ref<Set<string>>(new Set())

    const internalExpanded = ref<string[]>(props.defaultExpanded)
    const internalSelected = ref<string[]>(props.defaultSelected)

    const expandedIds = computed<Set<string>>(() => {
      const source = props.expanded ?? internalExpanded.value
      return new Set(source)
    })
    const selectedIds = computed<Set<string>>(() => {
      const source = props.selected ?? internalSelected.value
      return new Set(source)
    })

    const setExpanded = (next: string[]) => {
      if (props.expanded === undefined) internalExpanded.value = next
      emit('update:expanded', next)
    }
    const setSelected = (next: string[]) => {
      if (props.selected === undefined) internalSelected.value = next
      emit('update:selected', next)
    }

    const childrenOf = (node: IrisTreeNode): IrisTreeNode[] | null => {
      if (node.children && node.children.length > 0) return node.children
      const cached = lazyCache.value.get(node.id)
      if (cached) return cached
      return null
    }

    const hasChildrenFn = (node: IrisTreeNode): boolean => {
      if (node.isLeaf) return false
      if (node.children && node.children.length > 0) return true
      if (lazyCache.value.has(node.id)) return (lazyCache.value.get(node.id)?.length ?? 0) > 0
      return !!node.loadChildren
    }

    /** Flatten the visible tree into a linear sequence for keyboard nav. */
    const flat = computed<FlatNode[]>(() => {
      const out: FlatNode[] = []
      const walk = (nodes: IrisTreeNode[], depth: number, parentId: string | null) => {
        for (const node of nodes) {
          out.push({ node, depth, parentId, hasChildren: hasChildrenFn(node) })
          if (expandedIds.value.has(node.id)) {
            const kids = childrenOf(node)
            if (kids) walk(kids, depth + 1, node.id)
          }
        }
      }
      walk(props.nodes, 0, null)
      return out
    })

    const activeId = ref<string | null>(flat.value[0]?.node.id ?? null)
    watch(flat, (next) => {
      if (!next.find((f) => f.node.id === activeId.value)) {
        activeId.value = next[0]?.node.id ?? null
      }
    })

    async function expandNode(node: IrisTreeNode) {
      if (!hasChildrenFn(node)) return
      const nextSet = new Set(expandedIds.value)
      nextSet.add(node.id)
      setExpanded(Array.from(nextSet))
      emit('expand', node.id)

      // Trigger lazy load if needed.
      if (
        node.loadChildren &&
        !lazyCache.value.has(node.id) &&
        (!node.children || node.children.length === 0)
      ) {
        loadingIds.value.add(node.id)
        loadingIds.value = new Set(loadingIds.value)
        try {
          const kids = await node.loadChildren()
          lazyCache.value.set(node.id, kids)
          lazyCache.value = new Map(lazyCache.value)
        } catch {
          errorIds.value.add(node.id)
          errorIds.value = new Set(errorIds.value)
          // Collapse on failure.
          const reset = new Set(expandedIds.value)
          reset.delete(node.id)
          setExpanded(Array.from(reset))
        } finally {
          loadingIds.value.delete(node.id)
          loadingIds.value = new Set(loadingIds.value)
        }
      }
    }

    function collapseNode(node: IrisTreeNode) {
      const nextSet = new Set(expandedIds.value)
      nextSet.delete(node.id)
      setExpanded(Array.from(nextSet))
      emit('collapse', node.id)
    }

    function toggleNode(node: IrisTreeNode) {
      if (expandedIds.value.has(node.id)) collapseNode(node)
      else void expandNode(node)
    }

    function selectNode(node: IrisTreeNode) {
      if (node.disabled) return
      if (props.selectionMode === 'none') return
      const current = selectedIds.value
      if (props.selectionMode === 'single') {
        setSelected(current.has(node.id) ? [] : [node.id])
      } else {
        const next = new Set(current)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        setSelected(Array.from(next))
      }
      emit('select', node.id, node)
    }

    function moveActive(delta: 1 | -1) {
      const list = flat.value
      if (list.length === 0) return
      const idx = list.findIndex((f) => f.node.id === activeId.value)
      let next = idx + delta
      if (next < 0) next = 0
      if (next >= list.length) next = list.length - 1
      activeId.value = list[next]?.node.id ?? null
    }

    function onKeyDown(event: KeyboardEvent, flatNode: FlatNode) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          moveActive(1)
          break
        case 'ArrowUp':
          event.preventDefault()
          moveActive(-1)
          break
        case 'ArrowRight':
          event.preventDefault()
          if (flatNode.hasChildren) {
            if (expandedIds.value.has(flatNode.node.id)) moveActive(1)
            else void expandNode(flatNode.node)
          }
          break
        case 'ArrowLeft':
          event.preventDefault()
          if (expandedIds.value.has(flatNode.node.id)) {
            collapseNode(flatNode.node)
          } else if (flatNode.parentId) {
            activeId.value = flatNode.parentId
          }
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          selectNode(flatNode.node)
          break
        case 'Home':
          event.preventDefault()
          activeId.value = flat.value[0]?.node.id ?? null
          break
        case 'End':
          event.preventDefault()
          activeId.value = flat.value[flat.value.length - 1]?.node.id ?? null
          break
      }
    }

    return () => {
      const items: VNode[] = flat.value.map((entry) => {
        const { node, depth, hasChildren } = entry
        const isExpanded = expandedIds.value.has(node.id)
        const isSelected = selectedIds.value.has(node.id)
        const isActive = activeId.value === node.id
        const isLoading = loadingIds.value.has(node.id)
        const isError = errorIds.value.has(node.id)

        const chevron = hasChildren
          ? h(
              'span',
              {
                'data-iris-tree-chevron': '',
                'aria-hidden': 'true',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  toggleNode(node)
                },
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  color: 'var(--iris-muted)',
                  transition: 'transform 120ms ease',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                },
              },
              isLoading
                ? h(
                    'svg',
                    {
                      class: 'iris-button-spinner',
                      viewBox: '0 0 24 24',
                      width: '12',
                      height: '12',
                      fill: 'none',
                    },
                    [
                      h('circle', {
                        cx: '12',
                        cy: '12',
                        r: '10',
                        stroke: 'currentColor',
                        'stroke-opacity': '0.25',
                        'stroke-width': '3',
                      }),
                      h('path', {
                        d: 'M22 12a10 10 0 0 1-10 10',
                        stroke: 'currentColor',
                        'stroke-width': '3',
                        'stroke-linecap': 'round',
                      }),
                    ],
                  )
                : '▶',
            )
          : h('span', { 'aria-hidden': 'true', style: { width: '16px', display: 'inline-block' } })

        return h(
          'div',
          {
            key: node.id,
            role: 'treeitem',
            tabindex: isActive ? 0 : -1,
            'aria-level': depth + 1,
            'aria-expanded': hasChildren ? (isExpanded ? 'true' : 'false') : undefined,
            'aria-selected': props.selectionMode !== 'none' ? (isSelected ? 'true' : 'false') : undefined,
            'aria-disabled': node.disabled ? 'true' : undefined,
            'data-iris-tree-item': '',
            'data-id': node.id,
            'data-state': isExpanded ? 'open' : 'closed',
            'data-loading': isLoading ? '' : undefined,
            'data-error': isError ? '' : undefined,
            onClick: () => selectNode(node),
            onFocus: () => (activeId.value = node.id),
            onKeydown: (event: KeyboardEvent) => onKeyDown(event, entry),
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--iris-gap-sm)',
              padding: '4px 8px',
              paddingLeft: `${8 + depth * 16}px`,
              cursor: node.disabled ? 'not-allowed' : 'pointer',
              opacity: node.disabled ? '0.5' : '1',
              borderRadius: 'var(--iris-radius-sm)',
              background: isSelected
                ? 'var(--iris-primary)'
                : isActive
                  ? 'var(--iris-surface-hover)'
                  : 'transparent',
              color: isSelected ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)',
              outline: 'none',
              fontSize: '14px',
            },
          },
          [chevron, h('span', { style: { flex: '1', minWidth: '0' } }, node.label)],
        )
      })

      return h(
        'div',
        {
          ...attrs,
          role: 'tree',
          'aria-label': props.ariaLabel,
          'aria-multiselectable': props.selectionMode === 'multi' ? 'true' : undefined,
          'data-iris-tree': '',
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            outline: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        items,
      )
    }
  },
})
