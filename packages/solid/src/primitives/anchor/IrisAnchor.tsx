import { createSignal, For, mergeProps, onCleanup, onMount, splitProps, type JSX } from 'solid-js'

export interface IrisAnchorItem {
  href: string
  title: string
  key?: string
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

export interface IrisAnchorProps {
  items?: IrisAnchorItem[]
  target?: () => HTMLElement | Window | null
  offset?: number
  ariaLabel?: string
  onChange?: (href: string) => void
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

/** Solid port of IrisAnchor — jump-nav sidebar with scroll-spy via IntersectionObserver. */
export function IrisAnchor(props: IrisAnchorProps): JSX.Element {
  const merged = mergeProps({ items: [] as IrisAnchorItem[], offset: 0 }, props)
  const [local, rest] = splitProps(merged, [
    'items',
    'target',
    'offset',
    'ariaLabel',
    'onChange',
    'style',
  ])

  const [active, setActive] = createSignal('')
  let el: HTMLElement | Window | undefined

  const compute = (): void => {
    let current = ''
    for (const item of local.items) {
      const node = document.getElementById(item.href.replace(/^#/, ''))
      if (node && node.getBoundingClientRect().top - local.offset <= 1) current = item.href
    }
    if (current !== active()) {
      setActive(current)
      local.onChange?.(current)
    }
  }

  onMount(() => {
    el = resolve(local.target)
    el.addEventListener('scroll', compute, { passive: true })
    compute()
  })

  onCleanup(() => {
    el?.removeEventListener('scroll', compute)
  })

  const onLinkClick = (e: MouseEvent, href: string): void => {
    e.preventDefault()
    const node = document.getElementById(href.replace(/^#/, ''))
    if (!node) return
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      })
    }
    setActive(href)
    local.onChange?.(href)
  }

  return (
    <nav
      {...rest}
      data-iris-anchor=""
      aria-label={local.ariaLabel}
      style={typeof local.style === 'object' ? local.style : undefined}
    >
      <ul
        style={{
          'list-style': 'none',
          margin: '0',
          padding: '0',
          'border-inline-start': '2px solid var(--iris-border)',
        }}
      >
        <For each={local.items}>
          {(item) => {
            const isActive = (): boolean => active() === item.href
            return (
              <li data-iris-anchor-item="">
                <a
                  href={item.href}
                  data-iris-anchor-link=""
                  data-active={isActive() ? 'true' : undefined}
                  aria-current={isActive() ? 'true' : undefined}
                  onClick={(e) => onLinkClick(e, item.href)}
                  style={{
                    display: 'block',
                    padding: '4px 12px',
                    'margin-inline-start': '-2px',
                    'border-inline-start': `2px solid ${isActive() ? 'var(--iris-primary)' : 'transparent'}`,
                    color: isActive() ? 'var(--iris-primary)' : 'var(--iris-foreground)',
                    'font-weight': isActive() ? '600' : '400',
                    'text-decoration': 'none',
                    'font-size': '14px',
                  }}
                >
                  {item.title}
                </a>
              </li>
            )
          }}
        </For>
      </ul>
    </nav>
  )
}
