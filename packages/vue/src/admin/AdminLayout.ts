import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import {
  findNavNode,
  findNavPath,
  firstLeaf,
  isBranch,
  type NavNode,
  type TabsNav,
} from '@iris-ui/core'
import { IrisSidebarLayout } from '../layouts/SidebarLayout'
import { IrisHeaderLayout } from '../layouts/HeaderLayout'
import { IrisNavMenu } from './NavMenu'
import { IrisAdminBreadcrumb } from './AdminBreadcrumb'
import { IrisAdminTabs } from './AdminTabs'
import { IrisIcon } from '../primitives/icon/Icon'

export type IrisAdminLayoutMode = 'sidebar' | 'full-content'

/**
 * The CMS / admin shell — a Vben-style, router-agnostic, data-driven layout that
 * composes IrisSidebarLayout + IrisHeaderLayout with the admin nav pieces. One
 * `menus` tree drives the collapsible sidebar nav, the header breadcrumb, and
 * (when a `tabs` store is passed) the multi-tab bar; `activeKey` is the current
 * page (v-model). The host owns routing: react to `@select` / `update:activeKey`
 * and render the page in the default slot (wrap it in `<KeepAlive>` keyed by
 * `tabs.cacheKey` for Vben-style tab caching).
 *
 * Slots: `logo({ collapsed })`, `toolbar` (header end), default `({ activeKey })`,
 * `footer`. Modes: `sidebar` (default) and `full-content` (chrome hidden).
 */
export const IrisAdminLayout = defineComponent({
  name: 'IrisAdminLayout',
  inheritAttrs: false,
  props: {
    /** Normalized nav tree driving menu + breadcrumb. */
    menus: { type: Array as PropType<NavNode[]>, required: true },
    /** Active page key (v-model:activeKey). */
    activeKey: { type: String, default: undefined },
    /** Sidebar collapsed (v-model:collapsed); undefined = uncontrolled. */
    collapsed: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    defaultCollapsed: { type: Boolean, default: false },
    mode: { type: String as PropType<IrisAdminLayoutMode>, default: 'sidebar' },
    /** Brand text shown next to the logo when expanded. */
    appTitle: { type: String, default: 'Iris Admin' },
    /** Optional shared tabs store; when present the tab bar is rendered. */
    tabs: { type: Object as PropType<TabsNav>, default: undefined },
    showBreadcrumb: { type: Boolean, default: true },
    sidebarWidth: { type: [Number, String] as PropType<number | string>, default: 240 },
    collapsedWidth: { type: [Number, String] as PropType<number | string>, default: 64 },
  },
  emits: {
    'update:activeKey': (_key: string) => true,
    'update:collapsed': (_value: boolean) => true,
    select: (_key: string, _node: NavNode) => true,
  },
  setup(props, { emit, slots, attrs }) {
    const activeControlled = computed(() => props.activeKey !== undefined)
    const internalActive = ref(props.activeKey ?? '')
    const activeKey = computed(() =>
      activeControlled.value ? (props.activeKey as string) : internalActive.value,
    )
    const setActive = (key: string): void => {
      if (!activeControlled.value) internalActive.value = key
      emit('update:activeKey', key)
    }

    const collapseControlled = computed(() => props.collapsed !== undefined)
    const internalCollapsed = ref(props.defaultCollapsed)
    const collapsed = computed(() =>
      collapseControlled.value ? (props.collapsed as boolean) : internalCollapsed.value,
    )
    const setCollapsed = (value: boolean): void => {
      if (!collapseControlled.value) internalCollapsed.value = value
      emit('update:collapsed', value)
    }

    const trail = computed(() => findNavPath(props.menus, activeKey.value))

    const navigateTo = (node: NavNode): void => {
      const leaf = isBranch(node) ? firstLeaf(node) : node
      setActive(leaf.key)
      emit('select', leaf.key, leaf)
      props.tabs?.open({ key: leaf.key, title: leaf.title, icon: leaf.icon })
    }
    // NavMenu / Breadcrumb emit (key, node); route the node through navigateTo.
    const onSelect = (_key: string, node: NavNode): void => navigateTo(node)

    // Tab activation (incl. close → neighbor) is the store's job; mirror it into
    // the layout's active key so the breadcrumb + content stay in sync.
    if (props.tabs) {
      const tabsActive = ref(props.tabs.getState().activeKey)
      const unsubscribe = props.tabs.subscribe((s) => {
        tabsActive.value = s.activeKey
      })
      onBeforeUnmount(unsubscribe)
      watch(tabsActive, (key) => {
        if (!key || key === activeKey.value) return
        setActive(key)
        const node = findNavNode(props.menus, key)
        if (node) emit('select', key, node)
      })
    }

    const renderLogo = (state: { collapsed: boolean }): VNode | VNode[] => {
      if (slots.logo) return slots.logo(state) as VNode[]
      return h(
        'div',
        {
          'data-iris-admin-logo': '',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            height: '52px',
            padding: '0 16px',
            color: 'var(--iris-foreground)',
            fontWeight: '700',
            fontSize: '16px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            flexShrink: 0,
          },
        },
        [
          h(
            'span',
            {
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--iris-radius-md, 6px)',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                flexShrink: 0,
              },
            },
            [h(IrisIcon, { name: 'menu', size: 18 })],
          ),
          state.collapsed ? null : h('span', props.appTitle),
        ],
      )
    }

    const collapseToggle = (): VNode =>
      h(
        'button',
        {
          type: 'button',
          'data-iris-admin-collapse': '',
          'aria-label': collapsed.value ? 'Expand sidebar' : 'Collapse sidebar',
          'aria-pressed': collapsed.value ? 'true' : 'false',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            border: 'none',
            borderRadius: 'var(--iris-radius-md, 6px)',
            background: 'transparent',
            color: 'var(--iris-foreground)',
            cursor: 'pointer',
            flexShrink: 0,
          },
          onClick: () => setCollapsed(!collapsed.value),
        },
        [h(IrisIcon, { name: collapsed.value ? 'chevron-right' : 'menu', size: 18 })],
      )

    const renderHeaderBar = (): VNode =>
      h(
        'div',
        {
          'data-iris-admin-headerbar': '',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '52px',
            padding: '0 16px',
            borderBottom: '1px solid var(--iris-border)',
            background: 'var(--iris-background)',
          },
        },
        [
          collapseToggle(),
          props.showBreadcrumb
            ? h(IrisAdminBreadcrumb, { trail: trail.value, hideSingle: false, onSelect })
            : null,
          h('div', { style: { flex: '1' } }),
          slots.toolbar
            ? h(
                'div',
                {
                  'data-iris-admin-toolbar': '',
                  style: { display: 'flex', alignItems: 'center', gap: '8px' },
                },
                slots.toolbar(),
              )
            : null,
        ],
      )

    const renderContent = (): VNode =>
      h(
        'div',
        { 'data-iris-admin-content': '', style: { padding: '16px' } },
        slots.default?.({ activeKey: activeKey.value }) ?? [],
      )

    return () => {
      if (props.mode === 'full-content') {
        return h(
          'div',
          {
            ...attrs,
            'data-iris-admin-layout': '',
            'data-mode': 'full-content',
            style: {
              height: '100%',
              ...((attrs.style as Record<string, string> | undefined) ?? {}),
            },
          },
          slots.default?.({ activeKey: activeKey.value }) ?? [],
        )
      }

      return h(
        IrisSidebarLayout,
        {
          ...attrs,
          collapsed: collapsed.value,
          width: props.sidebarWidth,
          collapsedWidth: props.collapsedWidth,
          'onUpdate:collapsed': setCollapsed,
          'data-iris-admin-layout': '',
          'data-mode': 'sidebar',
          style: {
            height: '100vh',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        {
          sidebar: (state: { collapsed: boolean }) =>
            h(
              'div',
              {
                'data-iris-admin-sidebar': '',
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  borderInlineEnd: '1px solid var(--iris-border)',
                  background: 'var(--iris-surface)',
                },
              },
              [
                renderLogo(state),
                h(
                  'div',
                  { style: { flex: '1', overflowY: 'auto', overflowX: 'hidden', padding: '8px' } },
                  [
                    h(IrisNavMenu, {
                      items: props.menus,
                      activeKey: activeKey.value,
                      collapsed: state.collapsed,
                      onSelect,
                    }),
                  ],
                ),
              ],
            ),
          default: () =>
            h(
              IrisHeaderLayout,
              { sticky: true },
              {
                header: () =>
                  h('div', { 'data-iris-admin-header': '' }, [
                    renderHeaderBar(),
                    props.tabs ? h(IrisAdminTabs, { nav: props.tabs }) : null,
                  ]),
                default: () => renderContent(),
                ...(slots.footer ? { footer: () => slots.footer!() } : {}),
              },
            ),
        },
      )
    }
  },
})
