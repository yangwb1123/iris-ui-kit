import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import {
  branchTrail,
  createExpansion,
  findNavPath,
  isBranch,
  visibleNav,
  firstLeaf,
  type NavNode,
} from '@iris-ui-kit/core'
import { IrisIcon } from '../primitives/icon/Icon'
import { useI18n } from '../i18n'
import { installNavMenuStyles } from './styles'
import { createNavMenuFlyout } from './NavMenuFlyout'
import { createNavMenuKeydownHandler } from './NavMenuKeyboard'

/** Hover open/close latencies for flyouts (horizontal mode + collapsed rail). */

/**
 * Data-driven nested navigation menu — the sidebar nav of the admin shell.
 * Renders a normalized `NavNode[]` tree as an accordion of expandable branches
 * and selectable leaves; the active leaf and its ancestor branches are
 * highlighted, and the active branch trail auto-expands. Router-agnostic: it
 * takes `activeKey` + emits `select(key, node)`; the host owns navigation.
 *
 * `collapsed` switches to an icon-only rail (top-level items only); hovering a
 * branch pops the full submenu flyout out to the right and a branch click
 * jumps to its first leaf.
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
    const menuItems = computed(() => props.items)
    const tree = computed(() => visibleNav(props.items))
    const activePath = computed(() =>
      props.activeKey ? findNavPath(props.items, props.activeKey).map((n) => n.key) : [],
    )

    // Branches with flyouts (horizontal popups + the collapsed rail popup) use
    // the hover/focus/click state instead of the vertical expansion model.
    const flyoutMode = computed(() => props.orientation === 'horizontal' || props.collapsed)

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

    // Auto-open the active branch trail as the active leaf changes *or as the
    // tree arrives late* (async navigation data: the mount-time seed may have
    // seen `items = []`). `merge` is a union, so manual collapses survive and
    // repeated pushes are idempotent.
    watch([() => props.activeKey, () => props.items], ([key]) => {
      if (!isControlled.value) model.merge(key ? branchTrail(props.items, key) : [])
    })

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

    // Flyout 状态机（hover/click 钉住/视口定位/键盘可见性）——NavMenuFlyout.ts
    const flyout = createNavMenuFlyout({
      // Keep the flyout controller in sync with async navigation data and
      // layout changes; passing .value here would freeze the initial state.
      items: menuItems,
      tree,
      expanded,
      flyoutMode,
      collapsed: computed(() => props.collapsed),
      toggle,
      emitSelect: (key: string, node: NavNode) => emit('select', key, node),
    })
    const {
      hovered,
      hoveredBranches,
      focusedBranches,
      clickedBranches,
      select,
      toggleFlyout,
      openFlyout,
      closeHorizontalMenus,
      setBranchInteraction,
      keepsPointerInside,
      horizontalBranchVisible,
      setFlyoutRef,
      flyoutTriggers,
      flyoutPanels,
      suppressFocusOpen,
      cancelClose,
      scheduleOpen,
      scheduleClose,
    } = flyout
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

    const renderItem = (node: NavNode, depth: number): VNode => {
      const branch = isBranch(node)
      const horizontal = flyoutMode.value
      const verticalAccordion = props.orientation === 'vertical' && !props.collapsed
      const open = expanded.value.includes(node.key)
      const shown = horizontal ? horizontalBranchVisible(node.key, depth) : open
      const active = node.key === props.activeKey
      const trail = branch && !active && activePath.value.includes(node.key)
      // A6: keep the row highlighted while its flyout stays open (pointer has
      // moved from the trigger into the popup).
      const rowHovered = hovered.value === node.key || (horizontal && shown)
      // In the expanded sidebar, arrow direction is the actual accordion state:
      // hover must not alter it. Flyout modes retain the menubar rotation model.
      const arrowReversed =
        !verticalAccordion && branch && !node.disabled && (active || trail || shown || rowHovered)
      const arrowName = verticalAccordion
        ? open
          ? 'chevron-up'
          : 'chevron-down'
        : horizontal && depth === 0 && !props.collapsed
          ? 'chevron-down'
          : 'chevron-right'

      // Top-level flyout popups are pinned to the viewport (fixed) so they
      // escape ancestor overflow; their trigger + panel refs feed that.
      const isFlyoutRoot = horizontal && branch && depth === 0

      const row = h(
        'button',
        {
          type: 'button',
          ref: (el: unknown) => {
            if (isFlyoutRoot) setFlyoutRef(flyoutTriggers, node.key, el)
          },
          class: [
            ...itemClass({
              depth,
              active,
              trail,
              hovered: rowHovered,
              open: branch ? shown : false,
              disabled: !!node.disabled,
              branch,
            }),
            ...(props.collapsed && depth === 0 ? ['is-collapsed'] : []),
          ],
          'data-iris-nav-item': '',
          'data-key': node.key,
          'data-branch': branch ? 'true' : undefined,
          'data-active': active ? 'true' : undefined,
          'data-active-trail': trail ? 'true' : undefined,
          'data-open': branch && shown ? 'true' : undefined,
          'data-hovered': rowHovered ? 'true' : undefined,
          'data-depth': String(depth),
          'data-orientation': props.orientation,
          disabled: node.disabled,
          title: props.collapsed ? node.title : undefined,
          'aria-label': props.collapsed
            ? branch
              ? `${node.title} (section)`
              : node.title
            : undefined,
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
          onClick: () => {
            if (props.collapsed && branch) {
              select(firstLeaf(node))
            } else if (horizontal && branch) {
              // A2: horizontal clicks drive the flyout, not the expansion set.
              toggleFlyout(node.key)
            } else if (branch) {
              toggle(node.key)
            } else {
              select(node)
            }
          },
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
          branch && !(props.collapsed && depth === 0)
            ? h(IrisIcon, {
                name: arrowName,
                size: 16,
                class: 'iris-nav-menu-arrow',
                'data-reversed': arrowReversed ? 'true' : undefined,
              })
            : null,
        ],
      )

      // Children are always in the DOM (vertical: animated height via CSS;
      // horizontal/collapsed: flyout popups); `aria-hidden` keeps hidden items
      // out of the a11y tree and out of arrow-key navigation.
      return h(
        'div',
        {
          key: node.key,
          'data-iris-nav-group': branch ? '' : undefined,
          'data-open': branch && shown ? 'true' : undefined,
          'data-depth': String(depth),
          class: ['iris-nav-menu-group', `iris-nav-menu-group--depth-${Math.min(9, depth)}`],
          ...(horizontal && branch
            ? {
                onMouseenter: (event: MouseEvent) => {
                  if (!node.disabled && !keepsPointerInside(event.currentTarget, event)) {
                    cancelClose(node.key)
                    scheduleOpen(node.key)
                  }
                },
                onMouseover: (event: MouseEvent) => {
                  if (!node.disabled && !keepsPointerInside(event.currentTarget, event)) {
                    cancelClose(node.key)
                    scheduleOpen(node.key)
                  }
                },
                onMouseout: (event: MouseEvent) => {
                  if (!node.disabled && !keepsPointerInside(event.currentTarget, event)) {
                    scheduleClose(node.key)
                  }
                },
                onMouseleave: (event: MouseEvent) => {
                  if (!node.disabled && !keepsPointerInside(event.currentTarget, event)) {
                    scheduleClose(node.key)
                  }
                },
                onFocusin: () => {
                  if (suppressFocusOpen.get()) return
                  setBranchInteraction(focusedBranches, node.key, true)
                },
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
          branch
            ? h(
                'div',
                {
                  class: 'iris-nav-menu-children',
                  'data-iris-nav-children': '',
                  ref: (el: unknown) => {
                    if (isFlyoutRoot) setFlyoutRef(flyoutPanels, node.key, el)
                  },
                  role: 'group',
                  'aria-hidden': shown ? undefined : 'true',
                },
                [
                  h(
                    'div',
                    { class: 'iris-nav-menu-children-inner' },
                    (node.children ?? []).map((child) => renderItem(child, depth + 1)),
                  ),
                ],
              )
            : null,
        ],
      )
    }

    // Keep the active item in view when the tree or active key changes (deep
    // links into long menus). jsdom-safe: no scrollIntoView / matchMedia there.
    const rootRef = shallowRef<HTMLElement | null>(null)
    watch(
      [() => props.activeKey, () => props.items],
      () => {
        if (!props.activeKey) return
        const root = rootRef.value
        if (!root) return
        const el = root.querySelector<HTMLElement>('[data-iris-nav-item][data-active="true"]')
        if (!el || typeof el.scrollIntoView !== 'function') return
        let behavior: ScrollBehavior = 'auto'
        if (
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          behavior = 'smooth'
        }
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior })
      },
      { flush: 'post' },
    )

    // Arrow-key navigation over the visible items (Tab still works as a fallback).
    // Up/Down/Home/End move focus; Right expands a branch then steps into it;
    // Left collapses an open branch else moves to the parent. In flyout mode
    // (horizontal / collapsed) Down/Right open the popup and step into it,
    // Up/Left close it, and Escape closes everything (focus returns to the
    // owning top-level trigger).
    // 键盘导航（A3/A4/A5 + Up/Down/Home/End）——见 NavMenuKeyboard.ts
    const onKeydown = createNavMenuKeydownHandler({
      items: props.items,
      flyoutMode: () => flyoutMode.value,
      expanded: () => expanded.value,
      toggle,
      openFlyout,
      closeHorizontalMenus,
      horizontalBranchVisible,
      setBranchInteraction,
      focusedBranches,
      hoveredBranches,
      clickedBranches,
      suppressFocusOpen: () => suppressFocusOpen.get(),
      setSuppressFocusOpen: (v: boolean) => {
        flyout.setSuppressFocusOpen(v)
      },
      collapsed: props.collapsed,
    })
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
          ref: (el: unknown) => {
            rootRef.value = (el ?? null) as HTMLElement | null
          },
          class: [...menuClass, attrs.class as unknown as string | string[] | undefined],
          'data-iris-nav-menu': '',
          'data-collapsed': props.collapsed ? 'true' : undefined,
          'data-orientation': props.orientation,
          'aria-label': props.ariaLabel ?? t('admin.nav'),
          onKeydown,
          style: attrs.style as Record<string, string> | undefined,
        },
        tree.value.map((node) => renderItem(node, 0)),
      )
  },
})
