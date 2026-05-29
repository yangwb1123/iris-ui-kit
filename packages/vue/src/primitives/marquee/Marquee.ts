import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'

export type IrisMarqueeDirection = 'left' | 'right'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Marquee: an accessible auto-scrolling ticker. The slot content is rendered
 * twice (the second copy `aria-hidden`) for a seamless loop and animated with
 * the Web Animations API (no `@keyframes` injection). Pauses on hover and is
 * disabled under `prefers-reduced-motion`.
 */
export const IrisMarquee = defineComponent({
  name: 'IrisMarquee',
  inheritAttrs: false,
  props: {
    /** Seconds for one full loop. */
    duration: { type: Number, default: 10 },
    direction: { type: String as PropType<IrisMarqueeDirection>, default: 'left' },
    pauseOnHover: { type: Boolean, default: true },
    /** Gap between the repeated copies (px). */
    gap: { type: Number, default: 40 },
  },
  setup(props, { attrs, slots }) {
    const trackEl = ref<HTMLElement | null>(null)
    let anim: Animation | null = null

    onMounted(() => {
      const el = trackEl.value
      if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return
      const frames =
        props.direction === 'left'
          ? [{ transform: 'translateX(0%)' }, { transform: 'translateX(-50%)' }]
          : [{ transform: 'translateX(-50%)' }, { transform: 'translateX(0%)' }]
      anim = el.animate(frames, {
        duration: Math.max(1, props.duration) * 1000,
        iterations: Infinity,
      })
    })
    onBeforeUnmount(() => anim?.cancel())

    const copy = (hidden: boolean) =>
      h(
        'div',
        {
          'data-iris-marquee-content': '',
          'aria-hidden': hidden ? 'true' : undefined,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: `${props.gap}px`,
            flexShrink: '0',
            paddingInlineEnd: `${props.gap}px`,
          },
        },
        slots.default?.(),
      )

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-marquee': '',
          onMouseenter: () => {
            if (props.pauseOnHover) anim?.pause()
          },
          onMouseleave: () => {
            if (props.pauseOnHover) anim?.play()
          },
          style: {
            display: 'flex',
            overflow: 'hidden',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'div',
            {
              ref: trackEl,
              'data-iris-marquee-track': '',
              style: { display: 'inline-flex', flexShrink: '0', willChange: 'transform' },
            },
            [copy(false), copy(true)],
          ),
        ],
      )
  },
})
