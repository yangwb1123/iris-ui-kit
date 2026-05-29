import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'

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

/**
 * Anchor: in-page navigation that scroll-spies its `#id` sections — the active
 * link is the last section whose top has passed `offset`. Clicking a link
 * smooth-scrolls to its section (honoring reduced motion).
 */
export const IrisAnchor = defineComponent({
  name: 'IrisAnchor',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<IrisAnchorItem[]>, default: () => [] },
    /** Scroll container resolver. Defaults to the window. */
    target: { type: Function as PropType<() => HTMLElement | Window | null>, default: undefined },
    /** Top offset (px) for active detection + scroll target. */
    offset: { type: Number, default: 0 },
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    change: (_href: string) => true,
  },
  setup(props, { attrs, emit }) {
    const active = ref('')
    let el: HTMLElement | Window | undefined

    const compute = () => {
      let current = ''
      for (const item of props.items) {
        const node = document.getElementById(item.href.replace(/^#/, ''))
        if (node && node.getBoundingClientRect().top - props.offset <= 1) current = item.href
      }
      if (current !== active.value) {
        active.value = current
        emit('change', current)
      }
    }

    onMounted(() => {
      el = resolve(props.target)
      el.addEventListener('scroll', compute, { passive: true })
      compute()
    })
    onBeforeUnmount(() => el?.removeEventListener('scroll', compute))

    const onLinkClick = (e: MouseEvent, href: string) => {
      e.preventDefault()
      const node = document.getElementById(href.replace(/^#/, ''))
      if (!node) return
      if (typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        })
      }
      active.value = href
      emit('change', href)
    }

    return () =>
      h('nav', { ...attrs, 'data-iris-anchor': '', 'aria-label': props.ariaLabel }, [
        h(
          'ul',
          {
            style: {
              listStyle: 'none',
              margin: '0',
              padding: '0',
              borderInlineStart: '2px solid var(--iris-border)',
            },
          },
          props.items.map((item) => {
            const isActive = active.value === item.href
            return h('li', { key: item.key ?? item.href, 'data-iris-anchor-item': '' }, [
              h(
                'a',
                {
                  href: item.href,
                  'data-iris-anchor-link': '',
                  'data-active': isActive ? 'true' : undefined,
                  'aria-current': isActive ? 'true' : undefined,
                  onClick: (e: MouseEvent) => onLinkClick(e, item.href),
                  style: {
                    display: 'block',
                    padding: '4px 12px',
                    marginInlineStart: '-2px',
                    borderInlineStart: `2px solid ${isActive ? 'var(--iris-primary)' : 'transparent'}`,
                    color: isActive ? 'var(--iris-primary)' : 'var(--iris-foreground)',
                    fontWeight: isActive ? '600' : '400',
                    textDecoration: 'none',
                    fontSize: '14px',
                  },
                },
                item.title,
              ),
            ])
          }),
        ),
      ])
  },
})
