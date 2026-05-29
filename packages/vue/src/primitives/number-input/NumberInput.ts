import { computed, defineComponent, h, ref, type PropType } from 'vue'
import type { Size } from '@iris-ui/core'

export type IrisNumberInputSize = Size

function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0
  const s = step.toString()
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundToStep(value: number, step: number): number {
  const places = decimalsOf(step)
  return Number(value.toFixed(places))
}

/**
 * Numeric input with step buttons + min/max/step clamping + keyboard ↑/↓
 * controls. Emits `null` for invalid / empty input so consumers can apply
 * their own validation logic.
 */
export const IrisNumberInput = defineComponent({
  name: 'IrisNumberInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number as PropType<number | null>, default: null },
    size: { type: String as PropType<IrisNumberInputSize>, default: 'md' },
    min: { type: Number, default: -Infinity },
    max: { type: Number, default: Infinity },
    step: { type: Number, default: 1 },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    /** Show the +/- step buttons. */
    showControls: { type: Boolean, default: true },
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the inner <input>. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: number | null) => true,
    focus: (_event: FocusEvent) => true,
    blur: (_event: FocusEvent) => true,
  },
  setup(props, { attrs, emit }) {
    const focused = ref(false)
    const rawText = ref<string>(
      props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue),
    )

    const startValue = computed(() => {
      if (Number.isFinite(props.min) && props.min !== -Infinity) return props.min
      return 0
    })

    const setValue = (next: number | null) => {
      if (next === null) {
        rawText.value = ''
        emit('update:modelValue', null)
        return
      }
      const clamped = clamp(next, props.min, props.max)
      const rounded = roundToStep(clamped, props.step)
      rawText.value = String(rounded)
      emit('update:modelValue', rounded)
    }

    const increment = (factor: 1 | -1) => {
      if (props.disabled || props.readonly) return
      const base =
        props.modelValue === null || props.modelValue === undefined
          ? startValue.value
          : props.modelValue
      setValue(base + factor * props.step)
    }

    const onInput = (event: Event) => {
      const text = (event.target as HTMLInputElement).value
      rawText.value = text
      if (text === '' || text === '-') {
        emit('update:modelValue', null)
        return
      }
      const parsed = Number(text)
      if (Number.isNaN(parsed)) {
        emit('update:modelValue', null)
        return
      }
      // Don't clamp/round mid-typing — user might be entering "1." or "0.0001".
      emit('update:modelValue', parsed)
    }

    const onBlur = (event: FocusEvent) => {
      focused.value = false
      // On blur, normalize: clamp + round.
      if (props.modelValue !== null && props.modelValue !== undefined) {
        const clamped = clamp(props.modelValue, props.min, props.max)
        const rounded = roundToStep(clamped, props.step)
        if (rounded !== props.modelValue) {
          rawText.value = String(rounded)
          emit('update:modelValue', rounded)
        } else {
          rawText.value = String(rounded)
        }
      }
      emit('blur', event)
    }
    const onFocus = (event: FocusEvent) => {
      focused.value = true
      emit('focus', event)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        increment(1)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        increment(-1)
      }
    }

    const sizeStyles = computed<{ padding: string; fontSize: string; minHeight: string }>(() => {
      const map: Record<
        IrisNumberInputSize,
        { padding: string; fontSize: string; minHeight: string }
      > = {
        sm: { padding: '4px var(--iris-padding-sm)', fontSize: '12px', minHeight: '28px' },
        md: { padding: '6px var(--iris-padding-md)', fontSize: '14px', minHeight: '34px' },
        lg: { padding: '8px var(--iris-padding-md)', fontSize: '16px', minHeight: '40px' },
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
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--iris-radius-md)',
        opacity: props.disabled ? '0.6' : '1',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        boxShadow,
        padding: sizeStyles.value.padding,
        minHeight: sizeStyles.value.minHeight,
        fontSize: sizeStyles.value.fontSize,
      }
    })

    const inputStyle: Record<string, string> = {
      flex: '1',
      minWidth: '40px',
      width: '4ch',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'inherit',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      padding: '0',
      textAlign: 'end',
    }

    const controlBtnStyle: Record<string, string> = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      background: 'transparent',
      border: 'none',
      borderRadius: 'var(--iris-radius-sm, 4px)',
      cursor: 'pointer',
      color: 'var(--iris-muted)',
      lineHeight: '1',
      flexShrink: '0',
    }

    return () => {
      const atMin =
        props.modelValue !== null && props.modelValue !== undefined && props.modelValue <= props.min
      const atMax =
        props.modelValue !== null && props.modelValue !== undefined && props.modelValue >= props.max
      return h(
        'div',
        {
          ...attrs,
          'data-iris-number-input': '',
          'data-iris-number-input-size': props.size,
          'data-state': props.invalid ? 'invalid' : focused.value ? 'focused' : 'idle',
          style: {
            ...wrapperStyle.value,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          props.showControls
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-number-input-dec': '',
                  'aria-label': 'Decrement',
                  disabled: props.disabled || atMin || undefined,
                  onClick: () => increment(-1),
                  style: { ...controlBtnStyle, marginInlineEnd: '4px' },
                },
                '−',
              )
            : null,
          h('input', {
            id: props.id,
            type: 'text',
            inputmode: 'decimal',
            role: 'spinbutton',
            value: rawText.value,
            placeholder: props.placeholder,
            disabled: props.disabled || undefined,
            readonly: props.readonly || undefined,
            'aria-invalid': props.invalid ? 'true' : undefined,
            'aria-describedby': props.ariaDescribedby,
            'aria-valuenow':
              props.modelValue === null || props.modelValue === undefined
                ? undefined
                : props.modelValue,
            'aria-valuemin': Number.isFinite(props.min) ? props.min : undefined,
            'aria-valuemax': Number.isFinite(props.max) ? props.max : undefined,
            style: inputStyle,
            onInput,
            onFocus,
            onBlur,
            onKeydown: onKeyDown,
          }),
          props.showControls
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-number-input-inc': '',
                  'aria-label': 'Increment',
                  disabled: props.disabled || atMax || undefined,
                  onClick: () => increment(1),
                  style: { ...controlBtnStyle, marginInlineStart: '4px' },
                },
                '+',
              )
            : null,
        ],
      )
    }
  },
})
