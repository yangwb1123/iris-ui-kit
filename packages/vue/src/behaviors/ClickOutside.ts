import {
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  watchEffect,
  type PropType,
  type Ref,
} from 'vue'

/**
 * Behavior wrapper: fires `outside` when a `pointerdown` happens outside the
 * wrapped child tree. Wraps children in a `<span style="display:contents">`
 * to capture the bounding box without affecting layout.
 *
 * Pass `ignore` (refs to additional "inside" elements) for trigger buttons
 * that live outside the wrapper but should still count as inside.
 */
export const IrisClickOutside = defineComponent({
  name: 'IrisClickOutside',
  inheritAttrs: false,
  props: {
    disabled: { type: Boolean, default: false },
    ignore: {
      type: Array as PropType<Ref<HTMLElement | null | undefined>[]>,
      default: () => [],
    },
  },
  emits: {
    outside: (_event: PointerEvent) => true,
  },
  setup(props, { slots, emit }) {
    const wrapperRef = ref<HTMLElement | null>(null)
    let detach: (() => void) | null = null

    watchEffect((onCleanup) => {
      detach?.()
      detach = null
      if (props.disabled) return
      if (typeof document === 'undefined') return
      const handler = (event: PointerEvent) => {
        const target = event.target as Node | null
        if (!target) return
        const wrapper = wrapperRef.value
        if (wrapper) {
          let node: Node | null = target
          while (node) {
            if (node === wrapper) return
            if ((node as HTMLElement).parentNode === wrapper) return
            node = node.parentNode
          }
        }
        for (const r of props.ignore) {
          const el = r.value
          if (el && el.contains(target)) return
        }
        emit('outside', event)
      }
      document.addEventListener('pointerdown', handler)
      detach = () => document.removeEventListener('pointerdown', handler)
      onCleanup(() => detach?.())
    })

    onBeforeUnmount(() => detach?.())

    return () =>
      h(
        'span',
        {
          ref: (el: unknown) => {
            wrapperRef.value = (el ?? null) as HTMLElement | null
          },
          'data-iris-click-outside': '',
          style: { display: 'contents' },
        },
        slots.default?.(),
      )
  },
})
