import { Comment, defineComponent, Fragment, h, onBeforeUnmount, ref, watch, type VNode } from 'vue'
import { useI18n } from '../../i18n'

const ARROW_BTN: Record<string, string> = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: '2',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-background)',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  fontSize: 'var(--iris-font-size-xl, 18px)',
  lineHeight: '1',
}

/** True when the user has asked for reduced motion (SSR / jsdom safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Flatten fragment slot output and drop comment placeholders (v-if etc.). */
function flattenSlides(nodes: VNode[]): VNode[] {
  const out: VNode[] = []
  for (const n of nodes) {
    if (n && n.type === Fragment && Array.isArray(n.children)) {
      out.push(...flattenSlides(n.children as VNode[]))
    } else if (n && n.type !== Comment) {
      out.push(n)
    }
  }
  return out
}

/**
 * Slide carousel: shows one default-slot child at a time with prev/next
 * controls, indicator dots, and keyboard (←/→) navigation. `v-model` binds the
 * active index. a11y: region with `aria-roledescription="carousel"`, per-slide
 * labelling, and a polite live region.
 */
export const IrisCarousel = defineComponent({
  name: 'IrisCarousel',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number, default: 0 },
    /** Wrap around at the ends. */
    loop: { type: Boolean, default: true },
    /** Auto-advance slides. Disabled when the user prefers reduced motion. */
    autoplay: { type: Boolean, default: false },
    /** Autoplay interval in ms. */
    interval: { type: Number, default: 4000 },
    /** Pause autoplay while hovered. */
    pauseOnHover: { type: Boolean, default: true },
    showArrows: { type: Boolean, default: true },
    showIndicators: { type: Boolean, default: true },
    /** Accessible name for the carousel region. */
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_index: number) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const { t } = useI18n()

    // Autoplay: an interval that advances the active slide, paused on
    // hover/focus and disabled under prefers-reduced-motion.
    const hovered = ref(false)
    const focusedWithin = ref(false)
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
    }
    const start = () => {
      stop()
      if (!props.autoplay || prefersReducedMotion()) return
      timer = setInterval(() => {
        if ((props.pauseOnHover && hovered.value) || focusedWithin.value) return
        const list = flattenSlides(slots.default?.() ?? [])
        const count = list.length
        if (count <= 1) return
        const current = Math.min(Math.max(0, props.modelValue), Math.max(0, count - 1))
        emit('update:modelValue', (current + 1) % count)
      }, props.interval)
    }
    watch(() => [props.autoplay, props.interval], start, { immediate: true })
    onBeforeUnmount(stop)

    return () => {
      const slides = flattenSlides(slots.default?.() ?? [])
      const count = slides.length
      const current = Math.min(Math.max(0, props.modelValue), Math.max(0, count - 1))

      const goTo = (i: number) => {
        if (count === 0) return
        const next = props.loop
          ? ((i % count) + count) % count
          : Math.min(count - 1, Math.max(0, i))
        if (next === current) return
        emit('update:modelValue', next)
      }

      const onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goTo(current - 1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          goTo(current + 1)
        }
      }

      return h(
        'div',
        {
          ...attrs,
          'data-iris-carousel': '',
          role: 'group',
          'aria-roledescription': 'carousel',
          'aria-label': props.ariaLabel ?? t('carousel.label'),
          tabindex: 0,
          onKeydown,
          onMouseenter: () => {
            hovered.value = true
          },
          onMouseleave: () => {
            hovered.value = false
          },
          onFocusin: () => {
            focusedWithin.value = true
          },
          onFocusout: () => {
            focusedWithin.value = false
          },
          style: {
            position: 'relative',
            outline: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'div',
            {
              'data-iris-carousel-viewport': '',
              style: {
                overflow: 'hidden',
                position: 'relative',
                borderRadius: 'var(--iris-radius-md, 6px)',
              },
            },
            [
              h(
                'div',
                {
                  'data-iris-carousel-track': '',
                  style: {
                    display: 'flex',
                    transform: `translateX(-${current * 100}%)`,
                    transition: 'transform 300ms ease',
                  },
                },
                slides.map((slide, i) =>
                  h(
                    'div',
                    {
                      key: i,
                      'data-iris-carousel-slide': '',
                      'data-active': i === current ? 'true' : undefined,
                      role: 'group',
                      'aria-roledescription': 'slide',
                      'aria-label': t('carousel.slide', { index: i + 1, total: count }),
                      'aria-hidden': i !== current ? 'true' : undefined,
                      style: { flex: '0 0 100%', width: '100%', minWidth: '0' },
                    },
                    [slide],
                  ),
                ),
              ),
            ],
          ),
          props.showArrows && count > 1
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-carousel-prev': '',
                  'aria-label': t('carousel.previous'),
                  onClick: () => goTo(current - 1),
                  disabled: (!props.loop && current === 0) || undefined,
                  style: { ...ARROW_BTN, insetInlineStart: '8px' },
                },
                '‹',
              )
            : null,
          props.showArrows && count > 1
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-carousel-next': '',
                  'aria-label': t('carousel.next'),
                  onClick: () => goTo(current + 1),
                  disabled: (!props.loop && current === count - 1) || undefined,
                  style: { ...ARROW_BTN, insetInlineEnd: '8px' },
                },
                '›',
              )
            : null,
          props.showIndicators && count > 1
            ? h(
                'div',
                {
                  'data-iris-carousel-indicators': '',
                  style: {
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 'var(--iris-space-xs, 8px)',
                    marginBlockStart: '8px',
                  },
                },
                slides.map((_unused, i) =>
                  h('button', {
                    key: i,
                    type: 'button',
                    'data-iris-carousel-indicator': '',
                    'data-active': i === current ? 'true' : undefined,
                    'aria-label': t('carousel.slide', { index: i + 1, total: count }),
                    'aria-current': i === current ? 'true' : undefined,
                    onClick: () => goTo(i),
                    style: {
                      width: '8px',
                      height: '8px',
                      padding: '0',
                      borderRadius: '50%',
                      border: 'none',
                      cursor: 'pointer',
                      background: i === current ? 'var(--iris-primary)' : 'var(--iris-border)',
                    },
                  }),
                ),
              )
            : null,
          h(
            'div',
            {
              'data-iris-carousel-live': '',
              'aria-live': 'polite',
              style: {
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
              },
            },
            t('carousel.slide', { index: current + 1, total: count }),
          ),
        ],
      )
    }
  },
})
