import { defineComponent, h, inject, type PropType, type VNode } from 'vue'
import { defaultIconRegistry, resolveThemedIcon, type IrisIconRegistry } from '@iris-ui/icons'
import { IrisThemeKey } from '../../theme'

/**
 * Renders a registered icon as inline SVG. Resolves `name` through an
 * `@iris-ui/icons` registry and renders the icon's structured nodes as real
 * SVG child elements (no raw-HTML injection). Colors follow `currentColor`, so
 * the surrounding CSS `color` themes it. Renders nothing for an unresolved name.
 */
export const IrisIcon = defineComponent({
  name: 'IrisIcon',
  inheritAttrs: false,
  props: {
    /** Semantic icon name resolved via the registry (e.g. 'check'). */
    name: { type: String, required: true },
    /** Width & height (number → px). */
    size: { type: [Number, String] as PropType<number | string>, default: 24 },
    /** Stroke width for line icons. */
    strokeWidth: { type: Number, default: 2 },
    /** Render as a filled glyph instead of a stroked line icon. */
    fill: { type: Boolean, default: false },
    /** Accessible title; sets role="img" + aria-label. Omit for decorative icons. */
    title: { type: String, default: undefined },
    /** Registry to resolve `name` against. Defaults to the built-in set. */
    registry: { type: Object as PropType<IrisIconRegistry>, default: () => defaultIconRegistry },
  },
  setup(props, { attrs }) {
    const themeCtx = inject(IrisThemeKey, undefined)
    return () => {
      const icon = resolveThemedIcon(props.registry, props.name, themeCtx?.current.value)
      if (!icon) return null

      const paint = props.fill
        ? { fill: 'currentColor' }
        : {
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': props.strokeWidth,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }

      const children: VNode[] = icon.nodes.map((node, i) => h(node.tag, { key: i, ...node.attrs }))
      if (props.title) children.unshift(h('title', props.title))

      return h(
        'svg',
        {
          ...attrs,
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: icon.viewBox ?? '0 0 24 24',
          width: props.size,
          height: props.size,
          ...paint,
          role: props.title ? 'img' : undefined,
          'aria-label': props.title || undefined,
          'aria-hidden': props.title ? undefined : 'true',
          'data-iris-icon': props.name,
          style: {
            display: 'inline-block',
            verticalAlign: 'middle',
            flexShrink: 0,
            ...((attrs.style as Record<string, string>) ?? {}),
          },
        },
        children,
      )
    }
  },
})
