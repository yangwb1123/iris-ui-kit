import { computed, defineComponent, h, type PropType } from 'vue'

export type IrisContainerMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full' | string

const WIDTH_MAP: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
}

function resolveMaxWidth(input: IrisContainerMaxWidth): string {
  if (input === 'sm' || input === 'md' || input === 'lg' || input === 'xl' || input === 'full') {
    return WIDTH_MAP[input]
  }
  return input // arbitrary CSS length
}

function resolvePadding(input: string | number): string {
  if (typeof input === 'number') return `${input}px`
  if (input === 'sm' || input === 'md' || input === 'lg') {
    return `var(--iris-padding-${input})`
  }
  return input
}

/**
 * Centered max-width wrapper. Use to bound content width on large screens
 * without rewriting flex/grid plumbing.
 *
 * `maxWidth='lg'` (≈1024px) is the most common default for marketing /
 * docs / app pages.
 */
export const IrisContainer = defineComponent({
  name: 'IrisContainer',
  inheritAttrs: false,
  props: {
    maxWidth: { type: String as PropType<IrisContainerMaxWidth>, default: 'lg' },
    padding: { type: [String, Number], default: 'md' },
    center: { type: Boolean, default: true },
  },
  setup(props, { slots, attrs }) {
    const style = computed<Record<string, string>>(() => ({
      width: '100%',
      maxWidth: resolveMaxWidth(props.maxWidth),
      padding: `0 ${resolvePadding(props.padding)}`,
      ...(props.center ? { marginInlineStart: 'auto', marginInlineEnd: 'auto' } : {}),
    }))

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-container': '',
          'data-iris-container-max-width': props.maxWidth,
          style: { ...style.value, ...((attrs.style as Record<string, string> | undefined) ?? {}) },
        },
        slots.default?.(),
      )
  },
})
