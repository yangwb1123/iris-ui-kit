<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type RangeValue = [number, number]

  interface Props {
    value?: RangeValue
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    labelStart?: string
    labelEnd?: string
    style?: string
    onchange?: (value: RangeValue) => void
    oninput?: (value: RangeValue) => void
    [key: string]: unknown
  }

  let {
    value = [0, 100],
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    labelStart,
    labelEnd,
    style,
    onchange,
    oninput,
    ...rest
  }: Props = $props()

  let dragging = $state<'start' | 'end' | null>(null)
  let trackEl = $state<HTMLElement | undefined>(undefined)

  function decimalsOf(s: number): number {
    const str = s.toString()
    const dot = str.indexOf('.')
    return dot < 0 ? 0 : str.length - dot - 1
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v))
  }

  function roundToStep(v: number, s: number, mn: number): number {
    if (s <= 0) return v
    const places = decimalsOf(s)
    return Number((Math.round((v - mn) / s) * s + mn).toFixed(places))
  }

  const startVal = $derived(clamp(roundToStep(value[0] ?? min, step, min), min, max))
  const endVal = $derived(clamp(roundToStep(value[1] ?? max, step, min), min, max))

  function percent(v: number): number {
    const range = max - min
    if (range <= 0) return 0
    return ((v - min) / range) * 100
  }

  function updateAt(handle: 'start' | 'end', next: number) {
    const clamped = clamp(roundToStep(next, step, min), min, max)
    let s = startVal
    let e = endVal
    if (handle === 'start') s = Math.min(clamped, e)
    else e = Math.max(clamped, s)
    if (s === startVal && e === endVal) return
    const newValue: RangeValue = [s, e]
    oninput?.(newValue)
    onchange?.(newValue)
  }

  function pointerValue(clientX: number): number {
    const track = trackEl
    if (!track) return startVal
    const rect = track.getBoundingClientRect()
    const rel = (clientX - rect.left) / Math.max(1, rect.width)
    return min + Math.max(0, Math.min(1, rel)) * (max - min)
  }

  function keyHandler(handle: 'start' | 'end') {
    return (e: KeyboardEvent) => {
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
  }

  function makePointerHandlers(handle: 'start' | 'end') {
    return {
      onpointerdown(e: PointerEvent) {
        if (disabled) return
        e.preventDefault()
        dragging = handle
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      },
      onpointermove(e: PointerEvent) {
        if (dragging !== handle) return
        updateAt(handle, pointerValue(e.clientX))
      },
      onpointerup() {
        if (dragging === handle) dragging = null
      },
    }
  }

  const startPct = $derived(percent(startVal))
  const endPct = $derived(percent(endVal))

  const thumbBase = $derived(
    styleToString({
      position: 'absolute',
      top: '50%',
      width: '16px',
      height: '16px',
      'border-radius': '50%',
      background: 'var(--iris-background, #fff)',
      cursor: disabled ? 'not-allowed' : 'grab',
      'touch-action': 'none',
      outline: 'none',
    }),
  )
</script>

<div
  {...rest}
  data-iris-range-slider
  data-disabled={disabled ? '' : undefined}
  style={mergeStyle(
    styleToString({ position: 'relative', width: '100%', padding: '14px 8px' }),
    style,
  )}
>
  <div
    bind:this={trackEl}
    data-iris-range-slider-track
    style="position: relative; height: 4px; background: var(--iris-border, #e5e7eb); border-radius: var(--iris-radius-sm, 4px);"
  >
    <!-- Range fill -->
    <div
      data-iris-range-slider-range
      style="position: absolute; top: 0; bottom: 0; inset-inline-start: {startPct}%; width: {endPct -
        startPct}%; background: {disabled
        ? 'var(--iris-muted)'
        : 'var(--iris-primary)'}; border-radius: inherit;"
    ></div>
    <!-- Start thumb -->
    <div
      role="slider"
      tabindex={disabled ? -1 : 0}
      aria-label={labelStart ?? t('rangeSlider.start')}
      aria-valuemin={min}
      aria-valuemax={endVal}
      aria-valuenow={startVal}
      aria-disabled={disabled ? 'true' : undefined}
      data-iris-range-slider-thumb="start"
      data-dragging={dragging === 'start' ? 'true' : undefined}
      onkeydown={keyHandler('start')}
      {...makePointerHandlers('start')}
      style="{thumbBase}; inset-inline-start: {startPct}%; transform: translate(-50%, -50%); border: 2px solid {disabled
        ? 'var(--iris-muted)'
        : 'var(--iris-primary)'};"
    ></div>
    <!-- End thumb -->
    <div
      role="slider"
      tabindex={disabled ? -1 : 0}
      aria-label={labelEnd ?? t('rangeSlider.end')}
      aria-valuemin={startVal}
      aria-valuemax={max}
      aria-valuenow={endVal}
      aria-disabled={disabled ? 'true' : undefined}
      data-iris-range-slider-thumb="end"
      data-dragging={dragging === 'end' ? 'true' : undefined}
      onkeydown={keyHandler('end')}
      {...makePointerHandlers('end')}
      style="{thumbBase}; inset-inline-start: {endPct}%; transform: translate(-50%, -50%); border: 2px solid {disabled
        ? 'var(--iris-muted)'
        : 'var(--iris-primary)'};"
    ></div>
  </div>
</div>
