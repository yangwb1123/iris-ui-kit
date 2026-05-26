import {
  Teleport,
  defineComponent,
  h,
  inject,
  nextTick,
  ref,
  watch,
  type PropType,
} from 'vue'
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

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ctx.open.value) return
      const items = Array.from(
        innerRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
      )
      if (items.length === 0) return
      const current = document.activeElement as HTMLElement | null
      const index = current ? items.indexOf(current) : -1
      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          const next = index < 0 ? 0 : (index + 1) % items.length
          items[next]?.focus()
          break
        }
        case 'ArrowUp': {
          event.preventDefault()
          const next = index <= 0 ? items.length - 1 : index - 1
          items[next]?.focus()
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
            boxShadow:
              '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
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
