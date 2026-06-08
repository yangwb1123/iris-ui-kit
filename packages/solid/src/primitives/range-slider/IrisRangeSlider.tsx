import { createSignal, mergeProps, splitProps, type JSX } from 'solid-js'

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

export interface IrisRangeSliderProps {
  value?: IrisRangeSliderValue
  defaultValue?: IrisRangeSliderValue
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  labelStart?: string
  labelEnd?: string
  onChange?: (value: IrisRangeSliderValue) => void
  onChangeEnd?: (value: IrisRangeSliderValue) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisRangeSlider — two-handle range slider. */
export function IrisRangeSlider(props: IrisRangeSliderProps): JSX.Element {
  const merged = mergeProps(
    {
      min: 0,
      max: 100,
      step: 1,
      labelStart: 'Start',
      labelEnd: 'End',
      defaultValue: [0, 100] as IrisRangeSliderValue,
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
    'labelStart',
    'labelEnd',
    'onChange',
    'onChangeEnd',
    'style',
  ])

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal<IrisRangeSliderValue>(local.defaultValue)
  const current = (): IrisRangeSliderValue =>
    isControlled() ? (local.value as IrisRangeSliderValue) : internal()

  const [dragging, setDragging] = createSignal<'start' | 'end' | null>(null)
  let trackRef: HTMLElement | undefined

  const startVal = (): number =>
    clamp(roundToStep(current()[0] ?? local.min, local.step, local.min), local.min, local.max)
  const endVal = (): number =>
    clamp(roundToStep(current()[1] ?? local.max, local.step, local.min), local.min, local.max)

  const pct = (v: number): number => {
    const range = local.max - local.min
    if (range <= 0) return 0
    return ((v - local.min) / range) * 100
  }

  const updateAt = (handle: 'start' | 'end', next: number): void => {
    const clamped = clamp(roundToStep(next, local.step, local.min), local.min, local.max)
    let s = startVal()
    let e = endVal()
    if (handle === 'start') s = Math.min(clamped, e)
    else e = Math.max(clamped, s)
    if (s === startVal() && e === endVal()) return
    const newValue: IrisRangeSliderValue = [s, e]
    if (!isControlled()) setInternal(newValue)
    local.onChange?.(newValue)
  }

  const pointerValue = (clientX: number): number => {
    const track = trackRef
    if (!track) return startVal()
    const rect = track.getBoundingClientRect()
    const rel = (clientX - rect.left) / Math.max(1, rect.width)
    return local.min + Math.max(0, Math.min(1, rel)) * (local.max - local.min)
  }

  const makePointerHandlers = (handle: 'start' | 'end') => ({
    onPointerDown: (e: PointerEvent) => {
      if (local.disabled) return
      e.preventDefault()
      setDragging(handle)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent) => {
      if (dragging() !== handle) return
      updateAt(handle, pointerValue(e.clientX))
    },
    onPointerUp: (e: PointerEvent) => {
      if (dragging() !== handle) return
      setDragging(null)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      local.onChangeEnd?.([startVal(), endVal()])
    },
  })

  const keyHandler = (handle: 'start' | 'end') => (e: KeyboardEvent) => {
    if (local.disabled) return
    const v = handle === 'start' ? startVal() : endVal()
    let next = v
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = v - local.step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = v + local.step
        break
      case 'Home':
        next = handle === 'start' ? local.min : startVal()
        break
      case 'End':
        next = handle === 'end' ? local.max : endVal()
        break
      case 'PageDown':
        next = v - local.step * 10
        break
      case 'PageUp':
        next = v + local.step * 10
        break
      default:
        return
    }
    e.preventDefault()
    updateAt(handle, next)
  }

  const startHandlers = makePointerHandlers('start')
  const endHandlers = makePointerHandlers('end')

  return (
    <div
      {...rest}
      data-iris-range-slider=""
      data-disabled={local.disabled ? '' : undefined}
      style={{
        position: 'relative',
        width: '100%',
        padding: '14px 8px',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      <div
        ref={(el) => {
          trackRef = el
        }}
        data-iris-range-slider-track=""
        style={{
          position: 'relative',
          height: '4px',
          background: 'var(--iris-border)',
          'border-radius': 'var(--iris-radius-sm, 4px)',
        }}
      >
        <div
          data-iris-range-slider-range=""
          style={{
            position: 'absolute',
            top: '0',
            bottom: '0',
            'inset-inline-start': `${pct(startVal())}%`,
            width: `${pct(endVal()) - pct(startVal())}%`,
            background: local.disabled ? 'var(--iris-muted)' : 'var(--iris-primary)',
            'border-radius': 'inherit',
          }}
        />
        <div
          data-iris-range-slider-thumb="start"
          data-dragging={dragging() === 'start' ? 'true' : undefined}
          role="slider"
          tabIndex={local.disabled ? -1 : 0}
          aria-label={local.labelStart}
          aria-valuemin={local.min}
          aria-valuemax={endVal()}
          aria-valuenow={startVal()}
          aria-disabled={local.disabled ? 'true' : undefined}
          {...startHandlers}
          onKeyDown={keyHandler('start')}
          style={{
            position: 'absolute',
            top: '50%',
            'inset-inline-start': `${pct(startVal())}%`,
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '16px',
            'border-radius': '50%',
            background: 'var(--iris-background)',
            border: `2px solid ${local.disabled ? 'var(--iris-muted)' : 'var(--iris-primary)'}`,
            cursor: local.disabled ? 'not-allowed' : 'grab',
            'touch-action': 'none',
            outline: 'none',
          }}
        />
        <div
          data-iris-range-slider-thumb="end"
          data-dragging={dragging() === 'end' ? 'true' : undefined}
          role="slider"
          tabIndex={local.disabled ? -1 : 0}
          aria-label={local.labelEnd}
          aria-valuemin={startVal()}
          aria-valuemax={local.max}
          aria-valuenow={endVal()}
          aria-disabled={local.disabled ? 'true' : undefined}
          {...endHandlers}
          onKeyDown={keyHandler('end')}
          style={{
            position: 'absolute',
            top: '50%',
            'inset-inline-start': `${pct(endVal())}%`,
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '16px',
            'border-radius': '50%',
            background: 'var(--iris-background)',
            border: `2px solid ${local.disabled ? 'var(--iris-muted)' : 'var(--iris-primary)'}`,
            cursor: local.disabled ? 'not-allowed' : 'grab',
            'touch-action': 'none',
            outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
