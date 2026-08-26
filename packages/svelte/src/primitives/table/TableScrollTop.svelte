<script lang="ts" module>
  /** Props for the table-local back-to-top control. */
  export interface TableScrollTopProps {
    root: HTMLDivElement | null
    enabled: boolean
    hasVirtual: boolean
    rows: number
    loading: boolean
    error: boolean
  }
</script>

<script lang="ts">
  import { useI18n } from '../../i18n'

  type ScrollBehavior = 'auto' | 'instant' | 'smooth'
  const SCROLL_TOP_VISIBLE_PX = 200
  const BACK_TOP_ANCHOR_STYLE =
    'position: sticky; inset-block-end: 0px; height: 0px; pointer-events: none; z-index: 3;'
  const BACK_TOP_BUTTON_STYLE =
    'position: absolute; inset-block-end: 24px; inset-inline-end: 24px; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--iris-border); background: var(--iris-surface, var(--iris-background)); color: var(--iris-foreground); cursor: pointer; box-shadow: var(--iris-shadow-md); display: inline-flex; align-items: center; justify-content: center; font-size: var(--iris-font-size-xl, 18px); pointer-events: auto;'

  const { t } = useI18n()
  let { root, enabled, hasVirtual, rows, loading, error }: TableScrollTopProps = $props()
  let visible = $state(false)

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function effectiveScroller(tableRoot: HTMLDivElement): HTMLElement {
    return tableRoot.querySelector<HTMLElement>('[data-iris-virtual-scroll]') ?? tableRoot
  }

  $effect(() => {
    const tableRoot = root
    // Re-arm when the virtual viewport or its data presence changes. The
    // root capture listener also covers a virtual viewport that is remounted
    // by a loading/error state without changing either value.
    void hasVirtual
    void rows
    void loading
    void error
    if (!enabled || loading || error || typeof window === 'undefined' || !tableRoot) {
      visible = false
      return
    }

    const onScroll = (): void => {
      visible = effectiveScroller(tableRoot).scrollTop >= SCROLL_TOP_VISIBLE_PX
    }
    const viewport = tableRoot.querySelector<HTMLElement>('[data-iris-virtual-scroll]')

    // Scroll does not bubble. Capture at the stable root and also bind the
    // current viewport so both fixed-height and virtual tables are covered.
    tableRoot.addEventListener('scroll', onScroll, true)
    viewport?.addEventListener('scroll', onScroll)
    onScroll()

    return () => {
      tableRoot.removeEventListener('scroll', onScroll, true)
      viewport?.removeEventListener('scroll', onScroll)
      const currentViewport = tableRoot.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      if (currentViewport && currentViewport !== viewport) {
        currentViewport.removeEventListener('scroll', onScroll)
      }
      visible = false
    }
  })

  function scrollToTop(): void {
    if (!root) return
    const scroller = effectiveScroller(root)
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    if (typeof scroller.scrollTo === 'function') {
      try {
        scroller.scrollTo({ top: 0, behavior })
        return
      } catch {
        // Fall through to scrollTop for browsers without options support.
      }
    }
    scroller.scrollTop = 0
  }
</script>

{#if visible}
  <div data-iris-back-top-anchor="" style={BACK_TOP_ANCHOR_STYLE}>
    <button
      type="button"
      data-iris-back-top-table=""
      aria-label={t('backTop.label')}
      title={t('backTop.label')}
      onclick={scrollToTop}
      style={BACK_TOP_BUTTON_STYLE}
    >
      ↑
    </button>
  </div>
{/if}
