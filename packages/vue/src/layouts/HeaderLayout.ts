import { defineComponent, h, type PropType } from 'vue'

/**
 * Two-region vertical layout: a sticky header on top, scrollable main below.
 *
 * Slots:
 *   - `header` — header chrome, or the first child of main when `headerInMain` is true.
 *   - `beforeMain` — optional chrome between the header and the scrolling main region.
 *   - `footer` — optional fixed at bottom.
 *   - `default` — main content. `scrollMain` controls whether this region owns scrolling;
 *     it defaults to `sticky` for backwards compatibility.
 */
export const IrisHeaderLayout = defineComponent({
  name: 'IrisHeaderLayout',
  inheritAttrs: false,
  props: {
    /** Header height (px or CSS length). Default `'auto'`. */
    headerHeight: { type: [Number, String] as PropType<number | string>, default: 'auto' },
    /** Footer height (px or CSS length). Default `'auto'`. */
    footerHeight: { type: [Number, String] as PropType<number | string>, default: 'auto' },
    /** When true, the header sticks via `position: sticky` instead of static. */
    sticky: { type: Boolean, default: true },
    /** When true, the main region owns scrolling even if the header is static. */
    scrollMain: { type: Boolean, default: undefined },
    /** Render the header as the first child inside the scrolling main region. */
    headerInMain: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const asLen = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)
    return () => {
      const scrollMain = props.scrollMain ?? props.sticky
      const header = slots.header
        ? h(
            'header',
            {
              role: 'banner',
              'data-iris-header': '',
              style: {
                flexShrink: '0',
                height: asLen(props.headerHeight),
                borderBottom: '1px solid var(--iris-border)',
                background: 'var(--iris-surface)',
                position: props.sticky ? 'sticky' : 'static',
                top: '0',
                zIndex: '50',
              },
            },
            slots.header(),
          )
        : null
      const beforeMain = slots.beforeMain?.() ?? []
      const mainChildren = [props.headerInMain ? header : null, ...(slots.default?.() ?? [])]

      return h(
        'div',
        {
          ...attrs,
          'data-iris-header-layout': '',
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            // A scrollable main needs a bounded flex parent. `scrollMain` is
            // independent from header stickiness so fixed tabs can keep their
            // own chrome while a non-fixed header still scrolls away.
            height: scrollMain ? '100%' : 'auto',
            minHeight: scrollMain ? '0' : 'auto',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          props.headerInMain ? null : header,
          ...beforeMain,
          h(
            'main',
            {
              role: 'main',
              'data-iris-header-main': '',
              style: {
                flex: '1',
                minHeight: scrollMain ? '0' : 'auto',
                overflow: scrollMain ? 'auto' : 'visible',
              },
            },
            mainChildren,
          ),
          slots.footer
            ? h(
                'footer',
                {
                  role: 'contentinfo',
                  'data-iris-footer': '',
                  style: {
                    flexShrink: '0',
                    height: asLen(props.footerHeight),
                    borderTop: '1px solid var(--iris-border)',
                    background: 'var(--iris-surface)',
                  },
                },
                slots.footer(),
              )
            : null,
        ],
      )
    }
  },
})
