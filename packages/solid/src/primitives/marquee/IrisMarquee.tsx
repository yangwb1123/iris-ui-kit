import { PREFERS_REDUCED_MOTION_QUERY, watchMediaQuery } from '@iris-ui-kit/core'
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
  let hovered = false

  createEffect(() => {
    const el = trackEl
    const currentDirection = merged.direction
    const currentDuration = merged.duration
    const currentPauseOnHover = merged.pauseOnHover
    const stop = () => {
      anim?.cancel()
      anim = null
    }
    const start = () => {
      stop()
      if (!el || typeof el.animate !== 'function') return
      const frames =
        currentDirection === 'left'
          ? [{ transform: 'translateX(0%)' }, { transform: 'translateX(-50%)' }]
          : [{ transform: 'translateX(-50%)' }, { transform: 'translateX(0%)' }]
      anim = el.animate(frames, {
        duration: Math.max(1, currentDuration) * 1000,
        iterations: Infinity,
      })
      if (currentPauseOnHover && hovered) anim.pause()
    }
    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(PREFERS_REDUCED_MOTION_QUERY)
        : null
    const subscription = watchMediaQuery(mediaQuery, (reduced) => {
      if (reduced) stop()
      else start()
    })

    onCleanup(() => {
      subscription.destroy()
      stop()
    })
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
        hovered = true
        if (merged.pauseOnHover) anim?.pause()
      }}
      onMouseLeave={() => {
        hovered = false
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
