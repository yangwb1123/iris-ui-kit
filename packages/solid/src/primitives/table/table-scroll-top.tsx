import { createEffect, createSignal, onCleanup, Show, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

const SCROLL_TOP_VISIBLE_PX = 200

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const BACK_TOP_ANCHOR_STYLE: JSX.CSSProperties = {
  position: 'sticky',
  'inset-block-end': '0px',
  height: '0px',
  'pointer-events': 'none',
  'z-index': '3',
}

const BACK_TOP_BUTTON_STYLE: JSX.CSSProperties = {
  position: 'absolute',
  'inset-block-end': '24px',
  'inset-inline-end': '24px',
  width: '40px',
  height: '40px',
  'border-radius': '50%',
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-surface, var(--iris-background))',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  'box-shadow': 'var(--iris-shadow-md)',
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  'font-size': 'var(--iris-font-size-xl, 18px)',
  'pointer-events': 'auto',
}

interface TableScrollTopProps {
  root: () => HTMLDivElement | undefined
  enabled: () => boolean
  hasVirtual: () => boolean
  rows: () => number
  loading: () => boolean
  error: () => boolean
}

/** Table-local back-to-top bridge; the table owns the effective scroller. */
export function TableScrollTop(props: TableScrollTopProps): JSX.Element {
  const { t } = useI18n()
  const [visible, setVisible] = createSignal(false)

  createEffect(() => {
    const enabled = props.enabled()
    // These values are DOM lifecycle boundaries: a virtual viewport can appear,
    // disappear, or be replaced without changing the stable table root.
    void props.hasVirtual()
    void props.rows()
    void props.loading()
    void props.error()

    if (!enabled || typeof window === 'undefined') {
      setVisible(false)
      return
    }
    const root = props.root()
    if (!root) {
      setVisible(false)
      return
    }

    // Resolve the effective scroller at event time. The virtual viewport is
    // conditional, so capturing it here would strand the listener across an
    // async empty → data or loading/error remount.
    const onScroll = (): void => {
      const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      const scroller = viewport ?? root
      setVisible(scroller.scrollTop >= SCROLL_TOP_VISIBLE_PX)
    }
    const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')

    // Scroll does not bubble. Capture at the stable root as well as binding the
    // current viewport directly, so a newly mounted viewport is never stranded.
    root.addEventListener('scroll', onScroll, true)
    viewport?.addEventListener('scroll', onScroll)
    onScroll()

    onCleanup(() => {
      root.removeEventListener('scroll', onScroll, true)
      viewport?.removeEventListener('scroll', onScroll)
      setVisible(false)
    })
  })

  const scrollToTop = (): void => {
    const root = props.root()
    if (!root) return
    const scroller = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]') ?? root
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    if (typeof scroller.scrollTo === 'function') {
      try {
        scroller.scrollTo({ top: 0, behavior })
        return
      } catch {
        // Fall through to the scrollTop assignment for unsupported browsers.
      }
    }
    scroller.scrollTop = 0
  }

  return (
    <Show when={visible()}>
      <div data-iris-back-top-anchor="" style={BACK_TOP_ANCHOR_STYLE}>
        <button
          type="button"
          data-iris-back-top-table=""
          aria-label={t('backTop.label')}
          title={t('backTop.label')}
          onClick={scrollToTop}
          style={BACK_TOP_BUTTON_STYLE}
        >
          ↑
        </button>
      </div>
    </Show>
  )
}
