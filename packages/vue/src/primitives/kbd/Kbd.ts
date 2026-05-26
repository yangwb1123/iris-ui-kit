import { computed, defineComponent, h, type PropType } from 'vue'

export type IrisKbdSize = 'sm' | 'md'

const SIZE_MAP: Record<IrisKbdSize, { fontSize: string; padding: string }> = {
  sm: { fontSize: '10px', padding: '2px 5px' },
  md: { fontSize: '12px', padding: '3px 6px' },
}

/**
 * Render a keyboard shortcut hint, e.g. `Ctrl + K` or `⌘ + ⇧ + P`.
 *
 *   - `keys` as a string renders a single key.
 *   - `keys` as an array renders each key separated by the `separator`
 *     (default `+`).
 *   - Or use the default slot with hand-rolled markup.
 */
export const IrisKbd = defineComponent({
  name: 'IrisKbd',
  inheritAttrs: false,
  props: {
    keys: {
      type: [String, Array] as PropType<string | string[]>,
      default: () => [] as string[],
    },
    separator: { type: String, default: '+' },
    size: { type: String as PropType<IrisKbdSize>, default: 'md' },
  },
  setup(props, { slots, attrs }) {
    const keyList = computed<string[]>(() => {
      if (typeof props.keys === 'string') return props.keys ? [props.keys] : []
      return props.keys
    })

    const baseStyle: Record<string, string> = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: SIZE_MAP[props.size].fontSize,
      verticalAlign: 'middle',
    }

    const keyStyle: Record<string, string> = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: SIZE_MAP[props.size].padding,
      background: 'var(--iris-surface)',
      color: 'var(--iris-foreground)',
      border: '1px solid var(--iris-border)',
      borderRadius: '4px',
      boxShadow: '0 1px 0 var(--iris-border)',
      lineHeight: '1',
      fontWeight: '500',
    }

    return () => {
      if (slots.default) {
        return h(
          'kbd',
          {
            ...attrs,
            'data-iris-kbd': '',
            style: { ...baseStyle, ...((attrs.style as Record<string, string>) ?? {}) },
          },
          slots.default(),
        )
      }
      const list = keyList.value
      if (list.length === 0) return null
      const items: ReturnType<typeof h>[] = []
      list.forEach((k, i) => {
        items.push(
          h(
            'kbd',
            {
              key: `k-${i}`,
              'data-iris-kbd-key': '',
              style: keyStyle,
            },
            k,
          ),
        )
        if (i < list.length - 1) {
          items.push(
            h(
              'span',
              {
                key: `s-${i}`,
                'data-iris-kbd-separator': '',
                'aria-hidden': 'true',
                style: { color: 'var(--iris-muted)' },
              },
              props.separator,
            ),
          )
        }
      })
      return h(
        'span',
        {
          ...attrs,
          'data-iris-kbd': '',
          'data-iris-kbd-size': props.size,
          style: { ...baseStyle, ...((attrs.style as Record<string, string>) ?? {}) },
        },
        items,
      )
    }
  },
})
