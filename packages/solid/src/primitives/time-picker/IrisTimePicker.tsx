import { createMemo, createSignal, mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export type IrisTimePickerFormat = '12h' | '24h'

export interface IrisTimeValue {
  hours: number
  minutes: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export interface IrisTimePickerProps {
  value?: IrisTimeValue | null
  defaultValue?: IrisTimeValue | null
  format?: IrisTimePickerFormat
  minuteStep?: number
  disabled?: boolean
  invalid?: boolean
  onChange?: (value: IrisTimeValue) => void
  id?: string
}

/**
 * Time picker: two numeric "spinner" inputs for hours + minutes.
 * Solid port of the Vue IrisTimePicker.
 */
export function IrisTimePicker(props: IrisTimePickerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: { hours: 0, minutes: 0 } as IrisTimeValue,
      format: '24h' as IrisTimePickerFormat,
      minuteStep: 1,
      disabled: false,
      invalid: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'value',
    'defaultValue',
    'format',
    'minuteStep',
    'disabled',
    'invalid',
    'onChange',
    'id',
  ])

  const { t } = useI18n()

  const [internalValue, setInternalValue] = createSignal<IrisTimeValue>(
    local.defaultValue ?? { hours: 0, minutes: 0 },
  )

  const currentValue = (): IrisTimeValue =>
    local.value !== undefined ? (local.value ?? { hours: 0, minutes: 0 }) : internalValue()

  const meridiem = () => (currentValue().hours >= 12 ? 'PM' : 'AM')
  const display = createMemo(() => {
    if (local.format === '24h') {
      return { h: currentValue().hours, m: currentValue().minutes }
    }
    const h12 = currentValue().hours % 12 === 0 ? 12 : currentValue().hours % 12
    return { h: h12, m: currentValue().minutes }
  })

  const emitNew = (next: IrisTimeValue) => {
    if (local.value === undefined) setInternalValue(next)
    local.onChange?.(next)
  }

  const setHours24 = (h24: number) => {
    emitNew({ hours: clamp(h24, 0, 23), minutes: currentValue().minutes })
  }
  const setMinutes = (m: number) => {
    emitNew({
      hours: currentValue().hours,
      minutes: clamp(Math.round(m / local.minuteStep) * local.minuteStep, 0, 59),
    })
  }
  const toggleMeridiem = () => {
    const isPM = meridiem() === 'PM'
    const h12 = currentValue().hours % 12
    const newH24 = isPM ? h12 : h12 + 12
    emitNew({ hours: newH24, minutes: currentValue().minutes })
  }

  const onHoursInput = (e: Event) => {
    const v = parseInt((e.target as HTMLInputElement).value || '0', 10)
    if (Number.isNaN(v)) return
    if (local.format === '12h') {
      const h12 = clamp(v, 1, 12)
      const isPM = meridiem() === 'PM'
      setHours24(isPM ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12)
    } else {
      setHours24(clamp(v, 0, 23))
    }
  }
  const onMinutesInput = (e: Event) => {
    const v = parseInt((e.target as HTMLInputElement).value || '0', 10)
    if (!Number.isNaN(v)) setMinutes(v)
  }

  // Arrow-key stepping with format-aware wrap (matches React/Vue).
  const stepHours = (delta: number) => {
    const max = local.format === '12h' ? 12 : 23
    const min = local.format === '12h' ? 1 : 0
    let next = display().h + delta
    if (next < min) next = max
    if (next > max) next = min
    if (local.format === '12h') {
      const wrap = next === 12 ? 0 : next
      setHours24(meridiem() === 'PM' ? wrap + 12 : wrap)
    } else {
      setHours24(next)
    }
  }
  const stepMinutes = (delta: number) => {
    let next = currentValue().minutes + delta * local.minuteStep
    if (next < 0) next = 60 - local.minuteStep
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

  const inputStyle: JSX.CSSProperties = {
    width: '48px',
    padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
    'text-align': 'center',
    background: 'var(--iris-surface)',
    border: `1px solid ${local.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
    'border-radius': 'var(--iris-radius-sm, 4px)',
    color: 'var(--iris-foreground)',
    'font-size': 'var(--iris-font-size-md, 14px)',
    'font-family': 'inherit',
  }

  return (
    <div
      data-iris-time-picker=""
      data-disabled={local.disabled ? '' : undefined}
      style={{ display: 'inline-flex', 'align-items': 'center', gap: '4px' }}
    >
      <input
        id={local.id}
        type="number"
        data-iris-time-picker-hours=""
        min={local.format === '12h' ? 1 : 0}
        max={local.format === '12h' ? 12 : 23}
        value={pad2(display().h)}
        disabled={local.disabled || undefined}
        aria-label={t('timePicker.hours')}
        onInput={onHoursInput}
        onKeyDown={onHoursKey}
        style={inputStyle}
      />
      <span style={{ color: 'var(--iris-foreground)', 'font-weight': '600' }}>:</span>
      <input
        type="number"
        data-iris-time-picker-minutes=""
        min={0}
        max={59}
        step={local.minuteStep}
        value={pad2(display().m)}
        disabled={local.disabled || undefined}
        aria-label={t('timePicker.minutes')}
        onInput={onMinutesInput}
        onKeyDown={onMinutesKey}
        style={inputStyle}
      />
      <Show when={local.format === '12h'}>
        <button
          type="button"
          data-iris-time-picker-meridiem=""
          aria-label={t('timePicker.togglePeriod')}
          disabled={local.disabled || undefined}
          onClick={toggleMeridiem}
          style={{
            padding: '4px 8px',
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-sm, 4px)',
            color: 'var(--iris-foreground)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
            cursor: local.disabled ? 'not-allowed' : 'pointer',
            'font-family': 'inherit',
          }}
        >
          {meridiem()}
        </button>
      </Show>
    </div>
  )
}
