import { defineComponent, h, inject, type VNode } from 'vue'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'
import { DialogContextKey } from './context'

/** Trigger button that opens the Dialog. Supports `as-child` polymorphism. */
export const IrisDialogTrigger = defineComponent({
  name: 'IrisDialogTrigger',
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DialogContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDialogTrigger must be a descendant of IrisDialog')
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      ctx.setOpen(true)
    }

    const captureRef = (el: unknown) => {
      ctx.triggerRef.value = (el ?? null) as HTMLElement | null
    }

    return () => {
      const triggerProps: Record<string, unknown> = {
        'aria-haspopup': 'dialog',
        'aria-expanded': ctx.open.value ? 'true' : 'false',
        'aria-controls': ctx.contentId,
        'data-state': ctx.open.value ? 'open' : 'closed',
        onClick,
        ref: captureRef,
      }

      if (props.asChild) {
        const root = findFirstElement(slots.default?.())
        if (!root) {
          if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
            console.warn('[iris-ui] IrisDialogTrigger: as-child requires a single child element')
          }
          return null
        }
        const parentSide = mergeSlotProps(attrs as Record<string, unknown>, triggerProps)
        const merged = mergeSlotProps(parentSide, (root.props ?? {}) as Record<string, unknown>)
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
