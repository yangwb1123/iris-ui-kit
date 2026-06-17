<script lang="ts">
  import { mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type ScrollBehavior = 'auto' | 'instant' | 'smooth'

  interface Props {
    target?: () => HTMLElement | Window | null
    visibilityHeight?: number
    behavior?: ScrollBehavior
    ariaLabel?: string
    style?: string
    children?: import('svelte').Snippet
    onclick?: () => void
    [key: string]: unknown
  }

  let {
    target,
    visibilityHeight = 400,
    behavior = 'smooth',
    ariaLabel = undefined,
    style,
    children,
    onclick,
    ...rest
  }: Props = $props()

  let visible = $state(false)
  let scrollEl: HTMLElement | Window | undefined

  function resolve(): HTMLElement | Window {
    return (target ? target() : window) ?? window
  }

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function onScroll() {
    if (!scrollEl) return
    const top = scrollEl === window ? (window.scrollY ?? 0) : (scrollEl as HTMLElement).scrollTop
    visible = top >= visibilityHeight
  }

  $effect(() => {
    scrollEl = resolve()
    scrollEl.addEventListener('scroll', onScroll)
    onScroll()
    return () => scrollEl?.removeEventListener('scroll', onScroll)
  })

  function scrollToTop() {
    if (!scrollEl) return
    const b: ScrollBehavior = prefersReducedMotion() ? 'auto' : behavior
    if (typeof (scrollEl as { scrollTo?: unknown }).scrollTo === 'function') {
      ;(scrollEl as Window | HTMLElement).scrollTo({ top: 0, behavior: b })
    } else {
      ;(scrollEl as HTMLElement).scrollTop = 0
    }
    onclick?.()
  }

  const baseStyle = `position: fixed; inset-inline-end: 24px; inset-block-end: 24px; z-index: 100; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--iris-border); background: var(--iris-surface, var(--iris-background)); color: var(--iris-foreground); cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: inline-flex; align-items: center; justify-content: center; font-size: 18px;`
</script>

{#if visible}
  <button
    type="button"
    {...rest}
    data-iris-back-top
    aria-label={ariaLabel ?? t('backTop.label')}
    onclick={scrollToTop}
    style={mergeStyle(baseStyle, style)}
  >
    {#if children}
      {@render children()}
    {:else}
      ↑
    {/if}
  </button>
{/if}
