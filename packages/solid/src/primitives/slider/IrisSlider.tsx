import { createSignal, mergeProps, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

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

export interface IrisSliderProps {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  orientation?: IrisSliderOrientation
  label?: string
  onChange?: (value: number) => void
  onChangeEnd?: (value: number) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisSlider — single-thumb numeric slider. */
export function IrisSlider(props: IrisSliderProps): JSX.Element {
  const merged = mergeProps(
    {
      min: 0,
      max: 100,
      step: 1,
      orientation: 'horizontal' as IrisSliderOrientation,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'min',
    'max',
    'step',
    'disabled',
    'orientation',
    'label',
    'onChange',
    'onChangeEnd',
    'style',
  ])

  const { t } = useI18n()

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal(local.defaultValue ?? local.min)
  const current = (): number => (isControlled() ? (local.value as number) : internal())

  const [dragging, setDragging] = createSignal(false)
  let trackRef: HTMLElement | undefined

  const isHorizontal = (): boolean => local.orientation === 'horizontal'

  const percent = (): number => {
    const range = local.max - local.min
    if (range <= 0) return 0
    return ((current() - local.min) / range) * 100
  }

  const setValue = (next: number, emitChange = false): void => {
    const clamped = clamp(next, local.min, local.max)
    const rounded = roundToStep(clamped, local.step, local.min)
    const final = clamp(rounded, local.min, local.max)
    if (!isControlled()) setInternal(final)
    local.onChange?.(final)
    if (emitChange) local.onChangeEnd?.(final)
  }

  const valueFromPointer = (clientX: number, clientY: number): number => {
    const track = trackRef
    if (!track) return current()
    const rect = track.getBoundingClientRect()
    let ratio: number
    if (isHorizontal()) {
      if (rect.width <= 0) return current()
      ratio = (clientX - rect.left) / rect.width
    } else {
      if (rect.height <= 0) return current()
      ratio = 1 - (clientY - rect.top) / rect.height
    }
    ratio = Math.max(0, Math.min(1, ratio))
    return local.min + ratio * (local.max - local.min)
  }

  const onThumbPointerDown = (e: PointerEvent): void => {
    if (local.disabled) return
    e.preventDefault()
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onThumbPointerMove = (e: PointerEvent): void => {
    if (!dragging()) return
    setValue(valueFromPointer(e.clientX, e.clientY))
  }

  const onThumbPointerUp = (e: PointerEvent): void => {
    if (!dragging()) return
    setDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    local.onChangeEnd?.(current())
  }

  const onTrackClick = (e: MouseEvent): void => {
    if (local.disabled) return
    if (e.target !== e.currentTarget) return
    setValue(valueFromPointer(e.clientX, e.clientY), true)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (local.disabled) return
    const big = local.step * 10
    let next: number | null = null
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current() - local.step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = current() + local.step
        break
      case 'Home':
        next = local.min
        break
      case 'End':
        next = local.max
        break
      case 'PageUp':
        next = current() + big
        break
      case 'PageDown':
        next = current() - big
        break
    }
    if (next !== null) {
      e.preventDefault()
      setValue(next, true)
    }
  }

  const p = (): number => percent()

  return (
    <div
      {...rest}
      data-iris-slider=""
      data-iris-slider-orientation={local.orientation}
      data-state={local.disabled ? 'disabled' : dragging() ? 'dragging' : 'idle'}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        ...(isHorizontal() ? { width: '100%', padding: '8px 0' } : { padding: '0 8px' }),
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      <div
        ref={(el) => {
          trackRef = el
        }}
        data-iris-slider-track=""
        onClick={onTrackClick}
        style={{
          position: 'relative',
          background: 'var(--iris-surface)',
          'border-radius': '9999px',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          opacity: local.disabled ? 0.6 : 1,
          ...(isHorizontal()
            ? { width: '100%', height: '6px' }
            : { width: '6px', height: '120px' }),
        }}
      >
        <div
          data-iris-slider-fill=""
          style={{
            position: 'absolute',
            background: 'var(--iris-primary)',
            'border-radius': '9999px',
            'pointer-events': 'none',
            ...(isHorizontal()
              ? { top: '0', bottom: '0', 'inset-inline-start': '0', width: `${p()}%` }
              : { left: '0', right: '0', bottom: '0', height: `${p()}%` }),
          }}
        />
        <div
          data-iris-slider-thumb=""
          role="slider"
          aria-label={local.label ?? t('slider.label')}
          aria-valuemin={local.min}
          aria-valuemax={local.max}
          aria-valuenow={current()}
          aria-orientation={local.orientation}
          aria-disabled={local.disabled ? 'true' : undefined}
          tabIndex={local.disabled ? -1 : 0}
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
          onKeyDown={onKeyDown}
          style={{
            position: 'absolute',
            width: '16px',
            height: '16px',
            'border-radius': '50%',
            background: 'var(--iris-background)',
            border: '2px solid var(--iris-primary)',
            'box-shadow': dragging()
              ? '0 0 0 4px color-mix(in srgb, var(--iris-primary) 18%, transparent)'
              : 'var(--iris-shadow-sm)',
            cursor: local.disabled ? 'not-allowed' : 'grab',
            transition: 'box-shadow 120ms ease',
            'touch-action': 'none',
            outline: 'none',
            ...(isHorizontal()
              ? { top: '50%', 'inset-inline-start': `${p()}%`, transform: 'translate(-50%, -50%)' }
              : { left: '50%', bottom: `${p()}%`, transform: 'translate(-50%, 50%)' }),
          }}
        />
      </div>
    </div>
  )
}
