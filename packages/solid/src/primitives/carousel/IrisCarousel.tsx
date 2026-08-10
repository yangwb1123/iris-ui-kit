import {
  createSignal,
  createEffect,
  mergeProps,
  splitProps,
  Show,
  For,
  children,
  onCleanup,
  type JSX,
} from 'solid-js'
import { useI18n } from '../../i18n'

export interface IrisCarouselProps {
  index?: number
  defaultIndex?: number
  loop?: boolean
  autoplay?: boolean
  interval?: number
  pauseOnHover?: boolean
  showArrows?: boolean
  showIndicators?: boolean
  ariaLabel?: string
  onChange?: (index: number) => void
  children?: JSX.Element
}

/**
 * Slide carousel: shows one child at a time with prev/next controls, dots, and
 * keyboard (←/→) navigation. Solid port of the Vue IrisCarousel.
 */
export function IrisCarousel(props: IrisCarouselProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultIndex: 0,
      loop: true,
      autoplay: false,
      interval: 4000,
      pauseOnHover: true,
      showArrows: true,
      showIndicators: true,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'index',
    'defaultIndex',
    'loop',
    'autoplay',
    'interval',
    'pauseOnHover',
    'showArrows',
    'showIndicators',
    'ariaLabel',
    'onChange',
    'children',
  ])

  const { t } = useI18n()

  const [internalIndex, setInternalIndex] = createSignal(local.defaultIndex)
  const [paused, setPaused] = createSignal(false)
  const [focusedWithin, setFocusedWithin] = createSignal(false)

  // True when the user prefers reduced motion (SSR / jsdom safe). Autoplay is
  // disabled in that case, matching React/Vue/Svelte.
  const reducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const currentIndex = () => (local.index !== undefined ? local.index : internalIndex())

  const resolved = children(() => local.children)
  const slides = (): JSX.Element[] => {
    const c = resolved.toArray()
    return c as JSX.Element[]
  }
  const count = () => slides().length

  const goTo = (idx: number) => {
    let next = idx
    if (local.loop) {
      next = ((idx % count()) + count()) % count()
    } else {
      next = Math.max(0, Math.min(count() - 1, idx))
    }
    if (next === currentIndex()) return
    if (local.index === undefined) setInternalIndex(next)
    local.onChange?.(next)
  }

  const prev = () => goTo(currentIndex() - 1)
  const next = () => goTo(currentIndex() + 1)

  // Autoplay — paused on hover/focus and when the user prefers reduced motion
  // (matches React/Vue/Svelte).
  createEffect(() => {
    if (!local.autoplay || paused() || focusedWithin() || count() <= 1 || reducedMotion()) return
    const id = setInterval(() => {
      goTo(currentIndex() + 1)
    }, local.interval)
    onCleanup(() => clearInterval(id))
  })

  const arrowBtnStyle: JSX.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    'z-index': '2',
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '32px',
    height: '32px',
    'border-radius': '50%',
    border: '1px solid var(--iris-border)',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    cursor: 'pointer',
    'font-size': 'var(--iris-font-size-xl, 18px)',
  }

  return (
    <div
      data-iris-carousel=""
      role="region"
      aria-roledescription="carousel"
      aria-label={local.ariaLabel ?? t('carousel.label')}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          prev()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          next()
        }
      }}
      onMouseEnter={() => local.pauseOnHover && setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusIn={() => setFocusedWithin(true)}
      onFocusOut={() => setFocusedWithin(false)}
      tabIndex={0}
      style={{
        position: 'relative',
        overflow: 'hidden',
        outline: 'none',
        'user-select': 'none',
      }}
    >
      {/* Slides container */}
      <div
        data-iris-carousel-track=""
        aria-live="polite"
        style={{
          display: 'flex',
          transition: 'transform 300ms ease',
          transform: `translateX(-${currentIndex() * 100}%)`,
          width: `${count() * 100}%`,
        }}
      >
        <For each={slides()}>
          {(slide, i) => (
            <div
              data-iris-carousel-slide={i()}
              role="group"
              aria-roledescription="slide"
              aria-label={t('carousel.slide', { index: i() + 1, total: count() })}
              aria-hidden={i() !== currentIndex()}
              style={{ width: `${100 / count()}%`, 'flex-shrink': '0' }}
            >
              {slide}
            </div>
          )}
        </For>
      </div>

      {/* Arrows */}
      <Show when={local.showArrows && count() > 1}>
        <button
          type="button"
          data-iris-carousel-prev=""
          aria-label={t('carousel.previous')}
          onClick={prev}
          disabled={!local.loop && currentIndex() === 0 ? true : undefined}
          style={{ ...arrowBtnStyle, left: '8px' }}
        >
          ‹
        </button>
        <button
          type="button"
          data-iris-carousel-next=""
          aria-label={t('carousel.next')}
          onClick={next}
          disabled={!local.loop && currentIndex() === count() - 1 ? true : undefined}
          style={{ ...arrowBtnStyle, right: '8px' }}
        >
          ›
        </button>
      </Show>

      {/* Indicators */}
      <Show when={local.showIndicators && count() > 1}>
        <div
          data-iris-carousel-indicators=""
          role="tablist"
          aria-label={t('carousel.slides')}
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 'var(--iris-space-xs, 8px)',
            'z-index': '2',
          }}
        >
          <For each={slides()}>
            {(_, i) => (
              <button
                type="button"
                role="tab"
                aria-selected={i() === currentIndex()}
                aria-label={t('carousel.goTo', { index: i() + 1 })}
                data-iris-carousel-indicator={i()}
                onClick={() => goTo(i())}
                style={{
                  width: '8px',
                  height: '8px',
                  padding: '0',
                  'border-radius': '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    i() === currentIndex() ? 'var(--iris-primary)' : 'rgba(255,255,255,0.5)',
                  transition: 'background 200ms',
                }}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
