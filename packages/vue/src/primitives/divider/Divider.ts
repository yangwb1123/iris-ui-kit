import { computed, defineComponent, h, type PropType } from 'vue'

export type IrisDividerOrientation = 'horizontal' | 'vertical'
export type IrisDividerSpacing = 'sm' | 'md' | 'lg'

const SPACING_MAP: Record<IrisDividerSpacing, string> = {
  sm: '8px',
  md: '16px',
  lg: '24px',
}

/**
 * Visual separator. Horizontal renders an `<hr>` for semantic correctness
 * (or a labelled `<div role="separator">` when a label slot is supplied).
 * Vertical always renders a `<div role="separator">`.
 *
 * Pass a `label` (or label slot) to render text in the middle — "OR"
 * separators, section dividers, etc.
 */
export const IrisDivider = defineComponent({
  name: 'IrisDivider',
  inheritAttrs: false,
  props: {
    orientation: { type: String as PropType<IrisDividerOrientation>, default: 'horizontal' },
    label: { type: String, default: '' },
    spacing: { type: String as PropType<IrisDividerSpacing>, default: 'md' },
  },
  setup(props, { slots, attrs }) {
    const isHorizontal = computed(() => props.orientation === 'horizontal')
    const hasLabel = computed(() => Boolean(props.label || slots.default))

    return () => {
      if (isHorizontal.value && !hasLabel.value) {
        return h('hr', {
          ...attrs,
          'data-iris-divider': '',
          'data-iris-divider-orientation': 'horizontal',
          style: {
            border: 'none',
            borderTop: '1px solid var(--iris-border)',
            margin: `${SPACING_MAP[props.spacing]} 0`,
            width: '100%',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        })
      }

      if (!isHorizontal.value) {
        return h('div', {
          ...attrs,
          role: 'separator',
          'aria-orientation': 'vertical',
          'data-iris-divider': '',
          'data-iris-divider-orientation': 'vertical',
          style: {
            display: 'inline-block',
            width: '1px',
            alignSelf: 'stretch',
            background: 'var(--iris-border)',
            margin: `0 ${SPACING_MAP[props.spacing]}`,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        })
      }

      // Horizontal + label → 3-column flex with text in the middle.
      return h(
        'div',
        {
          ...attrs,
          role: 'separator',
          'aria-orientation': 'horizontal',
          'data-iris-divider': '',
          'data-iris-divider-orientation': 'horizontal',
          'data-iris-divider-has-label': 'true',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: `${SPACING_MAP[props.spacing]} 0`,
            color: 'var(--iris-muted)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h('span', { 'data-iris-divider-line': 'before', style: lineStyle() }),
          h('span', { 'data-iris-divider-label': '' }, slots.default?.() ?? props.label),
          h('span', { 'data-iris-divider-line': 'after', style: lineStyle() }),
        ],
      )
    }
  },
})

function lineStyle(): Record<string, string> {
  return {
    flex: '1',
    height: '1px',
    background: 'var(--iris-border)',
  }
}
