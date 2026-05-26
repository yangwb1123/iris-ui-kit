import { defineComponent, h, type PropType } from 'vue'

/**
 * Two-region vertical layout: a sticky header on top, scrollable main below.
 *
 * Slots:
 *   - `header` — fixed at top.
 *   - `footer` — optional fixed at bottom.
 *   - `default` — scrollable main region.
 */
export const IrisHeaderLayout = defineComponent({
  name: 'IrisHeaderLayout',
  inheritAttrs: false,
  props: {
    /** Header height (px or CSS length). Default `'auto'`. */
    headerHeight: { type: [Number, String] as PropType<number | string>, default: 'auto' },
    /** Footer height (px or CSS length). Default `'auto'`. */
    footerHeight: { type: [Number, String] as PropType<number | string>, default: 'auto' },
    /** When true, header sticks via `position: sticky` instead of static. */
    sticky: { type: Boolean, default: true },
  },
  setup(props, { slots, attrs }) {
    const asLen = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)
    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-header-layout': '',
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            minHeight: '0',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          slots.header
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
            : null,
          h(
            'main',
            {
              role: 'main',
              'data-iris-header-main': '',
              style: { flex: '1', minHeight: '0', overflow: 'auto' },
            },
            slots.default?.(),
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
  },
})
