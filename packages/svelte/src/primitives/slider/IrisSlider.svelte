<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type Orientation = 'horizontal' | 'vertical'

  interface Props {
    value?: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    orientation?: Orientation
    label?: string
    style?: string
    onchange?: (value: number) => void
    oninput?: (value: number) => void
    [key: string]: unknown
  }

  let {
    value = 0,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    orientation = 'horizontal',
    label,
    style,
    onchange,
    oninput,
    ...rest
  }: Props = $props()

  let dragging = $state(false)
  let trackEl = $state<HTMLElement | undefined>(undefined)
  let thumbEl = $state<HTMLElement | undefined>(undefined)

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

  const isHorizontal = $derived(orientation === 'horizontal')

  const percent = $derived.by(() => {
    const range = max - min
    if (range <= 0) return 0
    return ((value - min) / range) * 100
  })

  function setValue(next: number, emitChange: boolean) {
    const clamped = clamp(next, min, max)
    const rounded = roundToStep(clamped, step, min)
    const final = clamp(rounded, min, max)
    if (final !== value) {
      oninput?.(final)
      if (emitChange) onchange?.(final)
    } else if (emitChange) {
      onchange?.(final)
    }
  }

  function valueFromPointer(clientX: number, clientY: number): number {
    const track = trackEl
    if (!track) return value
    const rect = track.getBoundingClientRect()
    let ratio: number
    if (isHorizontal) {
      if (rect.width <= 0) return value
      ratio = (clientX - rect.left) / rect.width
    } else {
      if (rect.height <= 0) return value
      ratio = 1 - (clientY - rect.top) / rect.height
    }
    ratio = Math.max(0, Math.min(1, ratio))
    return min + ratio * (max - min)
  }

  function handleTrackClick(e: MouseEvent) {
    if (disabled) return
    if (e.target !== e.currentTarget) return
    setValue(valueFromPointer(e.clientX, e.clientY), true)
    thumbEl?.focus()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return
    const big = step * 10
    let next: number | null = null
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': next = value - step; break
      case 'ArrowRight': case 'ArrowUp': next = value + step; break
      case 'Home': next = min; break
      case 'End': next = max; break
      case 'PageUp': next = value + big; break
      case 'PageDown': next = value - big; break
    }
    if (next !== null) { e.preventDefault(); setValue(next, true) }
  }

  // Drag handling
  function handleThumbPointerDown(e: PointerEvent) {
    if (disabled) return
    e.preventDefault()
    dragging = true
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }

  function handleThumbPointerMove(e: PointerEvent) {
    if (!dragging) return
    setValue(valueFromPointer(e.clientX, e.clientY), false)
  }

  function handleThumbPointerUp() {
    if (!dragging) return
    dragging = false
    onchange?.(value)
  }

  const trackStyle = $derived(styleToString({
    position: 'relative',
    background: 'var(--iris-surface, #e5e7eb)',
    'border-radius': '9999px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? '0.6' : '1',
    ...(isHorizontal ? { width: '100%', height: '6px' } : { width: '6px', height: '120px' }),
  }))

  const fillStyle = $derived(styleToString({
    position: 'absolute',
    background: 'var(--iris-primary)',
    'border-radius': '9999px',
    'pointer-events': 'none',
    ...(isHorizontal
      ? { top: '0', bottom: '0', 'inset-inline-start': '0', width: `${percent}%` }
      : { left: '0', right: '0', bottom: '0', height: `${percent}%` }),
  }))

  const thumbStyle = $derived(styleToString({
    position: 'absolute',
    width: '16px',
    height: '16px',
    'border-radius': '50%',
    background: 'var(--iris-background, #fff)',
    border: '2px solid var(--iris-primary)',
    'box-shadow': dragging ? '0 0 0 4px rgba(99, 102, 241, 0.18)' : '0 1px 2px rgba(0,0,0,.15)',
    cursor: disabled ? 'not-allowed' : 'grab',
    transition: 'box-shadow 120ms ease',
    'touch-action': 'none',
    ...(isHorizontal
      ? { top: '50%', 'inset-inline-start': `${percent}%`, transform: 'translate(-50%, -50%)' }
      : { left: '50%', bottom: `${percent}%`, transform: 'translate(-50%, 50%)' }),
  }))
</script>

<div
  {...rest}
  data-iris-slider
  data-iris-slider-orientation={orientation}
  data-state={disabled ? 'disabled' : dragging ? 'dragging' : 'idle'}
  style={mergeStyle(
    styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      ...(isHorizontal ? { width: '100%', padding: '8px 0' } : { padding: '0 8px' }),
    }),
    style,
  )}
>
  <div
    bind:this={trackEl}
    data-iris-slider-track
    style={trackStyle}
    onclick={handleTrackClick}
  >
    <div data-iris-slider-fill style={fillStyle}></div>
    <div
      bind:this={thumbEl}
      data-iris-slider-thumb
      role="slider"
      aria-label={label ?? t('slider.label')}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation={orientation}
      aria-disabled={disabled ? 'true' : undefined}
      tabindex={disabled ? -1 : 0}
      style={thumbStyle}
      onkeydown={handleKeyDown}
      onpointerdown={handleThumbPointerDown}
      onpointermove={handleThumbPointerMove}
      onpointerup={handleThumbPointerUp}
    ></div>
  </div>
</div>
