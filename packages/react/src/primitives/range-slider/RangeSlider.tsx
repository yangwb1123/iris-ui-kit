import * as React from 'react'
import { getDirection } from '@iris-ui-kit/theme'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'

export type IrisRangeSliderValue = readonly [number, number]

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

export interface IrisRangeSliderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  value?: IrisRangeSliderValue
  defaultValue?: IrisRangeSliderValue
  onChange?: (next: IrisRangeSliderValue) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  labelStart?: string
  labelEnd?: string
}

/**
 * Two-handle numeric range slider. Value is `[start, end]` with `start <= end`;
 * the two handles never cross.
 */
export function IrisRangeSlider({
  value: valueProp,
  defaultValue = [0, 100] as IrisRangeSliderValue,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  labelStart,
  labelEnd,
  style,
  ...rest
}: IrisRangeSliderProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<IrisRangeSliderValue>(defaultValue)
  const raw = isControlled ? (valueProp as IrisRangeSliderValue) : internal

  const startVal = clamp(roundToStep(raw[0] ?? min, step, min), min, max)
  const endVal = clamp(roundToStep(raw[1] ?? max, step, min), min, max)

  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const startRef = React.useRef<HTMLDivElement | null>(null)
  const endRef = React.useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = React.useState<'start' | 'end' | null>(null)

  const percent = (v: number): number => ((v - min) / Math.max(1e-9, max - min)) * 100

  const setRange = React.useCallback(
    (next: IrisRangeSliderValue) => {
      if (!isControlled) setInternal(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  const updateAt = (handle: 'start' | 'end', nextRaw: number) => {
    const clamped = clamp(roundToStep(nextRaw, step, min), min, max)
    let s = startVal
    let e = endVal
    if (handle === 'start') {
      s = Math.min(clamped, e)
    } else {
      e = Math.max(clamped, s)
    }
    if (s === startVal && e === endVal) return
    setRange([s, e] as IrisRangeSliderValue)
  }

  const pointerValue = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return startVal
    const rect = track.getBoundingClientRect()
    // RTL: the value axis runs right-to-left, so measure from the right edge.
    const rtl = getDirection(track.closest<HTMLElement>('[data-iris-dir],[dir]')) === 'rtl'
    const rel = (rtl ? rect.right - clientX : clientX - rect.left) / Math.max(1, rect.width)
    return min + Math.max(0, Math.min(1, rel)) * (max - min)
  }

  useDrag({
    handle: startRef,
    disabled,
    onStart: () => setDragging('start'),
    onDrag: ({ x }) => updateAt('start', pointerValue(x)),
    onEnd: () => setDragging(null),
  })
  useDrag({
    handle: endRef,
    disabled,
    onStart: () => setDragging('end'),
    onDrag: ({ x }) => updateAt('end', pointerValue(x)),
    onEnd: () => setDragging(null),
  })

  const keyHandler = (handle: 'start' | 'end') => (e: React.KeyboardEvent) => {
    if (disabled) return
    const v = handle === 'start' ? startVal : endVal
    let next = v
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = v - step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = v + step
        break
      case 'Home':
        next = handle === 'start' ? min : startVal
        break
      case 'End':
        next = handle === 'end' ? max : endVal
        break
      case 'PageDown':
        next = v - step * 10
        break
      case 'PageUp':
        next = v + step * 10
        break
      default:
        return
    }
    e.preventDefault()
    updateAt(handle, next)
  }

  const sPct = percent(startVal)
  const ePct = percent(endVal)

  return (
    <div
      {...rest}
      data-iris-range-slider=""
      data-disabled={disabled ? '' : undefined}
      style={{
        position: 'relative',
        width: '100%',
        padding: 'var(--iris-space-md, 16px) var(--iris-space-xs, 8px)',
        ...style,
      }}
    >
      <div
        ref={trackRef}
        data-iris-range-slider-track=""
        style={{
          position: 'relative',
          height: 4,
          background: 'var(--iris-border)',
          borderRadius: 'var(--iris-radius-sm, 4px)',
        }}
      >
        <div
          data-iris-range-slider-range=""
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            // Logical inset so the range bar flips under `dir="rtl"`.
            insetInlineStart: `${sPct}%`,
            width: `${ePct - sPct}%`,
            background: disabled ? 'var(--iris-muted)' : 'var(--iris-primary)',
            borderRadius: 'inherit',
          }}
        />
        <div
          ref={startRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={labelStart ?? t('rangeSlider.start')}
          aria-valuemin={min}
          aria-valuemax={endVal}
          aria-valuenow={startVal}
          aria-disabled={disabled ? 'true' : undefined}
          data-iris-range-slider-thumb="start"
          data-dragging={dragging === 'start' ? 'true' : undefined}
          onKeyDown={keyHandler('start')}
          style={{
            position: 'absolute',
            top: '50%',
            insetInlineStart: `${sPct}%`,
            transform: 'translate(-50%, -50%)',
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
        <div
          ref={endRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={labelEnd ?? t('rangeSlider.end')}
          aria-valuemin={startVal}
          aria-valuemax={max}
          aria-valuenow={endVal}
          aria-disabled={disabled ? 'true' : undefined}
          data-iris-range-slider-thumb="end"
          data-dragging={dragging === 'end' ? 'true' : undefined}
          onKeyDown={keyHandler('end')}
          style={{
            position: 'absolute',
            top: '50%',
            insetInlineStart: `${ePct}%`,
            transform: 'translate(-50%, -50%)',
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
