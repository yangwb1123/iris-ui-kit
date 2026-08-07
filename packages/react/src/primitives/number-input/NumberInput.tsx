import * as React from 'react'
import { useI18n } from '../../i18n'

export type IrisNumberInputSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<
  IrisNumberInputSize,
  { padding: string; fontSize: string; minHeight: string }
> = {
  sm: { padding: '4px 8px', fontSize: 'var(--iris-font-size-xs, 12px)', minHeight: '28px' },
  md: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: '34px',
  },
  lg: { padding: '8px 12px', fontSize: 'var(--iris-font-size-lg, 16px)', minHeight: '40px' },
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

export interface IrisNumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step'
> {
  value?: number | null
  defaultValue?: number | null
  onChange?: (next: number | null) => void
  size?: IrisNumberInputSize
  min?: number
  max?: number
  step?: number
  invalid?: boolean
  showControls?: boolean
  ariaDescribedby?: string
}

/** React port of {@link import('@iris-ui-kit/vue').IrisNumberInput}. */
export const IrisNumberInput = React.forwardRef<HTMLInputElement, IrisNumberInputProps>(
  function IrisNumberInput(
    {
      value,
      defaultValue = null,
      onChange,
      size = 'md',
      min = -Infinity,
      max = Infinity,
      step = 1,
      disabled = false,
      readOnly = false,
      invalid = false,
      showControls = true,
      ariaDescribedby,
      style,
      ...rest
    },
    ref,
  ) {
    const { t } = useI18n()
    const isControlled = value !== undefined
    const [internal, setInternal] = React.useState<number | null>(defaultValue ?? null)
    const current = isControlled ? (value as number | null) : internal

    const [rawText, setRawText] = React.useState<string>(
      current === null || current === undefined ? '' : String(current),
    )

    React.useEffect(() => {
      if (current === null || current === undefined) {
        setRawText('')
      } else {
        setRawText(String(current))
      }
    }, [current])

    const [focused, setFocused] = React.useState(false)

    const setValue = (next: number | null) => {
      if (next === null) {
        if (!isControlled) setInternal(null)
        onChange?.(null)
        return
      }
      const clamped = clamp(next, min, max)
      const rounded = roundToStep(clamped, step)
      if (!isControlled) setInternal(rounded)
      onChange?.(rounded)
    }

    const startValue = Number.isFinite(min) && min !== -Infinity ? min : 0

    const increment = (factor: 1 | -1) => {
      if (disabled || readOnly) return
      const base = current === null || current === undefined ? startValue : current
      setValue(base + factor * step)
    }

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value
      setRawText(text)
      if (text === '' || text === '-') {
        onChange?.(null)
        if (!isControlled) setInternal(null)
        return
      }
      const parsed = Number(text)
      if (Number.isNaN(parsed)) {
        onChange?.(null)
        if (!isControlled) setInternal(null)
        return
      }
      if (!isControlled) setInternal(parsed)
      onChange?.(parsed)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false)
      if (current !== null && current !== undefined) {
        const clamped = clamp(current, min, max)
        const rounded = roundToStep(clamped, step)
        if (rounded !== current) setValue(rounded)
        else setRawText(String(rounded))
      }
      rest.onBlur?.(e)
    }
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true)
      rest.onFocus?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        increment(1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        increment(-1)
      }
    }

    const sizeStyles = SIZE_MAP[size]
    const borderColor = invalid
      ? 'var(--iris-danger)'
      : focused
        ? 'var(--iris-primary)'
        : 'var(--iris-border)'
    const boxShadow = focused
      ? `0 0 0 3px ${invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
      : 'none'

    const atMin = current !== null && current !== undefined && current <= min
    const atMax = current !== null && current !== undefined && current >= max

    const ctrlBtnStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      background: 'transparent',
      border: 'none',
      borderRadius: 'var(--iris-radius-sm, 4px)',
      cursor: 'pointer',
      color: 'var(--iris-muted)',
      lineHeight: 1,
      flexShrink: 0,
    }

    return (
      <div
        data-iris-number-input=""
        data-iris-number-input-size={size}
        data-state={invalid ? 'invalid' : focused ? 'focused' : 'idle'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--iris-radius-md, 6px)',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
          boxShadow,
          padding: sizeStyles.padding,
          minHeight: sizeStyles.minHeight,
          fontSize: sizeStyles.fontSize,
          ...style,
        }}
      >
        {showControls ? (
          <button
            type="button"
            data-iris-number-input-dec=""
            aria-label={t('numberInput.decrement')}
            disabled={disabled || atMin}
            onClick={() => increment(-1)}
            style={{ ...ctrlBtnStyle, marginInlineEnd: 4 }}
          >
            −
          </button>
        ) : null}
        <input
          {...rest}
          ref={ref}
          type="text"
          inputMode="decimal"
          role="spinbutton"
          value={rawText}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={ariaDescribedby}
          aria-valuenow={current === null || current === undefined ? undefined : current}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          onChange={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            minWidth: 40,
            width: '4ch',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            padding: 0,
            textAlign: 'end',
          }}
        />
        {showControls ? (
          <button
            type="button"
            data-iris-number-input-inc=""
            aria-label={t('numberInput.increment')}
            disabled={disabled || atMax}
            onClick={() => increment(1)}
            style={{ ...ctrlBtnStyle, marginInlineStart: 4 }}
          >
            +
          </button>
        ) : null}
      </div>
    )
  },
)
