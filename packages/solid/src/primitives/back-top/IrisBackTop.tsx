import { createSignal, mergeProps, onCleanup, onMount, Show, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const resolve = (target?: () => HTMLElement | Window | null): HTMLElement | Window =>
  (target ? target() : window) ?? window

export interface IrisBackTopProps {
  target?: () => HTMLElement | Window | null
  visibilityHeight?: number
  behavior?: ScrollBehavior
  ariaLabel?: string
  children?: JSX.Element
  onClick?: () => void
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

/** Solid port of IrisBackTop — scroll-to-top FAB that appears after threshold. */
export function IrisBackTop(props: IrisBackTopProps): JSX.Element {
  const merged = mergeProps({ visibilityHeight: 400, behavior: 'smooth' as ScrollBehavior }, props)
  const [local, rest] = splitProps(merged, [
    'target',
    'visibilityHeight',
    'behavior',
    'ariaLabel',
    'children',
    'onClick',
    'style',
  ])

  const { t } = useI18n()

  const [visible, setVisible] = createSignal(false)
  let el: HTMLElement | Window | undefined

  const onScroll = (): void => {
    if (!el) return
    const top = el === window ? (window.scrollY ?? 0) : (el as HTMLElement).scrollTop
    setVisible(top >= local.visibilityHeight)
  }

  onMount(() => {
    el = resolve(local.target)
    el.addEventListener('scroll', onScroll)
    onScroll()
  })

  onCleanup(() => {
    el?.removeEventListener('scroll', onScroll)
  })

  const scrollToTop = (): void => {
    if (!el) return
    const b: ScrollBehavior = prefersReducedMotion() ? 'auto' : local.behavior
    if (typeof (el as { scrollTo?: unknown }).scrollTo === 'function') {
      ;(el as Window | HTMLElement).scrollTo({ top: 0, behavior: b })
    } else {
      ;(el as HTMLElement).scrollTop = 0
    }
    local.onClick?.()
  }

  return (
    <Show when={visible()}>
      <button
        {...rest}
        type="button"
        data-iris-back-top=""
        aria-label={local.ariaLabel ?? t('backTop.label')}
        onClick={scrollToTop}
        style={{
          position: 'fixed',
          'inset-inline-end': '24px',
          'inset-block-end': '24px',
          'z-index': '100',
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
          ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
        }}
      >
        {local.children ?? '↑'}
      </button>
    </Show>
  )
}
