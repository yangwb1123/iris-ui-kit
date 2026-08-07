import * as React from 'react'
import { useI18n } from '../../i18n'

export type IrisOtpInputSize = 'sm' | 'md' | 'lg'
export type IrisOtpInputType = 'numeric' | 'alphanumeric'

export interface IrisOtpInputProps {
  /** Controlled value (the full code). */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Fired once the code fills every cell. */
  onComplete?: (value: string) => void
  /** Number of cells. Default 6. */
  length?: number
  /** Allowed characters: digits only, or digits + letters. */
  type?: IrisOtpInputType
  /** Mask entered characters (renders password cells). */
  mask?: boolean
  size?: IrisOtpInputSize
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  /** Placeholder glyph shown in empty cells. */
  placeholder?: string
  /** id forwarded to the first cell so `<label htmlFor>` focuses it. Set by `IrisFormField`. */
  id?: string
  /** Applied as `aria-describedby` on every cell. Set by `IrisFormField`. */
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

const SIZE_MAP: Record<IrisOtpInputSize, { box: number; height: number; fontSize: string }> = {
  sm: { box: 32, height: 36, fontSize: 'var(--iris-font-size-md, 14px)' },
  md: { box: 38, height: 44, fontSize: 'var(--iris-font-size-xl, 18px)' },
  lg: { box: 44, height: 52, fontSize: 'var(--iris-font-size-2xl, 20px)' },
}

const PATTERNS: Record<IrisOtpInputType, RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[0-9a-zA-Z]/,
}

/** Keep only characters allowed by `type`. */
function sanitize(str: string, type: IrisOtpInputType): string {
  const re = PATTERNS[type]
  let out = ''
  for (const ch of str) if (re.test(ch)) out += ch
  return out
}

/**
 * One-time-code / PIN entry: a row of single-character cells with smart focus
 * movement, paste-to-fill, and keyboard editing. The value is kept contiguous
 * (no interior gaps), masked optionally, and surfaced via `onValueChange`;
 * `onComplete` fires when every cell is filled. Drop it inside `IrisFormField`
 * — the injected `id` lands on the first cell so the label focuses it.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisOtpInput}.
 */
export function IrisOtpInput({
  value: valueProp,
  defaultValue = '',
  onValueChange,
  onComplete,
  length = 6,
  type = 'numeric',
  mask = false,
  size = 'md',
  disabled = false,
  invalid = false,
  autoFocus = false,
  placeholder = '',
  id,
  ariaDescribedby,
  style,
  className,
  ...rest
}: IrisOtpInputProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<string>(() =>
    sanitize(defaultValue, type).slice(0, length),
  )
  const value = sanitize(isControlled ? (valueProp as string) : internal, type).slice(0, length)

  const cellsRef = React.useRef<(HTMLInputElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = React.useState(-1)

  const focusCell = (i: number) => {
    const el = cellsRef.current[Math.max(0, Math.min(length - 1, i))]
    if (el) {
      el.focus()
      el.select()
    }
  }

  const commit = (next: string) => {
    const v = sanitize(next, type).slice(0, length)
    if (v === value) return
    if (!isControlled) setInternal(v)
    onValueChange?.(v)
    if (v.length === length) onComplete?.(v)
  }

  // Overwrite from `startIndex`, clamped to ≤ current length so no interior gap
  // can form. Used by both typing (one char) and paste (many).
  const writeFrom = (startIndex: number, chars: string) => {
    const clean = sanitize(chars, type)
    if (!clean) return
    const start = Math.min(startIndex, value.length)
    const arr = value.split('')
    for (let k = 0; k < clean.length && start + k < length; k++) arr[start + k] = clean.charAt(k)
    commit(arr.join('').slice(0, length))
    focusCell(start + clean.length)
  }

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    // maxLength=1 keeps typing to one char; a longer value means OTP autofill —
    // distribute it across the cells either way.
    const clean = sanitize(e.target.value, type)
    if (clean) writeFrom(i, clean)
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    const { key } = e
    if (key === 'Backspace') {
      e.preventDefault()
      if (value[i]) {
        commit(value.slice(0, i) + value.slice(i + 1))
        focusCell(i - 1)
      } else if (i > 0) {
        commit(value.slice(0, i - 1) + value.slice(i))
        focusCell(i - 1)
      }
    } else if (key === 'Delete') {
      e.preventDefault()
      if (value[i]) commit(value.slice(0, i) + value.slice(i + 1))
    } else if (key === 'ArrowLeft') {
      e.preventDefault()
      focusCell(i - 1)
    } else if (key === 'ArrowRight') {
      e.preventDefault()
      focusCell(i + 1)
    } else if (key === 'Home') {
      e.preventDefault()
      focusCell(0)
    } else if (key === 'End') {
      e.preventDefault()
      focusCell(value.length)
    } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Block disallowed printable keys so they never reach the cell.
      if (!PATTERNS[type].test(key)) e.preventDefault()
    }
  }

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled) return
    writeFrom(i, e.clipboardData.getData('text'))
  }

  React.useEffect(() => {
    if (autoFocus) cellsRef.current[0]?.focus()
  }, [autoFocus])

  const sz = SIZE_MAP[size]

  return (
    <div
      data-iris-otp-input=""
      data-iris-otp-input-size={size}
      data-state={invalid ? 'invalid' : 'idle'}
      role="group"
      aria-disabled={disabled ? 'true' : undefined}
      className={className}
      {...rest}
      style={{ display: 'inline-flex', gap: 8, direction: 'inherit', ...style }}
    >
      {Array.from({ length }, (_, i) => {
        const char = value.charAt(i)
        const focused = focusedIndex === i
        const borderColor = invalid
          ? 'var(--iris-danger)'
          : focused
            ? 'var(--iris-primary)'
            : 'var(--iris-border)'
        return (
          <input
            key={i}
            ref={(el) => {
              cellsRef.current[i] = el
            }}
            id={i === 0 ? id : undefined}
            type={mask ? 'password' : 'text'}
            inputMode={type === 'numeric' ? 'numeric' : 'text'}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={char}
            placeholder={placeholder || undefined}
            disabled={disabled}
            aria-label={t('otpInput.cell', { index: i + 1, total: length })}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={ariaDescribedby}
            data-iris-otp-input-cell=""
            data-filled={char ? 'true' : undefined}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => {
              setFocusedIndex(i)
              e.currentTarget.select()
            }}
            onBlur={() => setFocusedIndex(-1)}
            style={{
              width: sz.box,
              height: sz.height,
              textAlign: 'center',
              fontSize: sz.fontSize,
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--iris-foreground)',
              background: 'var(--iris-background)',
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--iris-radius-md, 6px)',
              outline: 'none',
              opacity: disabled ? 0.6 : 1,
              boxShadow: focused
                ? `0 0 0 3px ${invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
                : 'none',
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
            }}
          />
        )
      })}
    </div>
  )
}
