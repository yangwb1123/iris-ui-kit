import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'
import { IrisSidebarLayout } from '../layouts/SidebarLayout'
import { IrisHeaderLayout } from '../layouts/HeaderLayout'
import { IrisDashboardGrid, IrisDashboardCard } from '../layouts/DashboardGrid'
import { IrisStack } from '../layouts/Stack'

export interface IrisDashboardNavItem {
  id: string
  label: string
  /** Optional icon (any ReactNode-like; ignored if `slots.icon` is used). */
  icon?: string
}

export interface IrisDashboardCardSpec {
  id: string
  title: string
  colSpan?: number | 'full'
  rowSpan?: number
  /** Plain text or HTML — replace via `#card.<id>` slot for full control. */
  body?: string
}

/**
 * Layer 4 system skeleton: a 3-region dashboard shell — sidebar + header +
 * main grid. Built from `IrisSidebarLayout` + `IrisHeaderLayout` +
 * `IrisDashboardGrid` so it inherits collapsing, sticky header, and responsive
 * column layout out of the box.
 */
export const IrisDashboardTemplate = defineComponent({
  name: 'IrisDashboardTemplate',
  inheritAttrs: false,
  props: {
    title: { type: String, default: 'Dashboard' },
    sidebarTitle: { type: String, default: '' },
    nav: { type: Array as PropType<IrisDashboardNavItem[]>, default: () => [] },
    /** Currently active nav item id. */
    activeId: { type: String, default: '' },
    /** Cards to render in the main grid. Skip to use the `default` slot only. */
    cards: { type: Array as PropType<IrisDashboardCardSpec[]>, default: () => [] },
    defaultCollapsed: { type: Boolean, default: false },
    /**
     * Controlled collapsed state. When unset (`undefined`), the component
     * manages its own state seeded from `defaultCollapsed`; when set, this
     * value takes precedence and changes are re-emitted via
     * `update:collapsed` (`v-model:collapsed`).
     */
    collapsed: { type: Boolean, default: undefined },
  },
  emits: {
    'update:activeId': (_id: string) => true,
    'update:collapsed': (_value: boolean) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const isControlled = computed(() => props.collapsed !== undefined)
    const internalCollapsed = ref(props.defaultCollapsed)
    const collapsed = computed(() =>
      isControlled.value ? Boolean(props.collapsed) : internalCollapsed.value,
    )

    // Sync controlled prop changes into internal state on first run so a later
    // detach to uncontrolled mode preserves the last-known value (mirrors
    // IrisSidebarLayout). `immediate` fires the watcher on mount; the
    // `value !== undefined` guard keeps the first run a no-op for
    // pure-uncontrolled mounts so `defaultCollapsed` stays untouched.
    watch(
      () => props.collapsed,
      (value) => {
        if (value !== undefined) internalCollapsed.value = value
      },
      { immediate: true },
    )

    const onSelectNav = (id: string) => {
      emit('update:activeId', id)
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-dashboard-template': '',
          style: {
            width: '100%',
            height: '100vh',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        h(
          IrisSidebarLayout,
          {
            collapsed: collapsed.value,
            'onUpdate:collapsed': (v: boolean) => {
              if (!isControlled.value) internalCollapsed.value = v
              emit('update:collapsed', v)
            },
            width: 240,
            collapsedWidth: 64,
          } as Record<string, unknown>,
          {
            sidebar: (state: { collapsed: boolean; setCollapsed: (v: boolean) => void }) =>
              h(IrisStack, { spacing: 'sm', style: { padding: '12px' } }, () => [
                slots['sidebar-header']
                  ? slots['sidebar-header'](state)
                  : props.sidebarTitle
                    ? h(
                        'div',
                        {
                          style: {
                            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                            fontSize: 'var(--iris-font-size-md, 14px)',
                            fontWeight: '600',
                            color: 'var(--iris-foreground)',
                            opacity: state.collapsed ? 0 : 1,
                            transition: 'opacity 120ms ease',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                          },
                        },
                        props.sidebarTitle,
                      )
                    : null,
                h(
                  'nav',
                  {
                    'aria-label': 'Primary',
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--iris-space-xxs, 4px)',
                    },
                  },
                  props.nav.map((item) => {
                    const isActive = item.id === props.activeId
                    return h(
                      'button',
                      {
                        key: item.id,
                        type: 'button',
                        'data-iris-dashboard-nav-item': item.id,
                        'data-iris-dashboard-nav-active': isActive ? 'true' : undefined,
                        onClick: () => onSelectNav(item.id),
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--iris-space-sm, 12px)',
                          padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                          background: isActive ? 'var(--iris-primary)' : 'transparent',
                          color: isActive
                            ? 'var(--iris-primary-foreground, #fff)'
                            : 'var(--iris-foreground)',
                          border: 'none',
                          borderRadius: 'var(--iris-radius-sm, 4px)',
                          cursor: 'pointer',
                          fontSize: 'var(--iris-font-size-md, 14px)',
                          fontFamily: 'inherit',
                          textAlign: 'start',
                          outline: 'none',
                        },
                      },
                      [
                        item.icon
                          ? h(
                              'span',
                              {
                                'aria-hidden': 'true',
                                style: {
                                  width: '16px',
                                  display: 'inline-flex',
                                  justifyContent: 'center',
                                },
                              },
                              item.icon,
                            )
                          : null,
                        h(
                          'span',
                          {
                            style: {
                              opacity: state.collapsed ? 0 : 1,
                              transition: 'opacity 120ms ease',
                              whiteSpace: 'nowrap',
                            },
                          },
                          item.label,
                        ),
                      ],
                    )
                  }),
                ),
              ]),
            default: () =>
              h(IrisHeaderLayout, {} as Record<string, unknown>, {
                header: () =>
                  slots.header
                    ? slots.header()
                    : h(
                        'div',
                        {
                          style: {
                            padding: 'var(--iris-space-sm, 12px) var(--iris-space-lg, 20px)',
                            fontSize: 'var(--iris-font-size-lg, 16px)',
                            fontWeight: '600',
                          },
                        },
                        props.title,
                      ),
                default: () =>
                  slots.default
                    ? slots.default()
                    : h(
                        'div',
                        { style: { padding: '20px' } },
                        h(IrisDashboardGrid, { columns: 12, gap: 16 }, () =>
                          props.cards.map((card) =>
                            h(
                              IrisDashboardCard,
                              {
                                key: card.id,
                                colSpan: card.colSpan ?? 4,
                                rowSpan: card.rowSpan ?? 1,
                                'data-iris-dashboard-card-id': card.id,
                              } as Record<string, unknown>,
                              () => [
                                h(
                                  'h3',
                                  {
                                    style: {
                                      margin: '0 0 var(--iris-space-xs, 8px) 0',
                                      fontSize: 'var(--iris-font-size-md, 14px)',
                                      fontWeight: '600',
                                      color: 'var(--iris-foreground)',
                                    },
                                  },
                                  card.title,
                                ),
                                slots[`card.${card.id}`]
                                  ? slots[`card.${card.id}`]!()
                                  : card.body
                                    ? h(
                                        'div',
                                        {
                                          style: {
                                            fontSize: 'var(--iris-font-size-sm, 13px)',
                                            color: 'var(--iris-muted)',
                                          },
                                        },
                                        card.body,
                                      )
                                    : null,
                              ],
                            ),
                          ),
                        ),
                      ),
              }),
          },
        ),
      )
  },
})
