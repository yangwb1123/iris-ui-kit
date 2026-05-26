import { computed, defineComponent, h, type PropType } from 'vue'

export type IrisStackDirection = 'row' | 'column'
export type IrisStackAlign = 'start' | 'center' | 'end' | 'stretch'
export type IrisStackJustify = 'start' | 'center' | 'end' | 'between' | 'around'

const ALIGN_MAP: Record<IrisStackAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const JUSTIFY_MAP: Record<IrisStackJustify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
}

function toCssSpacing(spacing: string | number): string {
  if (typeof spacing === 'number') return `${spacing}px`
  // Token shorthand: "sm" / "md" / "lg" → var(--iris-gap-X)
  if (spacing === 'sm' || spacing === 'md' || spacing === 'lg') {
    return `var(--iris-gap-${spacing})`
  }
  return spacing
}

/**
 * Flex container with token-driven spacing. The lightest possible layout
 * primitive — most pages need a horizontal or vertical stack and this saves
 * hand-writing `display: flex` everywhere.
 *
 * Use `direction`/`spacing`/`align`/`justify`/`wrap` to configure; children
 * are arranged in document order with `gap: <spacing>`.
 */
export const IrisStack = defineComponent({
  name: 'IrisStack',
  inheritAttrs: false,
  props: {
    direction: { type: String as PropType<IrisStackDirection>, default: 'column' },
    spacing: { type: [String, Number], default: 'md' },
    align: { type: String as PropType<IrisStackAlign>, default: 'stretch' },
    justify: { type: String as PropType<IrisStackJustify>, default: 'start' },
    wrap: { type: Boolean, default: false },
    /** When true, renders as an inline-flex container. */
    inline: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const style = computed<Record<string, string>>(() => ({
      display: props.inline ? 'inline-flex' : 'flex',
      flexDirection: props.direction,
      gap: toCssSpacing(props.spacing),
      alignItems: ALIGN_MAP[props.align],
      justifyContent: JUSTIFY_MAP[props.justify],
      flexWrap: props.wrap ? 'wrap' : 'nowrap',
    }))

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-stack': '',
          'data-iris-stack-direction': props.direction,
          style: { ...style.value, ...((attrs.style as Record<string, string> | undefined) ?? {}) },
        },
        slots.default?.(),
      )
  },
})
