import { Fragment, defineComponent, h, type VNode } from 'vue'
import { useI18n } from '../../i18n'

/**
 * Container for breadcrumb navigation. Renders a `<nav>` with `<ol>` per
 * WAI-ARIA. The `separator` slot (or prop) is inserted between items;
 * defaults to `/`.
 *
 * Children should be `IrisBreadcrumbItem`s.
 */
export const IrisBreadcrumb = defineComponent({
  name: 'IrisBreadcrumb',
  inheritAttrs: false,
  props: {
    /** String separator. Ignored if the `separator` slot is provided. */
    separator: { type: String, default: '/' },
  },
  setup(props, { slots, attrs }) {
    const { t } = useI18n()
    return () => {
      const children = slots.default?.() ?? []
      // Flatten Fragment / array children to a flat list of VNodes.
      const flat: VNode[] = []
      const walk = (nodes: VNode[] | undefined) => {
        if (!nodes) return
        nodes.forEach((n) => {
          if (n.type === Fragment) walk(n.children as VNode[])
          else flat.push(n)
        })
      }
      walk(children as VNode[])

      const total = flat.length
      const slotsSep = slots.separator
      const sep = (key: number) =>
        h(
          'li',
          {
            key: `sep-${key}`,
            'data-iris-breadcrumb-separator': '',
            'aria-hidden': 'true',
            style: { color: 'var(--iris-muted)', display: 'inline-flex', alignItems: 'center' },
          },
          slotsSep ? slotsSep() : props.separator,
        )

      const items: VNode[] = []
      flat.forEach((child, i) => {
        // Inject is-last hint so the item can self-mark as `aria-current=page`.
        const isLast = i === total - 1
        const wrapped = h(
          'li',
          {
            key: `item-${i}`,
            'data-iris-breadcrumb-item': '',
            'data-iris-breadcrumb-last': isLast ? 'true' : undefined,
            style: { display: 'inline-flex', alignItems: 'center' },
          },
          // Pass isCurrent=true to the last child so it self-marks aria-current.
          h(
            child.type as never,
            { ...(child.props ?? {}), isCurrent: isLast } as Record<string, unknown>,
            child.children as never,
          ),
        )
        items.push(wrapped)
        if (!isLast) items.push(sep(i))
      })

      return h(
        'nav',
        {
          ...attrs,
          'aria-label': t('breadcrumb.label'),
          'data-iris-breadcrumb': '',
        },
        h(
          'ol',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--iris-space-xs, 8px)',
              margin: '0',
              padding: '0',
              listStyle: 'none',
              fontSize: 'var(--iris-font-size-md, 14px)',
            },
          },
          items,
        ),
      )
    }
  },
})
