import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import { useI18n } from '../../i18n'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const resolve = (target?: () => HTMLElement | Window | null): HTMLElement | Window =>
  (target ? target() : window) ?? window

/**
 * Back-to-top button: appears once the scroll target passes `visibilityHeight`
 * and scrolls it back to the top on click (honoring reduced motion). Defaults
 * to the window; pass `target` for a scrollable container.
 */
export const IrisBackTop = defineComponent({
  name: 'IrisBackTop',
  inheritAttrs: false,
  props: {
    /** Scroll container resolver. Defaults to the window. */
    target: { type: Function as PropType<() => HTMLElement | Window | null>, default: undefined },
    /** Show the button once the scroll position passes this (px). */
    visibilityHeight: { type: Number, default: 400 },
    /** Scroll behavior; forced to 'auto' under reduced motion. */
    behavior: { type: String as PropType<ScrollBehavior>, default: 'smooth' },
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    click: () => true,
  },
  setup(props, { attrs, slots, emit }) {
    const { t } = useI18n()
    const visible = ref(false)
    let el: HTMLElement | Window | undefined

    const onScroll = () => {
      if (!el) return
      const top = el === window ? (window.scrollY ?? 0) : (el as HTMLElement).scrollTop
      visible.value = top >= props.visibilityHeight
    }

    onMounted(() => {
      el = resolve(props.target)
      el.addEventListener('scroll', onScroll)
      onScroll()
    })
    onBeforeUnmount(() => {
      el?.removeEventListener('scroll', onScroll)
    })

    const scrollToTop = () => {
      if (!el) return
      const b: ScrollBehavior = prefersReducedMotion() ? 'auto' : props.behavior
      if (typeof (el as { scrollTo?: unknown }).scrollTo === 'function') {
        ;(el as Window | HTMLElement).scrollTo({ top: 0, behavior: b })
      } else {
        ;(el as HTMLElement).scrollTop = 0
      }
      emit('click')
    }

    return () =>
      visible.value
        ? h(
            'button',
            {
              ...attrs,
              type: 'button',
              'data-iris-back-top': '',
              'aria-label': props.ariaLabel ?? t('backTop.label'),
              onClick: scrollToTop,
              style: {
                position: 'fixed',
                insetInlineEnd: '24px',
                insetBlockEnd: '24px',
                zIndex: '100',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid var(--iris-border)',
                background: 'var(--iris-surface, var(--iris-background))',
                color: 'var(--iris-foreground)',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                ...((attrs.style as Record<string, string> | undefined) ?? {}),
              },
            },
            slots.default ? slots.default() : '↑',
          )
        : null
  },
})
