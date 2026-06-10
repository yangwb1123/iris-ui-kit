<script lang="ts">
  import type { Snippet } from 'svelte'
  import { useI18n } from '../../i18n'

  interface Props {
    value?: number
    loop?: boolean
    autoplay?: boolean
    interval?: number
    pauseOnHover?: boolean
    showArrows?: boolean
    showIndicators?: boolean
    ariaLabel?: string
    onValueChange?: (index: number) => void
    slides?: Snippet
    children?: Snippet
    style?: string
    class?: string
    slideCount?: number
  }

  let {
    value = 0,
    loop = true,
    autoplay = false,
    interval = 4000,
    pauseOnHover = true,
    showArrows = true,
    showIndicators = true,
    ariaLabel,
    onValueChange,
    slides,
    children,
    style,
    class: className,
    slideCount = 0,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  let hovered = $state(false)
  let focusedWithin = $state(false)
  let timerRef = $state<ReturnType<typeof setInterval> | undefined>(undefined)
  let liveText = $state('')

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function canAutoplay(): boolean {
    return autoplay && !prefersReducedMotion()
  }

  function stopTimer() {
    if (timerRef) clearInterval(timerRef)
    timerRef = undefined
  }

  function startTimer() {
    stopTimer()
    if (!canAutoplay()) return
    timerRef = setInterval(() => {
      if (!(pauseOnHover && hovered) && !focusedWithin) advance(1)
    }, interval)
  }

  $effect(() => {
    if (canAutoplay()) startTimer()
    else stopTimer()
    return () => stopTimer()
  })

  function advance(delta: number) {
    const count = slideCount || 1
    let next = value + delta
    if (loop) {
      next = ((next % count) + count) % count
    } else {
      next = Math.max(0, Math.min(count - 1, next))
    }
    if (next !== value) {
      onValueChange?.(next)
      liveText = t('carousel.slide', { index: next + 1, total: count })
    }
  }

  function goTo(idx: number) {
    if (idx !== value) {
      onValueChange?.(idx)
      liveText = t('carousel.slide', { index: idx + 1, total: slideCount })
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); advance(1) }
  }

  const canPrev = $derived(loop || value > 0)
  const canNext = $derived(loop || value < (slideCount - 1))
</script>

<div
  data-iris-carousel
  role="region"
  aria-roledescription="carousel"
  aria-label={ariaLabel ?? t('carousel.label')}
  onkeydown={onKeyDown}
  onmouseenter={() => { hovered = true }}
  onmouseleave={() => { hovered = false }}
  onfocusin={() => { focusedWithin = true }}
  onfocusout={() => { focusedWithin = false }}
  style:position="relative"
  style:overflow="hidden"
  style:display="flex"
  style:flex-direction="column"
  style={style}
  class={className}
  {...rest}
>
  <!-- Slides viewport -->
  <div
    data-iris-carousel-viewport
    style:position="relative"
    style:overflow="hidden"
    style:flex="1"
  >
    {#if slides}
      {@render slides()}
    {:else if children}
      {@render children()}
    {/if}
  </div>

  <!-- Arrows -->
  {#if showArrows}
    <button
      type="button"
      aria-label={t('carousel.previous')}
      data-iris-carousel-prev
      disabled={!canPrev}
      onclick={() => advance(-1)}
      style:position="absolute"
      style:left="8px"
      style:top="50%"
      style:transform="translateY(-50%)"
      style:z-index="2"
      style:width="32px"
      style:height="32px"
      style:border-radius="50%"
      style:border="1px solid var(--iris-border)"
      style:background="var(--iris-background)"
      style:color="var(--iris-foreground)"
      style:cursor={!canPrev ? 'not-allowed' : 'pointer'}
      style:opacity={!canPrev ? '0.4' : '1'}
      style:font-size="18px"
      style:display="inline-flex"
      style:align-items="center"
      style:justify-content="center"
    >‹</button>

    <button
      type="button"
      aria-label={t('carousel.next')}
      data-iris-carousel-next
      disabled={!canNext}
      onclick={() => advance(1)}
      style:position="absolute"
      style:right="8px"
      style:top="50%"
      style:transform="translateY(-50%)"
      style:z-index="2"
      style:width="32px"
      style:height="32px"
      style:border-radius="50%"
      style:border="1px solid var(--iris-border)"
      style:background="var(--iris-background)"
      style:color="var(--iris-foreground)"
      style:cursor={!canNext ? 'not-allowed' : 'pointer'}
      style:opacity={!canNext ? '0.4' : '1'}
      style:font-size="18px"
      style:display="inline-flex"
      style:align-items="center"
      style:justify-content="center"
    >›</button>
  {/if}

  <!-- Indicators -->
  {#if showIndicators && slideCount > 0}
    <div
      data-iris-carousel-indicators
      aria-hidden="true"
      style:display="flex"
      style:justify-content="center"
      style:gap="6px"
      style:padding="8px 0 4px"
    >
      {#each Array.from({ length: slideCount }, (_, i) => i) as i (i)}
        <button
          type="button"
          aria-label={t('carousel.goTo', { index: i + 1 })}
          data-state={i === value ? 'active' : 'idle'}
          onclick={() => goTo(i)}
          style:width={i === value ? '20px' : '8px'}
          style:height="8px"
          style:border-radius="4px"
          style:border="none"
          style:padding="0"
          style:cursor="pointer"
          style:background={i === value ? 'var(--iris-primary)' : 'var(--iris-border)'}
          style:transition="width 0.2s, background 0.2s"
        ></button>
      {/each}
    </div>
  {/if}

  <!-- ARIA live region -->
  <div aria-live="polite" aria-atomic="true" class="visually-hidden" style:position="absolute" style:width="1px" style:height="1px" style:overflow="hidden" style:clip="rect(0,0,0,0)">{liveText}</div>
</div>
