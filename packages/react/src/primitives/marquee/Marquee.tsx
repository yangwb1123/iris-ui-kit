import { PREFERS_REDUCED_MOTION_QUERY, watchMediaQuery } from '@iris-ui-kit/core'
import * as React from 'react'

export type IrisMarqueeDirection = 'left' | 'right'

export interface IrisMarqueeProps {
  children?: React.ReactNode
  /** Seconds for one full loop. */
  duration?: number
  direction?: IrisMarqueeDirection
  pauseOnHover?: boolean
  /** Gap between the repeated copies (px). */
  gap?: number
  style?: React.CSSProperties
  className?: string
}

/**
 * Marquee: an accessible auto-scrolling ticker. The content is rendered twice
 * (the second copy `aria-hidden`) for a seamless loop and animated with the Web
 * Animations API (no `@keyframes` injection). Pauses on hover and is disabled
 * under `prefers-reduced-motion`.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisMarquee}.
 */
export function IrisMarquee({
  children,
  duration = 10,
  direction = 'left',
  pauseOnHover = true,
  gap = 40,
  style,
  className,
  ...rest
}: IrisMarqueeProps): React.ReactElement {
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const animRef = React.useRef<Animation | null>(null)
  const hoveredRef = React.useRef(false)
  const pauseOnHoverRef = React.useRef(pauseOnHover)
  pauseOnHoverRef.current = pauseOnHover

  React.useEffect(() => {
    const el = trackRef.current
    const stop = () => {
      animRef.current?.cancel()
      animRef.current = null
    }
    const start = () => {
      stop()
      if (!el || typeof el.animate !== 'function') return
      const frames =
        direction === 'left'
          ? [{ transform: 'translateX(0%)' }, { transform: 'translateX(-50%)' }]
          : [{ transform: 'translateX(-50%)' }, { transform: 'translateX(0%)' }]
      const anim = el.animate(frames, {
        duration: Math.max(1, duration) * 1000,
        iterations: Infinity,
      })
      animRef.current = anim
      if (pauseOnHoverRef.current && hoveredRef.current) anim.pause()
    }
    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(PREFERS_REDUCED_MOTION_QUERY)
        : null
    const subscription = watchMediaQuery(mediaQuery, (reduced) => {
      if (reduced) stop()
      else start()
    })

    return () => {
      subscription.destroy()
      stop()
    }
  }, [duration, direction])

  const copy = (hidden: boolean) => (
    <div
      data-iris-marquee-content=""
      aria-hidden={hidden ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        flexShrink: 0,
        paddingInlineEnd: gap,
      }}
    >
      {children}
    </div>
  )

  return (
    <div
      data-iris-marquee=""
      className={className}
      {...rest}
      onMouseEnter={() => {
        hoveredRef.current = true
        if (pauseOnHover) animRef.current?.pause()
      }}
      onMouseLeave={() => {
        hoveredRef.current = false
        if (pauseOnHover) animRef.current?.play()
      }}
      style={{ display: 'flex', overflow: 'hidden', ...style }}
    >
      <div
        ref={trackRef}
        data-iris-marquee-track=""
        style={{ display: 'inline-flex', flexShrink: 0, willChange: 'transform' }}
      >
        {copy(false)}
        {copy(true)}
      </div>
    </div>
  )
}
