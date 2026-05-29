import { computed, defineComponent, h, onMounted, type PropType } from 'vue'
import { installSkeletonStyles } from './styles'

export type IrisSkeletonShape = 'rect' | 'circle' | 'text'

function defaultHeight(shape: IrisSkeletonShape, w: string | number | undefined): string {
  if (shape === 'text') return '1em'
  if (shape === 'circle') return typeof w === 'number' ? `${w}px` : (w ?? '40px')
  return 'auto'
}

function defaultWidth(shape: IrisSkeletonShape): string {
  if (shape === 'text') return '100%'
  if (shape === 'circle') return '40px'
  return '100%'
}

function toCss(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value
}

/**
 * Loading placeholder. Three shapes (`rect` / `circle` / `text`) drive
 * sensible defaults; pass `width` and `height` to override. Shimmer
 * animation is on by default and respects `prefers-reduced-motion`.
 *
 * For grouped loading layouts, just nest skeletons inside a normal flex/grid
 * container — there's no dedicated `SkeletonGroup` primitive on purpose
 * (composition > yet-another-wrapper).
 */
export const IrisSkeleton = defineComponent({
  name: 'IrisSkeleton',
  inheritAttrs: false,
  props: {
    width: { type: [String, Number], default: undefined },
    height: { type: [String, Number], default: undefined },
    shape: { type: String as PropType<IrisSkeletonShape>, default: 'rect' },
    animated: { type: Boolean, default: true },
  },
  setup(props, { attrs }) {
    onMounted(installSkeletonStyles)

    const style = computed<Record<string, string>>(() => {
      const w = props.width !== undefined ? toCss(props.width) : defaultWidth(props.shape)
      const h =
        props.height !== undefined ? toCss(props.height) : defaultHeight(props.shape, props.width)
      return { width: w, height: h }
    })

    return () =>
      h('div', {
        ...attrs,
        'data-iris-skeleton': '',
        'data-iris-skeleton-shape': props.shape,
        'data-iris-skeleton-animated': String(props.animated),
        role: 'status',
        'aria-busy': 'true',
        'aria-label': 'Loading',
        style: { ...style.value, ...((attrs.style as Record<string, string>) ?? {}) },
      })
  },
})
