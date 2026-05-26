import { defineComponent, h } from 'vue'

/**
 * A single breadcrumb crumb. Renders an `<a>` when `href` is given and the
 * crumb is not the last one; otherwise a `<span>`.
 *
 * The `isCurrent` flag (set by the parent IrisBreadcrumb based on position)
 * adds `aria-current="page"` and switches to the non-link rendering.
 */
export const IrisBreadcrumbItem = defineComponent({
  name: 'IrisBreadcrumbItem',
  inheritAttrs: false,
  props: {
    href: { type: String, default: '' },
    /** Internal: set by parent IrisBreadcrumb when this is the last item. */
    isCurrent: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const last = props.isCurrent
      const baseStyle: Record<string, string> = {
        color: last ? 'var(--iris-muted)' : 'var(--iris-primary)',
        textDecoration: 'none',
        cursor: last ? 'default' : props.href ? 'pointer' : 'default',
      }

      const baseAttrs = {
        ...attrs,
        'aria-current': last ? 'page' : undefined,
        'data-iris-breadcrumb-crumb': '',
        style: { ...baseStyle, ...((attrs.style as Record<string, string> | undefined) ?? {}) },
      }

      if (props.href && !last) {
        return h('a', { ...baseAttrs, href: props.href }, slots.default?.())
      }
      return h('span', baseAttrs, slots.default?.())
    }
  },
})
