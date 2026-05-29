import * as React from 'react'
import { useI18n } from '../../i18n'

export type IrisRatingSize = 'sm' | 'md' | 'lg'

export interface IrisRatingProps {
  /** Controlled rating (0..max, in 0.5 steps when `allowHalf`). */
  value?: number
  /** Initial value when uncontrolled. */
  defaultValue?: number
  onValueChange?: (value: number) => void
  /** Number of stars. Default 5. */
  max?: number
  /** Allow half-star precision. */
  allowHalf?: boolean
  /** Display-only — no interaction. */
  readonly?: boolean
  disabled?: boolean
  /** Clicking the current value again resets to 0. Default true. */
  clearable?: boolean
  size?: IrisRatingSize
  invalid?: boolean
  /** Accessible label for the slider. */
  label?: string
  /** id forwarded to the slider. Set by `IrisFormField`. */
  id?: string
  /** Applied as `aria-describedby`. Set by `IrisFormField`. */
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

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
 * (`aria-valuemin/now/max` + arrow keys) so it reads correctly to assistive
 * tech; stars are decorative. RTL-safe via logical fill clipping.
 *
 * React port of {@link import('@iris-ui/vue').IrisRating}.
 */
export function IrisRating({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  max = 5,
  allowHalf = false,
  readonly = false,
  disabled = false,
  clearable = true,
  size = 'md',
  invalid = false,
  label = 'Rating',
  id,
  ariaDescribedby,
  style,
  className,
}: IrisRatingProps): React.ReactElement {
  const { t } = useI18n()
  const step = allowHalf ? 0.5 : 1
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const value = clamp(isControlled ? (valueProp as number) : internal, 0, max)
  const [hover, setHover] = React.useState<number | null>(null)
  const interactive = !readonly && !disabled
  const display = hover ?? value

  const setValue = (next: number) => {
    const v = clamp(snap(next, step), 0, max)
    if (v === value) return
    if (!isControlled) setInternal(v)
    onValueChange?.(v)
  }

  /** Star index `i` (0-based) → value the pointer is over, honoring half. */
  const valueAt = (i: number, e: React.MouseEvent<HTMLElement>): number => {
    if (!allowHalf) return i + 1
    const rect = e.currentTarget.getBoundingClientRect()
    const past = e.clientX - rect.left
    return past < rect.width / 2 ? i + 0.5 : i + 1
  }

  const handleClick = (i: number, e: React.MouseEvent<HTMLElement>) => {
    if (!interactive) return
    let next = valueAt(i, e)
    if (clearable && next === value) next = 0
    setValue(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    let next = value
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = max
        break
      default:
        return
    }
    e.preventDefault()
    setValue(next)
  }

  const px = SIZE_MAP[size]
  const fillColor = invalid ? 'var(--iris-danger)' : 'var(--iris-warning, #f59e0b)'

  return (
    <div
      data-iris-rating=""
      data-iris-rating-size={size}
      data-state={invalid ? 'invalid' : 'idle'}
      role="slider"
      id={id}
      tabIndex={interactive ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={t('rating.value', { value, max })}
      aria-readonly={readonly ? 'true' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={ariaDescribedby}
      className={className}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHover(null)}
      style={{
        display: 'inline-flex',
        gap: Math.round(px * 0.18),
        lineHeight: 1,
        color: 'var(--iris-border)',
        cursor: interactive ? 'pointer' : 'default',
        opacity: disabled ? 0.6 : 1,
        outline: 'none',
        direction: 'inherit',
        ...style,
      }}
    >
      {Array.from({ length: max }, (_, i) => {
        const fill = clamp(display - i, 0, 1) * 100
        return (
          <span
            key={i}
            data-iris-rating-star=""
            data-filled={fill >= 100 ? 'true' : fill > 0 ? 'half' : undefined}
            onClick={(e) => handleClick(i, e)}
            onMouseMove={interactive ? (e) => setHover(valueAt(i, e)) : undefined}
            style={{
              position: 'relative',
              display: 'inline-block',
              width: px,
              height: px,
              fontSize: px,
            }}
          >
            <span aria-hidden="true">★</span>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                insetBlockStart: 0,
                insetInlineStart: 0,
                overflow: 'hidden',
                width: `${fill}%`,
                color: fillColor,
                whiteSpace: 'nowrap',
              }}
            >
              ★
            </span>
          </span>
        )
      })}
    </div>
  )
}
