import { defineComponent, h, inject, type VNode } from 'vue'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'
import { DrawerContextKey } from './context'

/** Trigger button that opens the Drawer. Supports `as-child` polymorphism. */
export const IrisDrawerTrigger = defineComponent({
  name: 'IrisDrawerTrigger',
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DrawerContextKey)
    if (!ctx) {
      throw new Error('IrisDrawerTrigger must be used inside <IrisDrawer>')
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      ctx.setOpen(!ctx.open.value)
    }

    return () => {
      const baseProps: Record<string, unknown> = {
        type: 'button',
        'aria-haspopup': 'dialog',
        'aria-expanded': ctx.open.value,
        'aria-controls': ctx.contentId,
        'data-iris-drawer-trigger': '',
        'data-state': ctx.open.value ? 'open' : 'closed',
        ref: (el: unknown) => {
          ctx.triggerRef.value = (el ?? null) as HTMLElement | null
        },
        onClick,
        ...attrs,
      }

      if (props.asChild) {
        const child = findFirstElement(slots.default?.()) as VNode | null
        if (!child) return null
        const merged = mergeSlotProps(baseProps, (child.props ?? {}) as Record<string, unknown>)
        return h(child.type as never, merged, child.children as never)
      }

      return h('button', baseProps, slots.default?.())
    }
  },
})
