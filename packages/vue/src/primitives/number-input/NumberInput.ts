import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'
import { resolveGrowableControlHeight, type Size } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useComponentSize } from '../../provider'
import { splitControlAttrs } from '../../internal/control-attrs'

export type IrisNumberInputSize = Size

const SIZE_MAP: Record<
  IrisNumberInputSize,
  { padding: string; paddingInline: string; fontSize: string; minHeight: string }
> = {
  sm: {
    padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm)',
    paddingInline: 'var(--iris-padding-sm)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: 'var(--iris-control-height-sm, 28px)',
  },
  md: {
    padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
    paddingInline: 'var(--iris-padding-md)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: 'var(--iris-control-height-md, 34px)',
  },
  lg: {
    padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
    paddingInline: 'var(--iris-padding-md)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: 'var(--iris-control-height-lg, 40px)',
  },
}

/** Width of one stepper button (px). */
const STEPPER_WIDTH = 22
/** Space between a stepper and the text field (px, inline). */
const STEPPER_GAP = 4
/** Space the text field needs on its own for a number (px) — matches 4ch. */
const FIELD_MIN_WIDTH = 40
/** Border width added once per side of the host box (px). */
const BORDER_WIDTH = 1

/** CSS width value — numbers are px, strings pass through as authored. */
function cssWidth(width: string | number): string {
  return typeof width === 'number' ? `${width}px` : width
}

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
 *
 * `size` falls back to the nearest `<IrisProvider componentSize>`.
 */
export const IrisNumberInput = defineComponent({
  name: 'IrisNumberInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number as PropType<number | null>, default: null },
    /** Omit to inherit the nearest <IrisProvider componentSize> (`md` default). */
    size: { type: String as PropType<IrisNumberInputSize>, default: undefined },
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
    /** Host width — any CSS length, or a number of px. */
    width: { type: [String, Number] as PropType<string | number>, default: undefined },
    /** Stretch the host to its container (`width: 100%`). */
    fullWidth: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: number | null) => true,
    focus: (_event: FocusEvent) => true,
    blur: (_event: FocusEvent) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const focused = ref(false)
    const size = useComponentSize(() => props.size)
    const rawText = ref<string>(
      props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue),
    )

    watch(
      () => props.modelValue,
      (next) => {
        rawText.value = next === null || next === undefined ? '' : String(next)
      },
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

    const sizeStyles = computed(() => SIZE_MAP[size.value])

    const wrapperStyle = computed<Record<string, string>>(() => {
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'
      const boxShadow = focused.value
        ? `0 0 0 3px ${props.invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
        : 'none'
      // The host box is the WHOLE control (field + both steppers + gaps +
      // padding + borders), so its minimum intrinsic width covers all of it.
      const contentMinWidth = props.showControls
        ? FIELD_MIN_WIDTH + STEPPER_GAP * 3 + STEPPER_WIDTH * 2
        : FIELD_MIN_WIDTH
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${STEPPER_GAP}px`,
        boxSizing: 'border-box',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--iris-radius-md)',
        opacity: props.disabled ? '0.6' : '1',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        boxShadow,
        padding: sizeStyles.value.padding,
        minHeight: sizeStyles.value.minHeight,
        minWidth: `calc(${contentMinWidth}px + 2 * ${sizeStyles.value.paddingInline} + ${
          BORDER_WIDTH * 2
        }px)`,
        fontSize: sizeStyles.value.fontSize,
        ...(props.fullWidth ? { width: '100%' } : null),
        ...(props.width !== undefined ? { width: cssWidth(props.width) } : null),
      }
    })

    const inputStyle: Record<string, string> = {
      flex: '1',
      minWidth: `${FIELD_MIN_WIDTH}px`,
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
      width: `${STEPPER_WIDTH}px`,
      ...resolveGrowableControlHeight(STEPPER_WIDTH),
      background: 'transparent',
      border: 'none',
      borderRadius: 'var(--iris-radius-sm, 4px)',
      cursor: 'pointer',
      color: 'var(--iris-muted)',
      flexShrink: '0',
    }

    return () => {
      const atMin =
        props.modelValue !== null && props.modelValue !== undefined && props.modelValue <= props.min
      const atMax =
        props.modelValue !== null && props.modelValue !== undefined && props.modelValue >= props.max
      const { aria, host } = splitControlAttrs(attrs)
      return h(
        'div',
        {
          ...host,
          'data-iris-number-input': '',
          'data-iris-number-input-size': size.value,
          'data-state': props.invalid ? 'invalid' : focused.value ? 'focused' : 'idle',
          style: {
            ...wrapperStyle.value,
            ...((host.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          props.showControls
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-number-input-dec': '',
                  'aria-label': t('numberInput.decrement'),
                  disabled: props.disabled || atMin || undefined,
                  onClick: () => increment(-1),
                  style: controlBtnStyle,
                },
                '−',
              )
            : null,
          h('input', {
            ...aria,
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
                  'aria-label': t('numberInput.increment'),
                  disabled: props.disabled || atMax || undefined,
                  onClick: () => increment(1),
                  style: controlBtnStyle,
                },
                '+',
              )
            : null,
        ],
      )
    }
  },
})
