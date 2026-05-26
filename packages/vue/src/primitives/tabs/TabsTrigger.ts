import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, type VNode } from 'vue'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'
import { TabsContextKey } from './context'

/**
 * A single tab button. Registers with the parent `IrisTabs` so arrow keys
 * can navigate among triggers in registration order. Sets `aria-selected`
 * and `aria-controls` for screen readers; uses roving tabindex.
 *
 * `as-child` is supported to render any element (e.g. `<RouterLink>`) as the
 * trigger while keeping the a11y wiring.
 */
export const IrisTabsTrigger = defineComponent({
  name: 'IrisTabsTrigger',
  inheritAttrs: false,
  props: {
    value: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(TabsContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisTabsTrigger must be inside an IrisTabs')
    }

    const isDisabled = computed(() => props.disabled || ctx.disabled.value)
    const isActive = computed(() => ctx.value.value === props.value)

    onMounted(() => ctx.registerTrigger(props.value, () => isDisabled.value))
    onBeforeUnmount(() => ctx.unregisterTrigger(props.value))

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (isDisabled.value) return
      ctx.setValue(props.value)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const horizontal = ctx.orientation.value === 'horizontal'
      switch (event.key) {
        case horizontal ? 'ArrowRight' : 'ArrowDown':
          event.preventDefault()
          ctx.moveFocus(props.value, 1)
          break
        case horizontal ? 'ArrowLeft' : 'ArrowUp':
          event.preventDefault()
          ctx.moveFocus(props.value, -1)
          break
        case 'Home':
          event.preventDefault()
          ctx.moveFocus(props.value, 'home')
          break
        case 'End':
          event.preventDefault()
          ctx.moveFocus(props.value, 'end')
          break
      }
    }

    return () => {
      const triggerProps: Record<string, unknown> = {
        role: 'tab',
        'aria-selected': isActive.value ? 'true' : 'false',
        'aria-controls': `iris-tabs-content-${props.value}`,
        id: `iris-tabs-trigger-${props.value}`,
        tabindex: isActive.value ? 0 : -1,
        'data-iris-tabs-trigger': '',
        'data-value': props.value,
        'data-state': isActive.value ? 'active' : 'inactive',
        'data-orientation': ctx.orientation.value,
        'data-disabled': isDisabled.value ? '' : undefined,
        disabled: isDisabled.value ? true : undefined,
        onClick,
        onKeydown: onKeyDown,
      }

      if (props.asChild) {
        const root = findFirstElement(slots.default?.())
        if (!root) {
          if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
            console.warn('[iris-ui] IrisTabsTrigger: as-child requires a single child element')
          }
          return null
        }
        const merged = mergeSlotProps(
          { ...triggerProps, ...attrs },
          (root.props ?? {}) as Record<string, unknown>,
        )
        return h(root.type as string, merged, root.children as unknown as VNode[])
      }

      const colors = isActive.value
        ? { background: 'transparent', color: 'var(--iris-primary)' }
        : { background: 'transparent', color: 'var(--iris-muted)' }
      const borderActive = ctx.orientation.value === 'horizontal'
        ? { borderBottom: `2px solid ${isActive.value ? 'var(--iris-primary)' : 'transparent'}` }
        : { borderRight: `2px solid ${isActive.value ? 'var(--iris-primary)' : 'transparent'}` }
      return h(
        'button',
        {
          type: 'button',
          ...attrs,
          ...triggerProps,
          style: {
            padding: '8px var(--iris-padding-md)',
            fontSize: '14px',
            fontWeight: '500',
            fontFamily: 'inherit',
            cursor: isDisabled.value ? 'not-allowed' : 'pointer',
            opacity: isDisabled.value ? '0.5' : '1',
            border: 'none',
            outline: 'none',
            marginBottom: ctx.orientation.value === 'horizontal' ? '-1px' : undefined,
            marginRight: ctx.orientation.value === 'vertical' ? '-1px' : undefined,
            transition: 'color 120ms ease, border-color 120ms ease',
            ...colors,
            ...borderActive,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
    }
  },
})
