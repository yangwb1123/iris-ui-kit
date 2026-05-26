import { defineComponent, h, inject, type VNode } from 'vue'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'
import { DropdownContextKey } from './context'

export const IrisDropdownTrigger = defineComponent({
  name: 'IrisDropdownTrigger',
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DropdownContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDropdownTrigger must be a descendant of IrisDropdown')
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      ctx.setOpen(!ctx.open.value)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Pressing ArrowDown / Enter / Space on the trigger opens AND focuses the menu.
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        ctx.setOpen(true)
      }
    }

    const captureRef = (el: unknown) => {
      ctx.triggerRef.value = (el ?? null) as HTMLElement | null
    }

    return () => {
      const triggerProps: Record<string, unknown> = {
        'aria-haspopup': 'menu',
        'aria-expanded': ctx.open.value ? 'true' : 'false',
        'aria-controls': ctx.contentId,
        'data-state': ctx.open.value ? 'open' : 'closed',
        onClick,
        onKeydown: onKeyDown,
        ref: captureRef,
      }

      if (props.asChild) {
        const root = findFirstElement(slots.default?.())
        if (!root) {
          if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
            console.warn('[iris-ui] IrisDropdownTrigger: as-child requires a single child element')
          }
          return null
        }
        const merged = mergeSlotProps(
          { ...triggerProps, ...attrs },
          (root.props ?? {}) as Record<string, unknown>,
        )
        return h(root.type as string, merged, root.children as unknown as VNode[])
      }

      return h(
        'button',
        { type: 'button', ...attrs, ...triggerProps },
        slots.default?.(),
      )
    }
  },
})
