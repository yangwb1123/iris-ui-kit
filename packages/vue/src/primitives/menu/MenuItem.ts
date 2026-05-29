import { defineComponent, h, inject, ref } from 'vue'
import { MenuContextKey } from './context'

/**
 * Leaf menu item. Selecting fires `select` and closes the **root** menu
 * (`closeRoot`), so picking from a deeply nested branch collapses the entire
 * tree at once.
 */
export const IrisMenuItem = defineComponent({
  name: 'IrisMenuItem',
  inheritAttrs: false,
  props: {
    disabled: { type: Boolean, default: false },
  },
  emits: {
    select: (_event: Event) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const ctx = inject(MenuContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisMenuItem must be inside an IrisMenuContent')
    }
    const hovered = ref(false)

    const fire = (event: Event) => {
      if (props.disabled) return
      emit('select', event)
      ctx.closeRoot()
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
          'data-iris-menu-item': '',
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
            background:
              hovered.value && !props.disabled ? 'var(--iris-surface-hover)' : 'transparent',
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

/** Visual divider between item groups. */
export const IrisMenuSeparator = defineComponent({
  name: 'IrisMenuSeparator',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () =>
      h('div', {
        ...attrs,
        role: 'separator',
        'data-iris-menu-separator': '',
        style: {
          height: '1px',
          background: 'var(--iris-border)',
          margin: '4px 0',
          ...((attrs.style as Record<string, string> | undefined) ?? {}),
        },
      })
  },
})
