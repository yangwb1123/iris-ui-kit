import * as React from 'react'

export interface IrisAffixProps {
  /** Pin this many px from the top once scrolled past. */
  offsetTop?: number
  /** Pin this many px from the bottom (used when `offsetTop` is unset). */
  offsetBottom?: number
  /** Scroll container resolver. Defaults to the window. */
  target?: () => HTMLElement | Window | null
  onChange?: (affixed: boolean) => void
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const resolve = (target?: () => HTMLElement | Window | null): HTMLElement | Window =>
  (target ? target() : window) ?? window

/**
 * Affix: pins its content to the viewport once the user scrolls past it.
 * Top mode (`offsetTop`) or bottom mode (`offsetBottom`); the placeholder
 * reserves the content's height so the page doesn't jump when it detaches.
 * `onChange` fires only when the affixed state flips.
 *
 * React port of {@link import('@iris-ui/vue').IrisAffix}.
 */
export function IrisAffix({
  offsetTop,
  offsetBottom,
  target,
  onChange,
  children,
  style,
  className,
}: IrisAffixProps): React.ReactElement {
  const placeholderRef = React.useRef<HTMLDivElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [affixed, setAffixed] = React.useState(false)
  const [fixedStyle, setFixedStyle] = React.useState<React.CSSProperties | undefined>(undefined)
  const [reserve, setReserve] = React.useState<number | undefined>(undefined)
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange
  const targetRef = React.useRef(target)
  targetRef.current = target
  const affixedRef = React.useRef(false)

  React.useEffect(() => {
    const el = resolve(targetRef.current)
    const useTop = offsetTop != null || offsetBottom == null
    const ot = offsetTop ?? 0
    const ob = offsetBottom ?? 0

    const update = () => {
      const ph = placeholderRef.current
      if (!ph) return
      const rect = ph.getBoundingClientRect()
      const vh = window.innerHeight || 0
      const next = useTop ? rect.top <= ot : rect.bottom >= vh - ob
      if (next === affixedRef.current) return
      affixedRef.current = next
      const width = ph.offsetWidth
      setFixedStyle(
        next
          ? {
              position: 'fixed',
              insetInlineStart: rect.left,
              width,
              zIndex: 10,
              ...(useTop ? { top: ot } : { bottom: ob }),
            }
          : undefined,
      )
      setReserve(next ? (contentRef.current?.offsetHeight ?? 0) : undefined)
      setAffixed(next)
      onChangeRef.current?.(next)
    }

    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [offsetTop, offsetBottom])

  return (
    <div
      ref={placeholderRef}
      data-iris-affix=""
      data-affixed={affixed ? 'true' : undefined}
      className={className}
      style={{ ...(affixed && reserve ? { height: reserve } : null), ...style }}
    >
      <div ref={contentRef} data-iris-affix-content="" style={affixed ? fixedStyle : undefined}>
        {children}
      </div>
    </div>
  )
}
