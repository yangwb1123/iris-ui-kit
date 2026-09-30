import { h, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type VNode } from 'vue'

const SCROLL_TOP_VISIBLE_PX = 200
const BACK_TOP_ANCHOR_STYLE: Record<string, string> = {
  position: 'sticky',
  insetBlockEnd: '0px',
  height: '0px',
  pointerEvents: 'none',
  zIndex: '3',
}
const BACK_TOP_BUTTON_STYLE: Record<string, string> = {
  position: 'absolute',
  insetBlockEnd: '24px',
  insetInlineEnd: '24px',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-surface, var(--iris-background))',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  boxShadow: 'var(--iris-shadow-md)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--iris-font-size-xl, 18px)',
  pointerEvents: 'auto',
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export interface TableBackTopOptions {
  getRoot: () => HTMLElement | null
  getEnabled: () => boolean
  getVirtual: () => boolean
  getPrintable: () => boolean
  bodyData: ComputedRef<unknown>
  loading: ComputedRef<unknown>
  error: ComputedRef<unknown>
  label: () => string
}

export function useTableBackTop(options: TableBackTopOptions) {
  const shown = ref(false)
  let listeners: HTMLElement[] = []

  const onScroll = (): void => {
    const root = options.getRoot()
    if (!root) return
    const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
    shown.value = (viewport ?? root).scrollTop >= SCROLL_TOP_VISIBLE_PX
  }
  const clearListeners = (): void => {
    for (const element of listeners) element.removeEventListener('scroll', onScroll)
    listeners = []
  }
  const attachListeners = (): void => {
    clearListeners()
    shown.value = false
    const root = options.getRoot()
    if (!options.getEnabled() || !root) return
    const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
    root.addEventListener('scroll', onScroll)
    listeners.push(root)
    if (viewport) {
      viewport.addEventListener('scroll', onScroll)
      listeners.push(viewport)
    }
    onScroll()
  }

  onMounted(attachListeners)
  watch(
    [options.getEnabled, options.getVirtual, options.bodyData, options.loading, options.error],
    attachListeners,
    { flush: 'post' },
  )
  onBeforeUnmount(clearListeners)

  const scrollToTop = (): void => {
    const root = options.getRoot()
    if (!root) return
    const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
    const scroller = viewport ?? root
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    if (typeof scroller.scrollTo === 'function') {
      try {
        scroller.scrollTo({ top: 0, behavior })
        return
      } catch {
        // Fall through for browsers/DOM shims with a throwing scrollTo.
      }
    }
    scroller.scrollTop = 0
  }
  const render = (): VNode | null => {
    if (!options.getEnabled() || !shown.value || options.getPrintable()) return null
    return h('div', { 'data-iris-back-top-anchor': '', style: BACK_TOP_ANCHOR_STYLE }, [
      h(
        'button',
        {
          type: 'button',
          'data-iris-back-top-table': '',
          'aria-label': options.label(),
          title: options.label(),
          onClick: scrollToTop,
          style: BACK_TOP_BUTTON_STYLE,
        },
        '↑',
      ),
    ])
  }

  return { shown, render }
}
