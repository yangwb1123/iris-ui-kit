import { defineComponent, h, inject, type VNode } from 'vue'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'
import { MenuContextKey } from './context'

export const IrisMenuTrigger = defineComponent({
  name: 'IrisMenuTrigger',
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(MenuContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisMenuTrigger must be inside an IrisMenu')
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      ctx.setOpen(!ctx.open.value)
    }

    const onKeyDown = (event: KeyboardEvent) => {
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
            console.warn('[iris-ui] IrisMenuTrigger: as-child requires a single child element')
          }
          return null
        }
        const merged = mergeSlotProps(
          { ...triggerProps, ...attrs },
          (root.props ?? {}) as Record<string, unknown>,
        )
        return h(root.type as string, merged, root.children as unknown as VNode[])
      }

      return h('button', { type: 'button', ...attrs, ...triggerProps }, slots.default?.())
    }
  },
})
