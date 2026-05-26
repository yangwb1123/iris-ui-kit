import { computed, defineComponent, h, ref, watch } from 'vue'

/**
 * Two-column layout with a collapsible sidebar.
 *
 * Slots:
 *   - `sidebar` — content rendered in the sidebar (kept mounted across collapses).
 *   - `default` — the main content area.
 *
 * Use `:collapsed` for controlled mode or `:default-collapsed` for the
 * uncontrolled initial state. When collapsed, the sidebar shrinks to
 * `:collapsed-width` so icon-only navigation still fits.
 */
export const IrisSidebarLayout = defineComponent({
  name: 'IrisSidebarLayout',
  inheritAttrs: false,
  props: {
    collapsed: { type: Boolean, default: undefined },
    defaultCollapsed: { type: Boolean, default: false },
    /** Sidebar width when expanded (px or CSS length). */
    width: { type: [Number, String], default: 240 },
    /** Sidebar width when collapsed. */
    collapsedWidth: { type: [Number, String], default: 60 },
    /** Sidebar position. */
    side: { type: String as () => 'left' | 'right', default: 'left' },
  },
  emits: {
    'update:collapsed': (_value: boolean) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const isControlled = computed(() => props.collapsed !== undefined)
    const internalCollapsed = ref(props.defaultCollapsed)
    const collapsed = computed(() =>
      isControlled.value ? Boolean(props.collapsed) : internalCollapsed.value,
    )

    // Sync controlled prop changes into internal state on first run so a later
    // detach to uncontrolled mode preserves the last-known value.
    watch(
      () => props.collapsed,
      (value) => {
        if (value !== undefined) internalCollapsed.value = value
      },
    )

    const setCollapsed = (value: boolean) => {
      if (!isControlled.value) internalCollapsed.value = value
      emit('update:collapsed', value)
    }

    const asLen = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)

    return () => {
      const sidebarStyle: Record<string, string> = {
        width: collapsed.value ? asLen(props.collapsedWidth) : asLen(props.width),
        flexShrink: '0',
        background: 'var(--iris-surface)',
        borderRight: props.side === 'left' ? '1px solid var(--iris-border)' : 'none',
        borderLeft: props.side === 'right' ? '1px solid var(--iris-border)' : 'none',
        transition: 'width 180ms ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }
      const mainStyle: Record<string, string> = {
        flex: '1',
        minWidth: '0',
        overflow: 'auto',
        background: 'var(--iris-background)',
      }
      const direction = props.side === 'right' ? 'row-reverse' : 'row'

      return h(
        'div',
        {
          ...attrs,
          'data-iris-sidebar-layout': '',
          'data-collapsed': collapsed.value ? '' : undefined,
          'data-side': props.side,
          style: {
            display: 'flex',
            flexDirection: direction,
            width: '100%',
            height: '100%',
            minHeight: '0',
            color: 'var(--iris-foreground)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'aside',
            {
              role: 'complementary',
              'data-iris-sidebar': '',
              'data-collapsed': collapsed.value ? '' : undefined,
              style: sidebarStyle,
            },
            slots.sidebar?.({ collapsed: collapsed.value, setCollapsed }),
          ),
          h('div', { 'data-iris-sidebar-main': '', style: mainStyle }, slots.default?.()),
        ],
      )
    }
  },
})
