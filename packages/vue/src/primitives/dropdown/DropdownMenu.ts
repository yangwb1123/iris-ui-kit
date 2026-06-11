import { Teleport, defineComponent, h, inject, nextTick, ref, watch, type PropType } from 'vue'
import { matchTypeahead, nextEnabledIndex } from '@iris-ui/core'
import { useFloating } from '../floating/useFloating'
import { useDismiss } from '../floating/useDismiss'
import { DropdownContextKey } from './context'

/**
 * The menu surface. Renders `role="menu"` and handles ArrowUp/Down navigation
 * across child `IrisDropdownItem`s. Closes on Escape and outside pointerdown.
 * Teleports to body by default.
 */
export const IrisDropdownMenu = defineComponent({
  name: 'IrisDropdownMenu',
  inheritAttrs: false,
  props: {
    teleport: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: 'body',
    },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DropdownContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDropdownMenu must be a descendant of IrisDropdown')
    }

    const innerRef = ref<HTMLElement | null>(null)
    watch(innerRef, (el) => {
      ctx.contentRef.value = el
    })

    const { floatingStyles } = useFloating({
      anchor: ctx.triggerRef,
      floating: innerRef,
      open: ctx.open,
      placement: ctx.placement,
      offset: ctx.offset,
    })

    useDismiss({
      enabled: ctx.open,
      exclude: [ctx.triggerRef, innerRef],
      onDismiss: () => ctx.setOpen(false),
    })

    // Focus first menu item on open.
    watch(ctx.open, async (open) => {
      if (open) {
        await nextTick()
        const items = innerRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]')
        items?.[0]?.focus()
      } else {
        // Restore focus to trigger.
        ctx.triggerRef.value?.focus?.()
      }
    })

    // Typeahead buffer: accumulated printable chars, reset after a ~500ms pause.
    // Plain closure state — does not need to be reactive.
    const typeahead: { buffer: string; timer: ReturnType<typeof setTimeout> | null } = {
      buffer: '',
      timer: null,
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ctx.open.value) return
      const items = Array.from(
        innerRef.value?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) ?? [],
      )
      if (items.length === 0) return
      const current = document.activeElement as HTMLElement | null
      const index = current ? items.indexOf(current) : -1
      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          items[nextEnabledIndex(index, 1, items.length)]?.focus()
          break
        }
        case 'ArrowUp': {
          event.preventDefault()
          items[nextEnabledIndex(index, -1, items.length)]?.focus()
          break
        }
        case 'Home':
          event.preventDefault()
          items[0]?.focus()
          break
        case 'End':
          event.preventDefault()
          items[items.length - 1]?.focus()
          break
        case 'Tab':
          // Tab closes the menu and lets focus continue.
          ctx.setOpen(false)
          break
        default: {
          // Typeahead: a single printable char jumps to (and repeated chars
          // cycle through) items whose label matches the accumulated buffer.
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            typeahead.buffer += event.key
            if (typeahead.timer) clearTimeout(typeahead.timer)
            typeahead.timer = setTimeout(() => {
              typeahead.buffer = ''
            }, 500)
            const match = matchTypeahead(
              items.map((it) => it.textContent ?? ''),
              typeahead.buffer,
              index,
            )
            if (match >= 0) {
              event.preventDefault()
              items[match]?.focus()
            }
          }
        }
      }
    }

    return () => {
      if (!ctx.open.value) return null
      const menuNode = h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            innerRef.value = (el ?? null) as HTMLElement | null
          },
          id: ctx.contentId,
          role: 'menu',
          tabindex: -1,
          'data-iris-dropdown-menu': '',
          'data-state': 'open',
          onKeydown: onKeyDown,
          style: {
            ...floatingStyles.value,
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md)',
            padding: 'var(--iris-padding-sm)',
            boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
            minWidth: '160px',
            outline: 'none',
            zIndex: '1000',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
      if (props.teleport === false) return menuNode
      return h(Teleport, { to: props.teleport as string | HTMLElement }, [menuNode])
    }
  },
})
