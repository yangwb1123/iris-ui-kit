import * as React from 'react'
import { getDirection } from '@iris-ui-kit/theme'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'

export type IrisSliderOrientation = 'horizontal' | 'vertical'

function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0
  const s = step.toString()
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
function roundToStep(value: number, step: number, min: number): number {
  if (step <= 0) return value
  const places = decimalsOf(step)
  return Number((Math.round((value - min) / step) * step + min).toFixed(places))
}

export interface IrisSliderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  value?: number
  defaultValue?: number
  onChange?: (next: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  orientation?: IrisSliderOrientation
  /** Accessible label for screen readers. */
  label?: string
}

/**
 * Numeric slider with keyboard + pointer support.
 *
 * Keyboard:
 *   ←/↓ −step  ·  →/↑ +step  ·  Home min  ·  End max  ·  PgUp/PgDn ±step×10
 */
export function IrisSlider({
  value: valueProp,
  defaultValue = 0,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  orientation = 'horizontal',
  label,
  style,
  ...rest
}: IrisSliderProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const raw = isControlled ? (valueProp as number) : internal
  const value = clamp(roundToStep(raw, step, min), min, max)
  const valueRef = React.useRef(value)
  valueRef.current = value

  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const thumbRef = React.useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const isHorizontal = orientation === 'horizontal'

  const setValue = (next: number) => {
    const clamped = clamp(roundToStep(next, step, min), min, max)
    if (clamped === value) return
    if (!isControlled) setInternal(clamped)
    onChange?.(clamped)
  }

  const percent = ((value - min) / Math.max(1e-9, max - min)) * 100

  const pointerValue = (clientX: number, clientY: number): number => {
    const track = trackRef.current
    if (!track) return value
    const rect = track.getBoundingClientRect()
    // In RTL the horizontal value axis runs right-to-left, so measure from the
    // right edge. Direction is read from the nearest dir-bearing ancestor.
    const rtl = getDirection(track.closest<HTMLElement>('[data-iris-dir],[dir]')) === 'rtl'
    const rel = isHorizontal
      ? (rtl ? rect.right - clientX : clientX - rect.left) / Math.max(1, rect.width)
      : 1 - (clientY - rect.top) / Math.max(1, rect.height)
    return min + Math.max(0, Math.min(1, rel)) * (max - min)
  }

  useDrag({
    handle: thumbRef,
    disabled,
    onStart: () => setDragging(true),
    onDrag: ({ x, y }) => setValue(pointerValue(x, y)),
    onEnd: () => setDragging(false),
  })

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    setValue(pointerValue(e.clientX, e.clientY))
    thumbRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let next = value
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
      case 'PageDown':
        next = value - step * 10
        break
      case 'PageUp':
        next = value + step * 10
        break
      default:
        return
    }
    e.preventDefault()
    setValue(next)
  }

  return (
    <div
      {...rest}
      data-iris-slider=""
      data-iris-slider-orientation={orientation}
      data-disabled={disabled ? 'true' : undefined}
      data-state={dragging ? 'dragging' : 'idle'}
      style={{
        position: 'relative',
        width: isHorizontal ? '100%' : 'auto',
        height: isHorizontal ? 'auto' : '160px',
        padding: isHorizontal ? '14px 8px' : '8px 14px',
        ...style,
      }}
    >
      <div
        ref={trackRef}
        data-iris-slider-track=""
        onPointerDown={onTrackPointerDown}
        style={{
          position: 'relative',
          width: isHorizontal ? '100%' : '4px',
          height: isHorizontal ? '4px' : '100%',
          background: 'var(--iris-border)',
          borderRadius: 'var(--iris-radius-sm, 4px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          data-iris-slider-fill=""
          style={{
            position: 'absolute',
            top: 0,
            // Logical inset so the fill anchors to the inline-start edge and
            // flips automatically under `dir="rtl"`.
            insetInlineStart: 0,
            ...(isHorizontal
              ? { height: '100%', width: `${percent}%` }
              : { width: '100%', height: `${percent}%`, top: 'auto', bottom: 0 }),
            background: disabled ? 'var(--iris-muted)' : 'var(--iris-primary)',
            borderRadius: 'inherit',
          }}
        />
        <div
          ref={thumbRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label ?? t('slider.label')}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-disabled={disabled ? 'true' : undefined}
          aria-orientation={orientation}
          data-iris-slider-thumb=""
          onKeyDown={onKeyDown}
          style={{
            position: 'absolute',
            ...(isHorizontal
              ? { top: '50%', insetInlineStart: `${percent}%`, transform: 'translate(-50%, -50%)' }
              : { left: '50%', bottom: `${percent}%`, transform: 'translate(-50%, 50%)' }),
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--iris-background)',
            border: `2px solid ${disabled ? 'var(--iris-muted)' : 'var(--iris-primary)'}`,
            cursor: disabled ? 'not-allowed' : 'grab',
            touchAction: 'none',
            outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
