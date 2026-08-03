import { defineComponent, h, inject, type VNode } from 'vue'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'
import { PopoverContextKey } from './context'

function resolveTriggerElement(value: unknown): HTMLElement | null {
  const candidate =
    value !== null && typeof value === 'object' && '$el' in value
      ? (value as { $el?: unknown }).$el
      : value

  return typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement ? candidate : null
}

/**
 * The element the user interacts with to toggle the Popover. Defaults to a
 * `<button type="button">`; pass `as-child` to attach behavior to any
 * existing element (e.g. `<IrisButton>` or `<RouterLink>`).
 *
 * Wires a11y attributes:
 *   - `aria-haspopup="dialog"`
 *   - `aria-expanded="true|false"` driven by the open state
 *   - `aria-controls` pointing at the content's id
 *
 * Clicking it sends `TOGGLE` to the Popover's state machine.
 */
export const IrisPopoverTrigger = defineComponent({
  name: 'IrisPopoverTrigger',
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(PopoverContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisPopoverTrigger must be a descendant of IrisPopover')
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      ctx.setOpen(!ctx.open.value)
    }

    const captureRef = (el: unknown) => {
      // A ref attached to an `asChild` Vue component resolves to its public
      // component instance, not to the component's root DOM node. Floating
      // positioning, outside-dismiss, and focus restoration all require the
      // actual HTMLElement, which Vue exposes as `$el` on that instance.
      ctx.triggerRef.value = resolveTriggerElement(el)
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
            console.warn('[iris-ui] IrisPopoverTrigger: as-child requires a single child element')
          }
          return null
        }
        const childProps = (root.props ?? {}) as Record<string, unknown>
        // Compose: parent attrs + our trigger props + child's existing props.
        const parentSide = mergeSlotProps(attrs as Record<string, unknown>, triggerProps)
        const merged = mergeSlotProps(parentSide, childProps)
        return h(root.type as string, merged, root.children as unknown as VNode[])
      }

      return h(
        'button',
        {
          type: 'button',
          ...attrs,
          ...triggerProps,
        },
        slots.default?.(),
      )
    }
  },
})
