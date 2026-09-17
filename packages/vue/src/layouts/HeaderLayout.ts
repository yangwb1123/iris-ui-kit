import { defineComponent, h, type PropType } from 'vue'

/**
 * Two-region vertical layout: a sticky header on top, scrollable main below.
 *
 * Slots:
 *   - `header` — fixed at top.
 *   - `footer` — optional fixed at bottom.
 *   - `default` — main content. When `sticky` is true this region scrolls;
 *     otherwise the complete layout participates in the surrounding scroll.
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
            // A non-sticky header must scroll away with the content. Keeping
            // the old fixed-height/scrollable-main combination made
            // `sticky=false` visually indistinguishable from `sticky=true`.
            height: props.sticky ? '100%' : 'auto',
            minHeight: props.sticky ? '0' : 'auto',
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
              style: {
                flex: '1',
                minHeight: props.sticky ? '0' : 'auto',
                overflow: props.sticky ? 'auto' : 'visible',
              },
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
