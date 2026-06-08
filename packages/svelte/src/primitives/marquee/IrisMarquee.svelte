<script lang="ts">
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

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  $effect(() => {
    const el = trackEl
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return
    const frames =
      direction === 'left'
        ? [{ transform: 'translateX(0%)' }, { transform: 'translateX(-50%)' }]
        : [{ transform: 'translateX(-50%)' }, { transform: 'translateX(0%)' }]
    anim = el.animate(frames, {
      duration: Math.max(1, duration) * 1000,
      iterations: Infinity,
    })
    return () => { anim?.cancel(); anim = null }
  })

  function setTrack(node: HTMLElement): { destroy: () => void } {
    trackEl = node
    return { destroy: () => { trackEl = undefined } }
  }
</script>

<div
  {...rest}
  data-iris-marquee
  onmouseenter={() => { if (pauseOnHover) anim?.pause() }}
  onmouseleave={() => { if (pauseOnHover) anim?.play() }}
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
