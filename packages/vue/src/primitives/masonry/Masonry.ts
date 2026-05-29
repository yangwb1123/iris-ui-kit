import { Comment, defineComponent, Fragment, h, type VNode } from 'vue'

/** Flatten fragment slot output and drop comment placeholders (v-if etc.). */
function flatten(nodes: VNode[]): VNode[] {
  const out: VNode[] = []
  for (const n of nodes) {
    if (n && n.type === Fragment && Array.isArray(n.children)) {
      out.push(...flatten(n.children as VNode[]))
    } else if (n && n.type !== Comment) {
      out.push(n)
    }
  }
  return out
}

/**
 * Masonry layout: flows slot children into balanced columns via CSS
 * multi-column, with each item kept from breaking across columns — for card
 * grids and galleries of varying heights.
 */
export const IrisMasonry = defineComponent({
  name: 'IrisMasonry',
  inheritAttrs: false,
  props: {
    /** Number of columns. */
    columns: { type: Number, default: 3 },
    /** Gap between items (px). */
    gap: { type: Number, default: 16 },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const items = flatten(slots.default?.() ?? [])
      return h(
        'div',
        {
          ...attrs,
          'data-iris-masonry': '',
          'data-columns': props.columns,
          style: {
            columnCount: String(props.columns),
            columnGap: `${props.gap}px`,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        items.map((child, i) =>
          h(
            'div',
            {
              key: i,
              'data-iris-masonry-item': '',
              style: { breakInside: 'avoid', marginBlockEnd: `${props.gap}px` },
            },
            [child],
          ),
        ),
      )
    }
  },
})
