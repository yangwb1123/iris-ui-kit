import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'

const resolve = (target?: () => HTMLElement | Window | null): HTMLElement | Window =>
  (target ? target() : window) ?? window

/**
 * Affix: pins its slot content to the viewport once the user scrolls past it.
 * Top mode (`offsetTop`) or bottom mode (`offsetBottom`); the placeholder
 * reserves the content's height so the page doesn't jump. `change` fires only
 * when the affixed state flips.
 */
export const IrisAffix = defineComponent({
  name: 'IrisAffix',
  inheritAttrs: false,
  props: {
    /** Pin this many px from the top once scrolled past. */
    offsetTop: { type: Number, default: undefined },
    /** Pin this many px from the bottom (used when `offsetTop` is unset). */
    offsetBottom: { type: Number, default: undefined },
    /** Scroll container resolver. Defaults to the window. */
    target: { type: Function as PropType<() => HTMLElement | Window | null>, default: undefined },
  },
  emits: {
    change: (_affixed: boolean) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const affixed = ref(false)
    const fixedStyle = ref<Record<string, string> | undefined>(undefined)
    const reserve = ref<number | undefined>(undefined)
    let placeholderEl: HTMLElement | null = null
    let contentEl: HTMLElement | null = null
    let scrollEl: HTMLElement | Window | undefined
    let isAffixed = false

    const update = () => {
      const ph = placeholderEl
      if (!ph) return
      const useTop = props.offsetTop != null || props.offsetBottom == null
      const ot = props.offsetTop ?? 0
      const ob = props.offsetBottom ?? 0
      const rect = ph.getBoundingClientRect()
      const vh = window.innerHeight || 0
      const next = useTop ? rect.top <= ot : rect.bottom >= vh - ob
      if (next === isAffixed) return
      isAffixed = next
      const width = ph.offsetWidth
      fixedStyle.value = next
        ? {
            position: 'fixed',
            insetInlineStart: `${rect.left}px`,
            width: `${width}px`,
            zIndex: '10',
            ...(useTop ? { top: `${ot}px` } : { bottom: `${ob}px` }),
          }
        : undefined
      reserve.value = next ? (contentEl?.offsetHeight ?? 0) : undefined
      affixed.value = next
      emit('change', next)
    }

    onMounted(() => {
      scrollEl = resolve(props.target)
      scrollEl.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
      update()
    })
    onBeforeUnmount(() => {
      scrollEl?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    })

    return () =>
      h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            placeholderEl = (el ?? null) as HTMLElement | null
          },
          'data-iris-affix': '',
          'data-affixed': affixed.value ? 'true' : undefined,
          style: {
            ...(affixed.value && reserve.value ? { height: `${reserve.value}px` } : null),
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'div',
            {
              ref: (el: unknown) => {
                contentEl = (el ?? null) as HTMLElement | null
              },
              'data-iris-affix-content': '',
              style: affixed.value ? fixedStyle.value : undefined,
            },
            slots.default?.(),
          ),
        ],
      )
  },
})
