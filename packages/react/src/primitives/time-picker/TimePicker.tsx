import * as React from 'react'
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
  defaultValue?: IrisTimeValue
  onValueChange?: (value: IrisTimeValue) => void
  format?: IrisTimePickerFormat
  /** Step in minutes for the minute input (1, 5, 10, 15, 30). */
  minuteStep?: number
  disabled?: boolean
  invalid?: boolean
  /** id forwarded to the hours input. Set by `IrisFormField`. */
  id?: string
  /** Forwarded as `aria-describedby` on the hours input. Set by `IrisFormField`. */
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Time picker rendered as two zero-padded number inputs (hours + minutes)
 * plus an optional AM/PM toggle for 12h format. Internal value is always
 * 24-hour `{ hours, minutes }`.
 */
export function IrisTimePicker({
  value: valueProp,
  defaultValue = { hours: 0, minutes: 0 },
  onValueChange,
  format = '24h',
  minuteStep = 1,
  disabled = false,
  invalid = false,
  id,
  ariaDescribedby,
  style,
  className,
  ...rest
}: IrisTimePickerProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<IrisTimeValue>(defaultValue)
  const value = isControlled ? (valueProp ?? defaultValue) : internal

  const setValue = (next: IrisTimeValue) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const meridiem = value.hours >= 12 ? 'PM' : 'AM'
  const displayH = format === '24h' ? value.hours : value.hours % 12 === 0 ? 12 : value.hours % 12

  const setHours24 = (h24: number) => {
    setValue({ hours: clamp(h24, 0, 23), minutes: value.minutes })
  }
  const setMinutes = (m: number) => {
    setValue({
      hours: value.hours,
      minutes: clamp(Math.round(m / minuteStep) * minuteStep, 0, 59),
    })
  }
  const toggleMeridiem = () => {
    const h12 = value.hours % 12
    const newH24 = meridiem === 'PM' ? h12 : h12 + 12
    setValue({ hours: newH24, minutes: value.minutes })
  }

  const onHoursInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value || '0', 10)
    if (Number.isNaN(v)) return
    if (format === '12h') {
      const h12 = clamp(v, 1, 12)
      const wrap = h12 === 12 ? 0 : h12
      const newH24 = meridiem === 'PM' ? wrap + 12 : wrap
      setHours24(newH24)
    } else {
      setHours24(v)
    }
  }
  const onMinutesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value || '0', 10)
    if (Number.isNaN(v)) return
    setMinutes(v)
  }

  const stepHours = (delta: number) => {
    const max = format === '12h' ? 12 : 23
    const min = format === '12h' ? 1 : 0
    let next = displayH + delta
    if (next < min) next = max
    if (next > max) next = min
    if (format === '12h') {
      const wrap = next === 12 ? 0 : next
      setHours24(meridiem === 'PM' ? wrap + 12 : wrap)
    } else {
      setHours24(next)
    }
  }
  const stepMinutes = (delta: number) => {
    let next = value.minutes + delta * minuteStep
    if (next < 0) next = 60 - minuteStep
    if (next >= 60) next = 0
    setMinutes(next)
  }

  const onHoursKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      stepHours(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      stepHours(-1)
    }
  }
  const onMinutesKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      stepMinutes(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      stepMinutes(-1)
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: 48,
    height: 34,
    padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
    borderRadius: 'var(--iris-radius-sm, 4px)',
    fontSize: 'var(--iris-font-size-base, 15px)',
    fontFamily: 'inherit',
    textAlign: 'center',
    outline: 'none',
  }

  return (
    <div
      data-iris-time-picker=""
      data-disabled={disabled ? 'true' : undefined}
      className={className}
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={format === '12h' ? 1 : 0}
        max={format === '12h' ? 12 : 23}
        value={pad2(displayH)}
        disabled={disabled || undefined}
        aria-label={t('timePicker.hours')}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid ? 'true' : undefined}
        data-iris-time-picker-hours=""
        onChange={onHoursInput}
        onKeyDown={onHoursKey}
        style={fieldStyle}
      />
      <span
        aria-hidden="true"
        style={{ color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-base, 15px)' }}
      >
        :
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        step={minuteStep}
        value={pad2(value.minutes)}
        disabled={disabled || undefined}
        aria-label={t('timePicker.minutes')}
        data-iris-time-picker-minutes=""
        onChange={onMinutesInput}
        onKeyDown={onMinutesKey}
        style={fieldStyle}
      />
      {format === '12h' ? (
        <button
          type="button"
          disabled={disabled || undefined}
          aria-label={t('timePicker.togglePeriod')}
          data-iris-time-picker-meridiem={meridiem}
          onClick={toggleMeridiem}
          style={{
            height: 34,
            padding: '4px 8px',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          {meridiem}
        </button>
      ) : null}
    </div>
  )
}
