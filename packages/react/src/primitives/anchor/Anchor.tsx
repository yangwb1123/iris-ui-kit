import * as React from 'react'

export interface IrisAnchorItem {
  href: string
  title: string
  key?: string
}

export interface IrisAnchorProps {
  items: IrisAnchorItem[]
  /** Scroll container resolver. Defaults to the window. */
  target?: () => HTMLElement | Window | null
  /** Top offset (px) for active detection + scroll target. */
  offset?: number
  onChange?: (href: string) => void
  ariaLabel?: string
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
 * Anchor: in-page navigation that scroll-spies its `#id` sections — the active
 * link is the last section whose top has passed `offset`. Clicking a link
 * smooth-scrolls to its section (honoring reduced motion).
 *
 * React port of {@link import('@iris-ui/vue').IrisAnchor}.
 */
export function IrisAnchor({
  items,
  target,
  offset = 0,
  onChange,
  ariaLabel,
  style,
  className,
  ...rest
}: IrisAnchorProps): React.ReactElement {
  const [active, setActive] = React.useState('')
  const activeRef = React.useRef('')
  const itemsRef = React.useRef(items)
  itemsRef.current = items
  const offsetRef = React.useRef(offset)
  offsetRef.current = offset
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange
  const targetRef = React.useRef(target)
  targetRef.current = target

  React.useEffect(() => {
    const el = resolve(targetRef.current)
    const compute = () => {
      let current = ''
      for (const item of itemsRef.current) {
        const node = document.getElementById(item.href.replace(/^#/, ''))
        if (node && node.getBoundingClientRect().top - offsetRef.current <= 1) current = item.href
      }
      if (current !== activeRef.current) {
        activeRef.current = current
        setActive(current)
        onChangeRef.current?.(current)
      }
    }
    el.addEventListener('scroll', compute, { passive: true })
    compute()
    return () => el.removeEventListener('scroll', compute)
  }, [])

  const onLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const node = document.getElementById(href.replace(/^#/, ''))
    if (!node) return
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    }
    activeRef.current = href
    setActive(href)
    onChange?.(href)
  }

  return (
    <nav data-iris-anchor="" aria-label={ariaLabel} className={className} {...rest} style={style}>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          borderInlineStart: '2px solid var(--iris-border)',
        }}
      >
        {items.map((item) => {
          const isActive = active === item.href
          return (
            <li key={item.key ?? item.href} data-iris-anchor-item="">
              <a
                href={item.href}
                data-iris-anchor-link=""
                data-active={isActive ? 'true' : undefined}
                aria-current={isActive ? 'true' : undefined}
                onClick={(e) => onLinkClick(e, item.href)}
                style={{
                  display: 'block',
                  padding: '4px 12px',
                  marginInlineStart: -2,
                  borderInlineStart: `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}`,
                  color: isActive ? 'var(--iris-primary)' : 'var(--iris-foreground)',
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                  fontSize: 14,
                }}
              >
                {item.title}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
