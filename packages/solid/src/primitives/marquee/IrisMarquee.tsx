import { createEffect, mergeProps, onCleanup, type JSX } from 'solid-js'

export type IrisMarqueeDirection = 'left' | 'right'

export interface IrisMarqueeProps {
  /** Seconds for one full loop. */
  duration?: number
  direction?: IrisMarqueeDirection
  pauseOnHover?: boolean
  /** Gap between the repeated copies (px). */
  gap?: number
  children?: JSX.Element
  style?: JSX.CSSProperties
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Marquee: an accessible auto-scrolling ticker. The slot content is rendered
 * twice (the second copy aria-hidden) for a seamless loop.
 * Solid port of the Vue IrisMarquee.
 */
export function IrisMarquee(props: IrisMarqueeProps): JSX.Element {
  const merged = mergeProps(
    { duration: 10, direction: 'left' as IrisMarqueeDirection, pauseOnHover: true, gap: 40 },
    props,
  )

  let trackEl: HTMLDivElement | undefined
  let anim: Animation | null = null

  createEffect(() => {
    const el = trackEl
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return
    const frames =
      merged.direction === 'left'
        ? [{ transform: 'translateX(0%)' }, { transform: 'translateX(-50%)' }]
        : [{ transform: 'translateX(-50%)' }, { transform: 'translateX(0%)' }]
    anim = el.animate(frames, {
      duration: Math.max(1, merged.duration) * 1000,
      iterations: Infinity,
    })
    onCleanup(() => anim?.cancel())
  })

  const copy = (hidden: boolean): JSX.Element => (
    <div
      data-iris-marquee-content=""
      aria-hidden={hidden ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: `${merged.gap}px`,
        'flex-shrink': '0',
        'padding-inline-end': `${merged.gap}px`,
      }}
    >
      {merged.children}
    </div>
  )

  return (
    <div
      data-iris-marquee=""
      onMouseEnter={() => {
        if (merged.pauseOnHover) anim?.pause()
      }}
      onMouseLeave={() => {
        if (merged.pauseOnHover) anim?.play()
      }}
      style={{
        display: 'flex',
        overflow: 'hidden',
        ...(merged.style ?? {}),
      }}
    >
      <div
        ref={trackEl}
        data-iris-marquee-track=""
        style={{ display: 'inline-flex', 'flex-shrink': '0', 'will-change': 'transform' }}
      >
        {copy(false)}
        {copy(true)}
      </div>
    </div>
  )
}
