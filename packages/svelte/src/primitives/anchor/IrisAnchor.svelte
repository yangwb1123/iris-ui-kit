<script lang="ts">
  import { mergeStyle } from '../../internal/style'

  export interface IrisAnchorItem {
    href: string
    title: string
    key?: string
  }

  interface Props {
    items?: IrisAnchorItem[]
    target?: () => HTMLElement | Window | null
    offset?: number
    ariaLabel?: string
    style?: string
    onchange?: (href: string) => void
    [key: string]: unknown
  }

  let { items = [], target, offset = 0, ariaLabel, style, onchange, ...rest }: Props = $props()

  let active = $state('')
  let scrollEl: HTMLElement | Window | undefined

  function resolve(): HTMLElement | Window {
    return (target ? target() : window) ?? window
  }

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function compute() {
    let current = ''
    for (const item of items) {
      const node = document.getElementById(item.href.replace(/^#/, ''))
      if (node && node.getBoundingClientRect().top - offset <= 1) current = item.href
    }
    if (current !== active) {
      active = current
      onchange?.(current)
    }
  }

  $effect(() => {
    scrollEl = resolve()
    scrollEl.addEventListener('scroll', compute, { passive: true })
    compute()
    return () => scrollEl?.removeEventListener('scroll', compute)
  })

  function handleLinkClick(e: MouseEvent, href: string) {
    e.preventDefault()
    const node = document.getElementById(href.replace(/^#/, ''))
    if (!node) return
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      })
    }
    active = href
    onchange?.(href)
  }
</script>

<nav {...rest} data-iris-anchor aria-label={ariaLabel} style={mergeStyle('', style)}>
  <ul
    style="list-style: none; margin: 0; padding: 0; border-inline-start: 2px solid var(--iris-border);"
  >
    {#each items as item (item.key ?? item.href)}
      {@const isActive = active === item.href}
      <li data-iris-anchor-item>
        <a
          href={item.href}
          data-iris-anchor-link
          data-active={isActive ? 'true' : undefined}
          aria-current={isActive ? 'true' : undefined}
          onclick={(e) => handleLinkClick(e, item.href)}
          style="display: block; padding: 4px 12px; margin-inline-start: -2px; border-inline-start: 2px solid {isActive
            ? 'var(--iris-primary)'
            : 'transparent'}; color: {isActive
            ? 'var(--iris-primary)'
            : 'var(--iris-foreground)'}; font-weight: {isActive
            ? '600'
            : '400'}; text-decoration: none; font-size: 14px;">{item.title}</a
        >
      </li>
    {/each}
  </ul>
</nav>
