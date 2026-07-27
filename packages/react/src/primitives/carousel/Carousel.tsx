import * as React from 'react'
import { useI18n } from '../../i18n'

export interface IrisCarouselProps {
  /** Each child is a slide. */
  children: React.ReactNode
  /** Controlled active slide index. */
  index?: number
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  /** Wrap around at the ends (default true). */
  loop?: boolean
  /** Auto-advance slides. Disabled when the user prefers reduced motion. */
  autoplay?: boolean
  /** Autoplay interval in ms (default 4000). */
  interval?: number
  /** Pause autoplay while hovered (default true). */
  pauseOnHover?: boolean
  showArrows?: boolean
  showIndicators?: boolean
  /** Accessible name for the carousel region. */
  ariaLabel?: string
  style?: React.CSSProperties
  className?: string
}

const ARROW_BTN: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-background)',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
}

/** True when the user has asked for reduced motion (SSR / jsdom safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Slide carousel: shows one child slide at a time with prev/next controls,
 * indicator dots, and keyboard (←/→) navigation. Controlled or uncontrolled.
 * a11y: region with `aria-roledescription="carousel"`, per-slide labelling,
 * and a polite live region announcing the active slide.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisCarousel}.
 */
export function IrisCarousel({
  children,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  loop = true,
  autoplay = false,
  interval = 4000,
  pauseOnHover = true,
  showArrows = true,
  showIndicators = true,
  ariaLabel,
  style,
  className,
}: IrisCarouselProps): React.ReactElement {
  const { t } = useI18n()
  const slides = React.Children.toArray(children)
  const count = slides.length
  const isControlled = indexProp !== undefined
  const [internal, setInternal] = React.useState(defaultIndex)
  const current = Math.min(
    Math.max(0, isControlled ? (indexProp as number) : internal),
    Math.max(0, count - 1),
  )

  const goTo = (i: number) => {
    if (count === 0) return
    const next = loop ? ((i % count) + count) % count : Math.min(count - 1, Math.max(0, i))
    if (next === current) return
    if (!isControlled) setInternal(next)
    onIndexChange?.(next)
  }

  // Autoplay: a self-rescheduling timeout (resets on manual nav since `current`
  // is a dep). Paused on hover/focus and when the user prefers reduced motion.
  const onIndexChangeRef = React.useRef(onIndexChange)
  onIndexChangeRef.current = onIndexChange
  const [hovered, setHovered] = React.useState(false)
  const [focusedWithin, setFocusedWithin] = React.useState(false)
  const paused = (pauseOnHover && hovered) || focusedWithin

  React.useEffect(() => {
    if (!autoplay || paused || count <= 1 || prefersReducedMotion()) return
    const id = setTimeout(() => {
      const target = (current + 1) % count
      if (!isControlled) setInternal(target)
      onIndexChangeRef.current?.(target)
    }, interval)
    return () => clearTimeout(id)
  }, [autoplay, paused, interval, current, count, isControlled])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(current - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(current + 1)
    }
  }

  return (
    <div
      data-iris-carousel=""
      role="group"
      aria-roledescription="carousel"
      aria-label={ariaLabel ?? t('carousel.label')}
      tabIndex={0}
      className={className}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusedWithin(true)}
      onBlur={() => setFocusedWithin(false)}
      style={{ position: 'relative', outline: 'none', ...style }}
    >
      <div
        data-iris-carousel-viewport=""
        style={{
          overflow: 'hidden',
          position: 'relative',
          borderRadius: 'var(--iris-radius-md, 6px)',
        }}
      >
        <div
          data-iris-carousel-track=""
          style={{
            display: 'flex',
            transform: `translateX(-${current * 100}%)`,
            transition: 'transform 300ms ease',
          }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              data-iris-carousel-slide=""
              data-active={i === current ? 'true' : undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={t('carousel.slide', { index: i + 1, total: count })}
              aria-hidden={i !== current ? 'true' : undefined}
              style={{ flex: '0 0 100%', width: '100%', minWidth: 0 }}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {showArrows && count > 1 ? (
        <>
          <button
            type="button"
            data-iris-carousel-prev=""
            aria-label={t('carousel.previous')}
            onClick={() => goTo(current - 1)}
            disabled={!loop && current === 0}
            style={{ ...ARROW_BTN, insetInlineStart: 8 }}
          >
            ‹
          </button>
          <button
            type="button"
            data-iris-carousel-next=""
            aria-label={t('carousel.next')}
            onClick={() => goTo(current + 1)}
            disabled={!loop && current === count - 1}
            style={{ ...ARROW_BTN, insetInlineEnd: 8 }}
          >
            ›
          </button>
        </>
      ) : null}

      {showIndicators && count > 1 ? (
        <div
          data-iris-carousel-indicators=""
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            marginBlockStart: 8,
          }}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              data-iris-carousel-indicator=""
              data-active={i === current ? 'true' : undefined}
              aria-label={t('carousel.slide', { index: i + 1, total: count })}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => goTo(i)}
              style={{
                width: 8,
                height: 8,
                padding: 0,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: i === current ? 'var(--iris-primary)' : 'var(--iris-border)',
              }}
            />
          ))}
        </div>
      ) : null}

      <div
        data-iris-carousel-live=""
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {t('carousel.slide', { index: current + 1, total: count })}
      </div>
    </div>
  )
}
