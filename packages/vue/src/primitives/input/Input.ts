import { computed, defineComponent, h, ref, type PropType } from 'vue'
import type { Size } from '@iris-ui-kit/core'

export type IrisInputSize = Size
export type IrisInputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url'

/**
 * Text input primitive. Wraps a native `<input>` with token-driven styling
 * plus optional `prefix` / `suffix` slots for icons or text adornments. The
 * value is two-way bound via `v-model`.
 *
 * Focus styling is handled with `:focus-within` on the wrapping `<label>`,
 * which doubles as the click target so the entire pill is clickable.
 */
export const IrisInput = defineComponent({
  name: 'IrisInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: '' },
    type: { type: String as PropType<IrisInputType>, default: 'text' },
    size: { type: String as PropType<IrisInputSize>, default: 'md' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    /** Visual error state — does NOT enforce validation. */
    invalid: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the inner <input>. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    focus: (_event: FocusEvent) => true,
    blur: (_event: FocusEvent) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const focused = ref(false)

    const sizeStyles = computed<Record<string, string>>(() => {
      const map: Record<IrisInputSize, { padding: string; fontSize: string; minHeight: string }> = {
        sm: {
          padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm)',
          fontSize: 'var(--iris-font-size-xs, 12px)',
          minHeight: '28px',
        },
        md: {
          padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          minHeight: '34px',
        },
        lg: {
          padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
          fontSize: 'var(--iris-font-size-lg, 16px)',
          minHeight: '40px',
        },
      }
      return map[props.size]
    })

    const wrapperStyle = computed<Record<string, string>>(() => {
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'
      const boxShadow = focused.value
        ? `0 0 0 3px ${props.invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
        : 'none'
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--iris-gap-sm)',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--iris-radius-md)',
        cursor: props.disabled ? 'not-allowed' : 'text',
        opacity: props.disabled ? '0.6' : '1',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        boxShadow,
        ...sizeStyles.value,
        padding: sizeStyles.value.padding,
        minHeight: sizeStyles.value.minHeight,
      }
    })

    const inputStyle: Record<string, string> = {
      flex: '1',
      minWidth: '0',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'inherit',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      padding: '0',
    }

    const onInput = (event: Event) => {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }
    const onFocus = (event: FocusEvent) => {
      focused.value = true
      emit('focus', event)
    }
    const onBlur = (event: FocusEvent) => {
      focused.value = false
      emit('blur', event)
    }

    return () => {
      const prefix = slots.prefix?.()
      const suffix = slots.suffix?.()
      return h(
        'label',
        {
          ...attrs,
          'data-iris-input': '',
          'data-iris-input-size': props.size,
          'data-state': props.invalid ? 'invalid' : focused.value ? 'focused' : 'idle',
          style: {
            ...wrapperStyle.value,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          prefix &&
            h(
              'span',
              {
                'data-iris-input-prefix': '',
                style: { display: 'inline-flex', alignItems: 'center', color: 'var(--iris-muted)' },
              },
              prefix,
            ),
          h('input', {
            id: props.id,
            type: props.type,
            value: props.modelValue,
            placeholder: props.placeholder,
            disabled: props.disabled || undefined,
            readonly: props.readonly || undefined,
            'aria-invalid': props.invalid ? 'true' : undefined,
            'aria-describedby': props.ariaDescribedby,
            style: inputStyle,
            onInput,
            onFocus,
            onBlur,
          }),
          suffix &&
            h(
              'span',
              {
                'data-iris-input-suffix': '',
                style: { display: 'inline-flex', alignItems: 'center', color: 'var(--iris-muted)' },
              },
              suffix,
            ),
        ],
      )
    }
  },
})
