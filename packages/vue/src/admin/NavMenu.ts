import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import {
  branchTrail,
  createExpansion,
  findNavNode,
  findNavPath,
  isBranch,
  visibleNav,
  firstLeaf,
  type NavNode,
} from '@iris-ui-kit/core'
import { IrisIcon } from '../primitives/icon/Icon'
import { useI18n } from '../i18n'
import { installNavMenuStyles } from './styles'

/**
 * Data-driven nested navigation menu — the sidebar nav of the admin shell.
 * Renders a normalized `NavNode[]` tree as an accordion of expandable branches
 * and selectable leaves; the active leaf and its ancestor branches are
 * highlighted, and the active branch trail auto-expands. Router-agnostic: it
 * takes `activeKey` + emits `select(key, node)`; the host owns navigation.
 *
 * `collapsed` switches to an icon-only rail (top-level items only); a branch
 * click then jumps to its first leaf.
 */
export const IrisNavMenu = defineComponent({
  name: 'IrisNavMenu',
  inheritAttrs: false,
  props: {
    /** Normalized nav tree. */
    items: { type: Array as PropType<NavNode[]>, required: true },
    /** Key of the active leaf. */
    activeKey: { type: String, default: undefined },
    /** Controlled expanded branch keys (v-model:expandedKeys). */
    expandedKeys: { type: Array as PropType<string[]>, default: undefined },
    /** Initial expanded keys when uncontrolled (else the active trail expands). */
    defaultExpandedKeys: { type: Array as PropType<string[]>, default: undefined },
    /** Icon-only rail (top-level items only). */
    collapsed: { type: Boolean, default: false },
    orientation: {
      type: String as PropType<'vertical' | 'horizontal'>,
      default: 'vertical',
    },
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    select: (_key: string, _node: NavNode) => true,
    'update:expandedKeys': (_keys: string[]) => true,
  },
  setup(props, { emit, attrs }) {
    installNavMenuStyles()
    const { t } = useI18n()
    const tree = computed(() => visibleNav(props.items))
    const activePath = computed(() =>
      props.activeKey ? findNavPath(props.items, props.activeKey).map((n) => n.key) : [],
    )

    const isControlled = computed(() => props.expandedKeys !== undefined)

    // The expand/collapse set — toggle, dedup and the active-trail union — lives in
    // the core expansion model; this component only layers on the controlled /
    // uncontrolled split. v-model here is *strict*: while controlled, rendering
    // reads the `expandedKeys` prop (not the store) so a toggle stays closed until
    // the parent updates it. The model therefore backs the uncontrolled state, and
    // `branchTrail` feeds the auto-open union through `merge`.
    const model = createExpansion({
      mode: 'multiple',
      defaultExpanded:
        props.defaultExpandedKeys ??
        (props.activeKey ? branchTrail(props.items, props.activeKey) : []),
    })
    const internalExpanded = shallowRef<string[]>(model.get())
    onBeforeUnmount(
      model.store.subscribe((keys) => {
        internalExpanded.value = keys
      }),
    )
    const expanded = computed(() =>
      isControlled.value ? (props.expandedKeys as string[]) : internalExpanded.value,
    )

    // Auto-open the active branch trail as the active leaf changes (uncontrolled).
    watch(
      () => props.activeKey,
      (key) => {
        if (!isControlled.value) model.merge(key ? branchTrail(props.items, key) : [])
      },
    )

    const toggle = (key: string): void => {
      if (isControlled.value) {
        const cur = props.expandedKeys as string[]
        emit(
          'update:expandedKeys',
          cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
        )
      } else {
        model.toggle(key)
        emit('update:expandedKeys', model.get())
      }
    }

    const hovered = ref<string | null>(null)
    const hoveredBranches = ref<string[]>([])
    const focusedBranches = ref<string[]>([])

    const closeHorizontalMenus = (): void => {
      if (props.orientation !== 'horizontal') return
      hovered.value = null
      hoveredBranches.value = []
      focusedBranches.value = []
    }

    const select = (node: NavNode): void => {
      if (node.disabled) return
      closeHorizontalMenus()
      emit('select', node.key, node)
    }

    const setBranchInteraction = (
      state: typeof hoveredBranches,
      key: string,
      enabled: boolean,
    ): void => {
      const current = state.value
      if (enabled) {
        if (!current.includes(key)) state.value = [...current, key]
      } else if (current.includes(key)) {
        state.value = current.filter((item) => item !== key)
      }
    }

    const keepsPointerInside = (
      container: EventTarget | null,
      event: { relatedTarget?: EventTarget | null },
    ): boolean => {
      if (!container || !(container instanceof HTMLElement)) return false
      const next = event.relatedTarget
      return !!(next && next instanceof Node && container.contains(next))
    }

    const interactionKeyAtDepth = (keys: string[], depth: number): string | undefined =>
      keys.find((key) => findNavPath(props.items, key).length === depth + 1)

    const horizontalBranchVisible = (key: string, depth: number): boolean => {
      const hoveredAtDepth = interactionKeyAtDepth(hoveredBranches.value, depth)
      if (hoveredAtDepth) return hoveredAtDepth === key
      return interactionKeyAtDepth(focusedBranches.value, depth) === key
    }

    const itemClass = (opts: {
      depth: number
      active: boolean
      trail: boolean
      hovered: boolean
      open: boolean
      disabled: boolean
      branch: boolean
    }): string[] => {
      const depth = Math.min(9, opts.depth)
      return [
        'iris-nav-menu-item',
        `iris-nav-menu-item--depth-${depth}`,
        `iris-nav-menu-item--${opts.branch ? 'branch' : 'leaf'}`,
        opts.active ? 'is-active' : undefined,
        opts.trail ? 'is-trail' : undefined,
        opts.hovered ? 'is-hovered' : undefined,
        opts.open ? 'is-open' : undefined,
        opts.disabled ? 'is-disabled' : undefined,
      ].filter(Boolean) as string[]
    }

    const iconNode = (node: NavNode, size = 18): VNode | null =>
      node.icon ? h(IrisIcon, { name: node.icon, size }) : null

    const badgeNode = (node: NavNode): VNode | null =>
      node.badge !== undefined && node.badge !== '' && !props.collapsed
        ? h(
            'span',
            {
              class: 'iris-nav-menu-badge',
              'data-iris-nav-badge': '',
            },
            String(node.badge),
          )
        : null

    // Collapsed rail: top-level items only, icon + native tooltip; branch → first leaf.
    const renderCollapsed = (): VNode[] =>
      tree.value.map((node) => {
        const branch = isBranch(node)
        const active = branch ? activePath.value.includes(node.key) : node.key === props.activeKey
        return h(
          'button',
          {
            key: node.key,
            type: 'button',
            class: [
              ...itemClass({
                depth: 0,
                active,
                trail: false,
                hovered: hovered.value === node.key,
                open: false,
                disabled: !!node.disabled,
                branch,
              }),
              'is-collapsed',
            ],
            'data-iris-nav-item': '',
            'data-key': node.key,
            'data-active': active ? 'true' : undefined,
            'data-branch': branch ? 'true' : undefined,
            'data-hovered': hovered.value === node.key ? 'true' : undefined,
            disabled: node.disabled,
            title: node.title,
            'aria-label': branch ? `${node.title} (section)` : node.title,
            'aria-current': active && !branch ? 'page' : undefined,
            onMouseenter: () => {
              if (!node.disabled) hovered.value = node.key
            },
            onMouseleave: (event: MouseEvent) => {
              if (hovered.value === node.key && !keepsPointerInside(event.currentTarget, event)) {
                hovered.value = null
              }
            },
            onClick: () => select(branch ? firstLeaf(node) : node),
          },
          [
            iconNode(node, 20) ??
              h('span', { class: 'iris-nav-menu-fallback-icon' }, node.title.charAt(0)),
          ],
        )
      })

    const renderItem = (node: NavNode, depth: number): VNode => {
      const branch = isBranch(node)
      const open = expanded.value.includes(node.key)
      const horizontal = props.orientation === 'horizontal'
      const shown = horizontal ? horizontalBranchVisible(node.key, depth) : open
      const active = node.key === props.activeKey
      const trail = branch && !active && activePath.value.includes(node.key)
      const arrowReversed =
        branch && !node.disabled && (active || trail || shown || hovered.value === node.key)

      const row = h(
        'button',
        {
          type: 'button',
          class: itemClass({
            depth,
            active,
            trail,
            hovered: hovered.value === node.key,
            open: branch ? shown : false,
            disabled: !!node.disabled,
            branch,
          }),
          'data-iris-nav-item': '',
          'data-key': node.key,
          'data-branch': branch ? 'true' : undefined,
          'data-active': active ? 'true' : undefined,
          'data-active-trail': trail ? 'true' : undefined,
          'data-open': branch && shown ? 'true' : undefined,
          'data-hovered': hovered.value === node.key ? 'true' : undefined,
          'data-depth': String(depth),
          'data-orientation': props.orientation,
          disabled: node.disabled,
          'aria-expanded': branch ? (shown ? 'true' : 'false') : undefined,
          'aria-current': active ? 'page' : undefined,
          onMouseenter: () => {
            if (!node.disabled) hovered.value = node.key
          },
          onMouseleave: (event: MouseEvent) => {
            if (hovered.value === node.key && !keepsPointerInside(event.currentTarget, event)) {
              hovered.value = null
            }
          },
          onClick: () => (branch ? toggle(node.key) : select(node)),
        },
        [
          iconNode(node),
          h(
            'span',
            {
              class: 'iris-nav-menu-label',
            },
            node.title,
          ),
          badgeNode(node),
          branch
            ? h(IrisIcon, {
                name: horizontal && depth === 0 ? 'chevron-down' : 'chevron-right',
                size: 16,
                class: 'iris-nav-menu-arrow',
                'data-reversed': arrowReversed ? 'true' : undefined,
              })
            : null,
        ],
      )

      if (!branch || (!horizontal && !open))
        return h(
          'div',
          {
            key: node.key,
            'data-iris-nav-group': branch ? '' : undefined,
            class: ['iris-nav-menu-group', `iris-nav-menu-group--depth-${Math.min(9, depth)}`],
          },
          [row],
        )

      return h(
        'div',
        {
          key: node.key,
          'data-iris-nav-group': '',
          'data-open': shown ? 'true' : undefined,
          'data-depth': String(depth),
          class: ['iris-nav-menu-group', `iris-nav-menu-group--depth-${Math.min(9, depth)}`],
          ...(horizontal
            ? {
                onMouseenter: (event: MouseEvent) => {
                  if (!keepsPointerInside(event.currentTarget, event)) {
                    setBranchInteraction(hoveredBranches, node.key, true)
                  }
                },
                onMouseover: (event: MouseEvent) => {
                  if (!keepsPointerInside(event.currentTarget, event)) {
                    setBranchInteraction(hoveredBranches, node.key, true)
                  }
                },
                onMouseout: (event: MouseEvent) => {
                  if (!keepsPointerInside(event.currentTarget, event)) {
                    setBranchInteraction(hoveredBranches, node.key, false)
                  }
                },
                onMouseleave: (event: MouseEvent) => {
                  if (!keepsPointerInside(event.currentTarget, event)) {
                    setBranchInteraction(hoveredBranches, node.key, false)
                  }
                },
                onFocusin: () => setBranchInteraction(focusedBranches, node.key, true),
                onFocusout: (event: FocusEvent) => {
                  const group = event.currentTarget as HTMLElement
                  const next = event.relatedTarget as Node | null
                  if (!next || !group.contains(next)) {
                    setBranchInteraction(focusedBranches, node.key, false)
                  }
                },
              }
            : {}),
        },
        [
          row,
          h(
            'div',
            {
              class: 'iris-nav-menu-children',
              'data-iris-nav-children': '',
              role: 'group',
              'aria-hidden': horizontal && !shown ? 'true' : undefined,
            },
            (node.children ?? []).map((child) => renderItem(child, depth + 1)),
          ),
        ],
      )
    }

    // Arrow-key navigation over the visible items (Tab still works as a fallback).
    // Up/Down/Home/End move focus; Right expands a branch then steps into it;
    // Left collapses an open branch else moves to the parent.
    const onKeydown = (e: KeyboardEvent): void => {
      const root = e.currentTarget as HTMLElement
      const buttons = Array.from(root.querySelectorAll<HTMLElement>('[data-iris-nav-item]')).filter(
        (button) => !button.closest('[data-iris-nav-children][aria-hidden="true"]'),
      )
      if (buttons.length === 0) return
      const idx = buttons.indexOf(document.activeElement as HTMLElement)
      const focusAt = (i: number): void => buttons[(i + buttons.length) % buttons.length]?.focus()

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          focusAt(idx < 0 ? 0 : idx + 1)
          return
        case 'ArrowUp':
          e.preventDefault()
          focusAt(idx < 0 ? buttons.length - 1 : idx - 1)
          return
        case 'Home':
          e.preventDefault()
          buttons[0]?.focus()
          return
        case 'End':
          e.preventDefault()
          buttons[buttons.length - 1]?.focus()
          return
      }

      if (props.collapsed || idx < 0) return
      const key = buttons[idx]?.getAttribute('data-key')
      if (!key) return
      const node = findNavNode(props.items, key)

      if (e.key === 'ArrowRight' && node && isBranch(node)) {
        e.preventDefault()
        if (!expanded.value.includes(key)) toggle(key)
        else focusAt(idx + 1)
      } else if (e.key === 'ArrowLeft') {
        if (node && isBranch(node) && expanded.value.includes(key)) {
          e.preventDefault()
          toggle(key)
        } else {
          const parentKey = findNavPath(props.items, key).at(-2)?.key
          if (parentKey) {
            e.preventDefault()
            buttons.find((b) => b.getAttribute('data-key') === parentKey)?.focus()
          }
        }
      }
    }

    const menuClass = [
      'iris-nav-menu',
      `iris-nav-menu--${props.orientation}`,
      props.collapsed ? 'iris-nav-menu--collapsed' : 'iris-nav-menu--expanded',
    ]

    return () =>
      h(
        'nav',
        {
          ...attrs,
          class: [...menuClass, attrs.class as unknown as string | string[] | undefined],
          'data-iris-nav-menu': '',
          'data-collapsed': props.collapsed ? 'true' : undefined,
          'data-orientation': props.orientation,
          'aria-label': props.ariaLabel ?? t('admin.nav'),
          onKeydown,
          style: attrs.style as Record<string, string> | undefined,
        },
        props.collapsed ? renderCollapsed() : tree.value.map((node) => renderItem(node, 0)),
      )
  },
})
