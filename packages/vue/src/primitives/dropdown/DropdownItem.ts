import { defineComponent, h, inject, ref } from 'vue'
import { DropdownContextKey } from './context'

/**
 * A single selectable menu item. Emits `select` (with the underlying event)
 * and auto-closes the parent dropdown after selection. Disabled items are
 * skipped by arrow-key navigation in the parent menu.
 */
export const IrisDropdownItem = defineComponent({
  name: 'IrisDropdownItem',
  inheritAttrs: false,
  props: {
    disabled: { type: Boolean, default: false },
    /** When true, selecting does NOT close the dropdown. Useful for sub-actions. */
    keepOpen: { type: Boolean, default: false },
  },
  emits: {
    select: (_event: Event) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const ctx = inject(DropdownContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDropdownItem must be a descendant of IrisDropdownMenu')
    }

    const hovered = ref(false)

    const fire = (event: Event) => {
      if (props.disabled) return
      emit('select', event)
      if (!props.keepOpen) ctx.setOpen(false)
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      fire(event)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        fire(event)
      }
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          role: 'menuitem',
          tabindex: props.disabled ? -1 : 0,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'data-iris-dropdown-item': '',
          'data-disabled': props.disabled ? '' : undefined,
          onClick,
          onKeydown: onKeyDown,
          onPointerenter: () => (hovered.value = true),
          onPointerleave: () => (hovered.value = false),
          onFocus: () => (hovered.value = true),
          onBlur: () => (hovered.value = false),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-gap-sm)',
            padding: '6px var(--iris-padding-md)',
            borderRadius: 'var(--iris-radius-sm)',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            opacity: props.disabled ? '0.5' : '1',
            background: hovered.value && !props.disabled ? 'var(--iris-surface-hover)' : 'transparent',
            color: 'inherit',
            outline: 'none',
            fontSize: '14px',
            transition: 'background-color 80ms ease',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

/** Visual divider between groups of items. */
export const IrisDropdownSeparator = defineComponent({
  name: 'IrisDropdownSeparator',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () =>
      h('div', {
        ...attrs,
        role: 'separator',
        'data-iris-dropdown-separator': '',
        style: {
          height: '1px',
          background: 'var(--iris-border)',
          margin: '4px 0',
          ...((attrs.style as Record<string, string> | undefined) ?? {}),
        },
      })
  },
})
