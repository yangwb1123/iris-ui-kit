import { computed, defineComponent, h, type PropType } from 'vue'

export type IrisTimePickerFormat = '12h' | '24h'

export interface IrisTimeValue {
  /** 0–23 (24h internal representation). */
  hours: number
  /** 0–59. */
  minutes: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * Time picker rendered as 2 (or 3 with seconds) numeric "spinner" inputs.
 * Internal value is always 24-hour `{ hours, minutes }`; the AM/PM toggle is
 * presentation-only for `format='12h'`.
 */
export const IrisTimePicker = defineComponent({
  name: 'IrisTimePicker',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: Object as PropType<IrisTimeValue | null>,
      default: () => ({ hours: 0, minutes: 0 }),
    },
    format: { type: String as PropType<IrisTimePickerFormat>, default: '24h' },
    /** Step in minutes for the minute input (1, 5, 10, 15, 30). */
    minuteStep: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    /** id forwarded to the hours input. Set by IrisFormField. */
    id: { type: String, default: undefined },
    /** Forwarded as aria-describedby on the hours input. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: IrisTimeValue) => true,
  },
  setup(props, { attrs, emit }) {
    const value = computed<IrisTimeValue>(() => props.modelValue ?? { hours: 0, minutes: 0 })

    const meridiem = computed<'AM' | 'PM'>(() => (value.value.hours >= 12 ? 'PM' : 'AM'))
    const display = computed(() => {
      if (props.format === '24h') {
        return { h: value.value.hours, m: value.value.minutes }
      }
      const h12 = value.value.hours % 12 === 0 ? 12 : value.value.hours % 12
      return { h: h12, m: value.value.minutes }
    })

    const emitNew = (next: IrisTimeValue) => {
      emit('update:modelValue', next)
    }

    const setHours24 = (h24: number) => {
      emitNew({ hours: clamp(h24, 0, 23), minutes: value.value.minutes })
    }
    const setMinutes = (m: number) => {
      emitNew({
        hours: value.value.hours,
        minutes: clamp(Math.round(m / props.minuteStep) * props.minuteStep, 0, 59),
      })
    }
    const toggleMeridiem = () => {
      const isPM = meridiem.value === 'PM'
      const h12 = value.value.hours % 12
      const newH24 = isPM ? h12 : h12 + 12
      emitNew({ hours: newH24, minutes: value.value.minutes })
    }

    const onHoursInput = (e: Event) => {
      const v = parseInt((e.target as HTMLInputElement).value || '0', 10)
      if (Number.isNaN(v)) return
      if (props.format === '12h') {
        const h12 = clamp(v, 1, 12)
        const wrap = h12 === 12 ? 0 : h12
        const newH24 = meridiem.value === 'PM' ? wrap + 12 : wrap
        setHours24(newH24)
      } else {
        setHours24(v)
      }
    }
    const onMinutesInput = (e: Event) => {
      const v = parseInt((e.target as HTMLInputElement).value || '0', 10)
      if (Number.isNaN(v)) return
      setMinutes(v)
    }

    const stepHours = (delta: number) => {
      const max = props.format === '12h' ? 12 : 23
      const min = props.format === '12h' ? 1 : 0
      let next = display.value.h + delta
      if (next < min) next = max
      if (next > max) next = min
      if (props.format === '12h') {
        const wrap = next === 12 ? 0 : next
        setHours24(meridiem.value === 'PM' ? wrap + 12 : wrap)
      } else {
        setHours24(next)
      }
    }
    const stepMinutes = (delta: number) => {
      let next = value.value.minutes + delta * props.minuteStep
      if (next < 0) next = 60 - props.minuteStep
      if (next >= 60) next = 0
      setMinutes(next)
    }

    const onHoursKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        stepHours(1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        stepHours(-1)
      }
    }
    const onMinutesKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        stepMinutes(1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        stepMinutes(-1)
      }
    }

    const fieldStyle = computed<Record<string, string>>(() => ({
      width: '48px',
      height: '34px',
      padding: '4px 6px',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      border: `1px solid ${props.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
      borderRadius: 'var(--iris-radius-sm, 4px)',
      fontSize: '15px',
      fontFamily: 'inherit',
      textAlign: 'center',
      outline: 'none',
    }))

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-time-picker': '',
          'data-disabled': props.disabled ? 'true' : undefined,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h('input', {
            id: props.id,
            type: 'number',
            inputmode: 'numeric',
            min: props.format === '12h' ? 1 : 0,
            max: props.format === '12h' ? 12 : 23,
            value: pad2(display.value.h),
            disabled: props.disabled || undefined,
            'aria-label': 'Hours',
            'aria-describedby': props.ariaDescribedby,
            'aria-invalid': props.invalid ? 'true' : undefined,
            'data-iris-time-picker-hours': '',
            onInput: onHoursInput,
            onKeydown: onHoursKey,
            style: fieldStyle.value,
          }),
          h(
            'span',
            {
              'aria-hidden': 'true',
              style: { color: 'var(--iris-muted)', fontSize: '15px' },
            },
            ':',
          ),
          h('input', {
            type: 'number',
            inputmode: 'numeric',
            min: 0,
            max: 59,
            step: props.minuteStep,
            value: pad2(display.value.m),
            disabled: props.disabled || undefined,
            'aria-label': 'Minutes',
            'data-iris-time-picker-minutes': '',
            onInput: onMinutesInput,
            onKeydown: onMinutesKey,
            style: fieldStyle.value,
          }),
          props.format === '12h'
            ? h(
                'button',
                {
                  type: 'button',
                  disabled: props.disabled || undefined,
                  'aria-label': 'Toggle AM/PM',
                  'data-iris-time-picker-meridiem': meridiem.value,
                  onClick: toggleMeridiem,
                  style: {
                    height: '34px',
                    padding: '4px 8px',
                    background: 'var(--iris-background)',
                    color: 'var(--iris-foreground)',
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    fontWeight: '600',
                  },
                },
                meridiem.value,
              )
            : null,
        ],
      )
  },
})
