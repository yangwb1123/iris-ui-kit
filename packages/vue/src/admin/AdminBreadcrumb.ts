import { defineComponent, h, type PropType, type VNode } from 'vue'
import type { NavNode } from '@iris-ui/core'
import { IrisBreadcrumb } from '../primitives/breadcrumb/Breadcrumb'
import { IrisBreadcrumbItem } from '../primitives/breadcrumb/BreadcrumbItem'
import { IrisIcon } from '../primitives/icon/Icon'

/**
 * Breadcrumb trail for the admin header, driven by a `NavNode[]` ancestor chain
 * (typically `findNavPath(menus, activeKey)`). The last crumb is the current
 * page (auto-marked `aria-current` by IrisBreadcrumb); earlier crumbs are
 * clickable and emit `select(key, node)` so the host can navigate.
 */
export const IrisAdminBreadcrumb = defineComponent({
  name: 'IrisAdminBreadcrumb',
  inheritAttrs: false,
  props: {
    /** Root→current ancestor chain. */
    trail: { type: Array as PropType<NavNode[]>, required: true },
    /** Show each node's icon before its title. */
    showIcon: { type: Boolean, default: true },
    /** Hide the breadcrumb when the trail has a single crumb. */
    hideSingle: { type: Boolean, default: false },
    separator: { type: String, default: '/' },
  },
  emits: {
    select: (_key: string, _node: NavNode) => true,
  },
  setup(props, { emit, attrs }) {
    return () => {
      const trail = props.trail
      if (trail.length === 0 || (props.hideSingle && trail.length === 1)) return null

      return h(
        IrisBreadcrumb,
        { ...attrs, separator: props.separator },
        {
          default: () =>
            trail.map((node, i) => {
              const last = i === trail.length - 1
              const content: VNode[] = []
              if (props.showIcon && node.icon) {
                content.push(
                  h(IrisIcon, { name: node.icon, size: 14, style: { marginInlineEnd: '4px' } }),
                )
              }
              content.push(h('span', node.title))
              return h(
                IrisBreadcrumbItem,
                {
                  key: node.key,
                  'data-iris-admin-crumb': '',
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: last ? 'default' : 'pointer',
                  },
                  onClick: last ? undefined : () => emit('select', node.key, node),
                },
                { default: () => content },
              )
            }),
        },
      )
    }
  },
})
