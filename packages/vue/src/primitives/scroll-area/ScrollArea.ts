import { defineComponent, h, type PropType } from 'vue'

export type IrisScrollAreaAxis = 'vertical' | 'horizontal' | 'both'

const OVERFLOW: Record<IrisScrollAreaAxis, Record<string, string>> = {
  vertical: { overflowY: 'auto', overflowX: 'hidden' },
  horizontal: { overflowX: 'auto', overflowY: 'hidden' },
  both: { overflow: 'auto' },
}

const px = (v: number | string | undefined): string | undefined =>
  typeof v === 'number' ? `${v}px` : v

/**
 * Scroll area: a keyboard-focusable scroll container that constrains its slot
 * content via `maxHeight` / `maxWidth` and scrolls on the chosen `axis`. A
 * lightweight alternative to ad-hoc overflow styling.
 */
export const IrisScrollArea = defineComponent({
  name: 'IrisScrollArea',
  inheritAttrs: false,
  props: {
    maxHeight: { type: [Number, String], default: undefined },
    maxWidth: { type: [Number, String], default: undefined },
    axis: { type: String as PropType<IrisScrollAreaAxis>, default: 'vertical' },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-scroll-area': '',
          'data-axis': props.axis,
          tabindex: 0,
          style: {
            ...OVERFLOW[props.axis],
            maxHeight: px(props.maxHeight),
            maxWidth: px(props.maxWidth),
            outline: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})
