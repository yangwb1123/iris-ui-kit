import { defineComponent, h, type PropType } from 'vue'

export type IrisRibbonPlacement = 'start' | 'end'

/**
 * Ribbon: a corner badge ("New", "Sale", …) anchored to the top corner of its
 * slot content. RTL-safe via logical insets/radii.
 */
export const IrisRibbon = defineComponent({
  name: 'IrisRibbon',
  inheritAttrs: false,
  props: {
    text: { type: [String, Number], default: '' },
    /** Corner: 'end' = top inline-end; 'start' = top inline-start. */
    placement: { type: String as PropType<IrisRibbonPlacement>, default: 'end' },
    /** Badge background (defaults to the primary color). */
    color: { type: String, default: undefined },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const side: Record<string, string> =
        props.placement === 'end'
          ? {
              insetInlineEnd: '0',
              borderStartStartRadius: 'var(--iris-radius-sm, 4px)',
              borderEndStartRadius: 'var(--iris-radius-sm, 4px)',
            }
          : {
              insetInlineStart: '0',
              borderStartEndRadius: 'var(--iris-radius-sm, 4px)',
              borderEndEndRadius: 'var(--iris-radius-sm, 4px)',
            }
      return h(
        'div',
        {
          ...attrs,
          'data-iris-ribbon': '',
          'data-placement': props.placement,
          style: {
            position: 'relative',
            display: 'inline-block',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          slots.default?.(),
          h(
            'span',
            {
              'data-iris-ribbon-badge': '',
              style: {
                position: 'absolute',
                insetBlockStart: '8px',
                background: props.color ?? 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                fontSize: 'var(--iris-font-size-xs, 12px)',
                fontWeight: '600',
                boxShadow: 'var(--iris-shadow-sm)',
                whiteSpace: 'nowrap',
                ...side,
              },
            },
            String(props.text),
          ),
        ],
      )
    }
  },
})
