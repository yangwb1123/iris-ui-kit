import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { ToggleGroupContextKey } from './context'

const SIZE_PADDING: Record<'sm' | 'md' | 'lg', string> = {
  sm: '4px 10px',
  md: '6px 14px',
  lg: '8px 18px',
}
const SIZE_FONT: Record<'sm' | 'md' | 'lg', string> = {
  sm: '12px',
  md: '13px',
  lg: '14px',
}

/**
 * One toggle in an {@link IrisToggleGroup}. Self-registers with the parent
 * and renders a `<button>` with the right `role` / `aria-checked` /
 * `aria-pressed` depending on the group's `type`.
 */
export const IrisToggleGroupItem = defineComponent({
  name: 'IrisToggleGroupItem',
  inheritAttrs: false,
  props: {
    value: { type: String, required: true },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(ToggleGroupContextKey)
    if (!ctx) throw new Error('IrisToggleGroupItem must be used inside <IrisToggleGroup>')

    const elRef = ref<HTMLElement | null>(null)

    onMounted(() => ctx.registerItem(props.value, elRef))
    onBeforeUnmount(() => ctx.unregisterItem(props.value))

    const isActive = computed(() => ctx.isActive(props.value))
    const isDisabled = computed(() => props.disabled || ctx.disabled.value)
    const isSingle = computed(() => ctx.type.value === 'single')

    const onClick = () => {
      if (isDisabled.value) return
      ctx.toggle(props.value)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isDisabled.value) return
      switch (event.key) {
        case ' ':
        case 'Enter':
          event.preventDefault()
          ctx.toggle(props.value)
          break
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          ctx.moveFocus(props.value, 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
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
      const active = isActive.value
      const variant = ctx.variant.value
      const size = ctx.size.value
      return h(
        'button',
        {
          ...attrs,
          ref: (el: unknown) => {
            elRef.value = (el ?? null) as HTMLElement | null
          },
          type: 'button',
          role: isSingle.value ? 'radio' : undefined,
          'aria-checked': isSingle.value ? (active ? 'true' : 'false') : undefined,
          'aria-pressed': isSingle.value ? undefined : active ? 'true' : 'false',
          'aria-disabled': isDisabled.value ? 'true' : undefined,
          disabled: isDisabled.value || undefined,
          tabindex: active ? 0 : -1,
          'data-iris-toggle-group-item': '',
          'data-state': active ? 'on' : 'off',
          onClick,
          onKeydown: onKeyDown,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: SIZE_PADDING[size],
            fontSize: SIZE_FONT[size],
            fontFamily: 'inherit',
            fontWeight: '500',
            lineHeight: '1',
            background: active
              ? variant === 'solid'
                ? 'var(--iris-primary)'
                : 'var(--iris-primary)'
              : 'transparent',
            color: active ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
            border: 'none',
            cursor: isDisabled.value ? 'not-allowed' : 'pointer',
            opacity: isDisabled.value ? '0.5' : '1',
            transition: 'background-color 120ms ease, color 120ms ease',
          },
        },
        slots.default?.(),
      )
    }
  },
})
