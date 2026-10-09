import { computed, defineComponent, h, ref, type PropType } from 'vue'
import type { Size } from '@iris-ui-kit/core'
import { useComponentSize } from '../../provider'
import { splitControlAttrs } from '../../internal/control-attrs'

export type IrisInputSize = Size
export type IrisInputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url'

const SIZE_MAP: Record<IrisInputSize, { padding: string; fontSize: string; minHeight: string }> = {
  sm: {
    padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: 'var(--iris-control-height-sm, 28px)',
  },
  md: {
    padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: 'var(--iris-control-height-md, 34px)',
  },
  lg: {
    padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: 'var(--iris-control-height-lg, 40px)',
  },
}

/** CSS width value — numbers are px, strings pass through as authored. */
function cssWidth(width: string | number): string {
  return typeof width === 'number' ? `${width}px` : width
}

/**
 * Text input primitive. Wraps a native `<input>` with token-driven styling
 * plus optional `prefix` / `suffix` slots for icons or text adornments. The
 * value is two-way bound via `v-model`.
 *
 * Focus styling is handled with `:focus-within` on the wrapping `<label>`,
 * which doubles as the click target so the entire pill is clickable.
 *
 * `size` falls back to the nearest `<IrisProvider componentSize>`.
 */
export const IrisInput = defineComponent({
  name: 'IrisInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: '' },
    type: { type: String as PropType<IrisInputType>, default: 'text' },
    /** Omit to inherit the nearest <IrisProvider componentSize> (`md` default). */
    size: { type: String as PropType<IrisInputSize>, default: undefined },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    /** Visual error state — does NOT enforce validation. */
    invalid: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the inner <input>. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
    /** Host width — any CSS length, or a number of px. */
    width: { type: [String, Number] as PropType<string | number>, default: undefined },
    /** Stretch the host to its container (`width: 100%`). */
    fullWidth: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    focus: (_event: FocusEvent) => true,
    blur: (_event: FocusEvent) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const focused = ref(false)
    const size = useComponentSize(() => props.size)

    const sizeStyles = computed<Record<string, string>>(() => SIZE_MAP[size.value])

    const wrapperStyle = computed<Record<string, string>>(() => {
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'
      const boxShadow = focused.value
        ? `0 0 0 3px ${props.invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
        : 'none'
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--iris-gap-sm)',
        ...(props.fullWidth || props.width !== undefined ? { boxSizing: 'border-box' } : null),
        background: props.readonly ? 'var(--iris-surface)' : 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--iris-radius-md)',
        cursor: props.disabled ? 'not-allowed' : props.readonly ? 'default' : 'text',
        opacity: props.disabled ? '0.6' : '1',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        boxShadow,
        ...sizeStyles.value,
        padding: sizeStyles.value.padding,
        minHeight: sizeStyles.value.minHeight,
        ...(props.fullWidth ? { width: '100%' } : null),
        ...(props.width !== undefined ? { width: cssWidth(props.width) } : null),
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
      const { aria, host } = splitControlAttrs(attrs)
      return h(
        'label',
        {
          ...host,
          'data-iris-input': '',
          'data-iris-input-size': size.value,
          'data-state': props.invalid
            ? 'invalid'
            : focused.value
              ? 'focused'
              : props.readonly
                ? 'readonly'
                : 'idle',
          style: {
            ...wrapperStyle.value,
            ...((host.style as Record<string, string> | undefined) ?? {}),
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
            ...aria,
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
