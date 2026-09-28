<script lang="ts">
  import { PREFERS_REDUCED_MOTION_QUERY, watchMediaQuery } from '@iris-ui-kit/core'

  export type IrisMarqueeDirection = 'left' | 'right'

  interface Props {
    duration?: number
    direction?: IrisMarqueeDirection
    pauseOnHover?: boolean
    gap?: number
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  }

  let {
    duration = 10,
    direction = 'left',
    pauseOnHover = true,
    gap = 40,
    children,
    style,
    ...rest
  }: Props = $props()

  let trackEl = $state<HTMLElement | undefined>(undefined)
  let anim: Animation | null = null
  let hovered = false

  $effect(() => {
    const el = trackEl
    const currentDirection = direction
    const currentDuration = duration
    const currentPauseOnHover = pauseOnHover
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

    return () => {
      subscription.destroy()
      stop()
    }
  })

  function setTrack(node: HTMLElement): { destroy: () => void } {
    trackEl = node
    return {
      destroy: () => {
        trackEl = undefined
      },
    }
  }
</script>

<div
  {...rest}
  data-iris-marquee
  onmouseenter={() => {
    hovered = true
    if (pauseOnHover) anim?.pause()
  }}
  onmouseleave={() => {
    hovered = false
    if (pauseOnHover) anim?.play()
  }}
  style="display: flex; overflow: hidden;{style ? ' ' + style : ''}"
>
  <div
    use:setTrack
    data-iris-marquee-track
    style="display: inline-flex; flex-shrink: 0; will-change: transform"
  >
    <!-- First copy (visible) -->
    <div
      data-iris-marquee-content
      style="display: inline-flex; align-items: center; gap: {gap}px; flex-shrink: 0; padding-inline-end: {gap}px"
    >
      {@render children?.()}
    </div>
    <!-- Second copy (aria-hidden, for seamless loop) -->
    <div
      data-iris-marquee-content
      aria-hidden="true"
      style="display: inline-flex; align-items: center; gap: {gap}px; flex-shrink: 0; padding-inline-end: {gap}px"
    >
      {@render children?.()}
    </div>
  </div>
</div>
