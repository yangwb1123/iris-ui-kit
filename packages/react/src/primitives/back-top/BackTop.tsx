import * as React from 'react'
import { useI18n } from '../../i18n'

export interface IrisBackTopProps {
  /** Scroll container resolver. Defaults to the window. */
  target?: () => HTMLElement | Window | null
  /** Show the button once the scroll position passes this (px). */
  visibilityHeight?: number
  /** Scroll behavior; forced to 'auto' under reduced motion. */
  behavior?: ScrollBehavior
  onClick?: () => void
  ariaLabel?: string
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const resolve = (target?: () => HTMLElement | Window | null): HTMLElement | Window =>
  (target ? target() : window) ?? window

/**
 * Back-to-top button: appears once the scroll target passes `visibilityHeight`
 * and scrolls it back to the top on click (honoring reduced motion). Defaults
 * to the window; pass `target` for a scrollable container.
 *
 * React port of {@link import('@iris-ui/vue').IrisBackTop}.
 */
export function IrisBackTop({
  target,
  visibilityHeight = 400,
  behavior = 'smooth',
  onClick,
  ariaLabel,
  children,
  style,
  className,
}: IrisBackTopProps): React.ReactElement | null {
  const { t } = useI18n()
  const [visible, setVisible] = React.useState(false)
  const targetRef = React.useRef(target)
  targetRef.current = target

  React.useEffect(() => {
    const el = resolve(targetRef.current)
    const onScroll = () => {
      const top = el === window ? (window.scrollY ?? 0) : (el as HTMLElement).scrollTop
      setVisible(top >= visibilityHeight)
    }
    el.addEventListener('scroll', onScroll)
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [visibilityHeight])

  if (!visible) return null

  const scrollToTop = () => {
    const el = resolve(targetRef.current)
    const b: ScrollBehavior = prefersReducedMotion() ? 'auto' : behavior
    if (typeof (el as { scrollTo?: unknown }).scrollTo === 'function') {
      ;(el as Window | HTMLElement).scrollTo({ top: 0, behavior: b })
    } else {
      ;(el as HTMLElement).scrollTop = 0
    }
    onClick?.()
  }

  return (
    <button
      type="button"
      data-iris-back-top=""
      aria-label={ariaLabel ?? t('backTop.label')}
      onClick={scrollToTop}
      className={className}
      style={{
        position: 'fixed',
        insetInlineEnd: 24,
        insetBlockEnd: 24,
        zIndex: 100,
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '1px solid var(--iris-border)',
        background: 'var(--iris-surface, var(--iris-background))',
        color: 'var(--iris-foreground)',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        ...style,
      }}
    >
      {children ?? '↑'}
    </button>
  )
}
