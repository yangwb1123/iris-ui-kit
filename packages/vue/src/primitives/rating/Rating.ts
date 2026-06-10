import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { useI18n } from '../../i18n'

export type IrisRatingSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<IrisRatingSize, number> = { sm: 16, md: 22, lg: 28 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Snap to the nearest allowed step (1, or 0.5 when half is enabled). */
function snap(value: number, step: number): number {
  return Math.round(value / step) * step
}

/**
 * Star rating with optional half-star precision, hover preview, keyboard
 * support, and a `readonly` display mode. Uses the `slider` ARIA pattern
 * (`aria-valuemin/now/max` + arrow keys); stars are decorative. RTL-safe via
 * logical fill clipping.
 */
export const IrisRating = defineComponent({
  name: 'IrisRating',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number, default: 0 },
    /** Number of stars. */
    max: { type: Number, default: 5 },
    /** Allow half-star precision. */
    allowHalf: { type: Boolean, default: false },
    /** Display-only — no interaction. */
    readonly: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    /** Clicking the current value again resets to 0. */
    clearable: { type: Boolean, default: true },
    size: { type: String as PropType<IrisRatingSize>, default: 'md' },
    invalid: { type: Boolean, default: false },
    /** Accessible label for the slider. */
    label: { type: String, default: undefined },
    /** id forwarded to the slider. Set by IrisFormField. */
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby`. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: number) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const hover = ref<number | null>(null)

    const step = computed(() => (props.allowHalf ? 0.5 : 1))
    const value = computed(() => clamp(props.modelValue ?? 0, 0, props.max))
    const interactive = computed(() => !props.readonly && !props.disabled)
    const display = computed(() => hover.value ?? value.value)

    const setValue = (next: number) => {
      const v = clamp(snap(next, step.value), 0, props.max)
      if (v === value.value) return
      emit('update:modelValue', v)
    }

    const valueAt = (i: number, event: MouseEvent): number => {
      if (!props.allowHalf) return i + 1
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const past = event.clientX - rect.left
      return past < rect.width / 2 ? i + 0.5 : i + 1
    }

    const onClick = (i: number, event: MouseEvent) => {
      if (!interactive.value) return
      let next = valueAt(i, event)
      if (props.clearable && next === value.value) next = 0
      setValue(next)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!interactive.value) return
      let next = value.value
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = value.value + step.value
          break
        case 'ArrowLeft':
        case 'ArrowDown':
          next = value.value - step.value
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = props.max
          break
        default:
          return
      }
      event.preventDefault()
      setValue(next)
    }

    return () => {
      const px = SIZE_MAP[props.size]
      const fillColor = props.invalid ? 'var(--iris-danger)' : 'var(--iris-warning, #f59e0b)'
      return h(
        'div',
        {
          ...attrs,
          'data-iris-rating': '',
          'data-iris-rating-size': props.size,
          'data-state': props.invalid ? 'invalid' : 'idle',
          role: 'slider',
          id: props.id,
          tabindex: interactive.value ? 0 : -1,
          'aria-label': props.label ?? t('rating.label'),
          'aria-valuemin': 0,
          'aria-valuemax': props.max,
          'aria-valuenow': value.value,
          'aria-valuetext': t('rating.value', { value: value.value, max: props.max }),
          'aria-readonly': props.readonly ? 'true' : undefined,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'aria-invalid': props.invalid ? 'true' : undefined,
          'aria-describedby': props.ariaDescribedby,
          onKeydown: onKeyDown,
          onMouseleave: () => {
            hover.value = null
          },
          style: {
            display: 'inline-flex',
            gap: `${Math.round(px * 0.18)}px`,
            lineHeight: '1',
            color: 'var(--iris-border)',
            cursor: interactive.value ? 'pointer' : 'default',
            opacity: props.disabled ? '0.6' : '1',
            outline: 'none',
            direction: 'inherit',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        Array.from({ length: props.max }, (_unused, i) => {
          const fill = clamp(display.value - i, 0, 1) * 100
          return h(
            'span',
            {
              key: i,
              'data-iris-rating-star': '',
              'data-filled': fill >= 100 ? 'true' : fill > 0 ? 'half' : undefined,
              onClick: (e: MouseEvent) => onClick(i, e),
              onMousemove: interactive.value
                ? (e: MouseEvent) => (hover.value = valueAt(i, e))
                : undefined,
              style: {
                position: 'relative',
                display: 'inline-block',
                width: `${px}px`,
                height: `${px}px`,
                fontSize: `${px}px`,
              },
            },
            [
              h('span', { 'aria-hidden': 'true' }, '★'),
              h(
                'span',
                {
                  'aria-hidden': 'true',
                  style: {
                    position: 'absolute',
                    insetBlockStart: '0',
                    insetInlineStart: '0',
                    overflow: 'hidden',
                    width: `${fill}%`,
                    color: fillColor,
                    whiteSpace: 'nowrap',
                  },
                },
                '★',
              ),
            ],
          )
        }),
      )
    }
  },
})
