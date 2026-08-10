import { Teleport, defineComponent, h, inject, nextTick, ref, watch, type PropType } from 'vue'
import { nextEnabledIndex } from '@iris-ui-kit/core'
import { useFloating } from '../floating/useFloating'
import { useDismiss } from '../floating/useDismiss'
import { MenuContextKey } from './context'

/**
 * The menu surface. Closes on Escape or outside pointerdown (the dismiss
 * listener excludes both the trigger and the content tree, so nested
 * submenus inside the content do not register as "outside"). Arrow key
 * navigation moves focus among `[role="menuitem"]` descendants — which
 * includes both `IrisMenuItem`s and the trigger of any `IrisMenuSub`.
 */
export const IrisMenuContent = defineComponent({
  name: 'IrisMenuContent',
  inheritAttrs: false,
  props: {
    teleport: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: 'body',
    },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(MenuContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisMenuContent must be inside an IrisMenu')
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

    watch(ctx.open, async (open) => {
      if (open) {
        await nextTick()
        const items = innerRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]')
        items?.[0]?.focus()
      } else {
        ctx.triggerRef.value?.focus?.()
      }
    })

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
          ctx.setOpen(false)
          break
      }
    }

    return () => {
      if (!ctx.open.value) return null
      const node = h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            innerRef.value = (el ?? null) as HTMLElement | null
          },
          id: ctx.contentId,
          role: 'menu',
          tabindex: -1,
          'data-iris-menu': '',
          'data-state': 'open',
          onKeydown: onKeyDown,
          style: {
            ...floatingStyles.value,
            background: 'var(--iris-surface-floating)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md)',
            padding: 'var(--iris-padding-sm)',
            boxShadow: 'var(--iris-shadow-lg)',
            minWidth: '180px',
            outline: 'none',
            zIndex: '1000',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
      if (props.teleport === false) return node
      return h(Teleport, { to: props.teleport as string | HTMLElement }, [node])
    }
  },
})
