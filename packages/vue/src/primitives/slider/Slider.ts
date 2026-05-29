import { computed, defineComponent, h, ref, type PropType } from 'vue'
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
  const offset = Math.round((value - min) / step) * step + min
  return Number(offset.toFixed(places))
}

/**
 * Numeric slider with keyboard + pointer support. Single thumb today; a
 * range variant can be added when needed (two thumbs, same skeleton).
 *
 * Keyboard:
 *   - ←/↓  : −step
 *   - →/↑  : +step
 *   - Home : min
 *   - End  : max
 *   - PgUp / PgDn : ±step × 10
 */
export const IrisSlider = defineComponent({
  name: 'IrisSlider',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    orientation: { type: String as PropType<IrisSliderOrientation>, default: 'horizontal' },
    /** Accessible label for screen readers. */
    label: { type: String, default: 'Value' },
  },
  emits: {
    'update:modelValue': (_value: number) => true,
    change: (_value: number) => true,
  },
  setup(props, { attrs, emit }) {
    const trackRef = ref<HTMLElement | null>(null)
    const thumbRef = ref<HTMLElement | null>(null)
    const dragging = ref(false)

    const isHorizontal = computed(() => props.orientation === 'horizontal')

    const percent = computed(() => {
      const range = props.max - props.min
      if (range <= 0) return 0
      return ((props.modelValue - props.min) / range) * 100
    })

    const setValue = (next: number, emitChange: boolean) => {
      const clamped = clamp(next, props.min, props.max)
      const rounded = roundToStep(clamped, props.step, props.min)
      const finalValue = clamp(rounded, props.min, props.max)
      if (finalValue !== props.modelValue) {
        emit('update:modelValue', finalValue)
        if (emitChange) emit('change', finalValue)
      } else if (emitChange) {
        emit('change', finalValue)
      }
    }

    const valueFromPointer = (clientX: number, clientY: number): number => {
      const track = trackRef.value
      if (!track) return props.modelValue
      const rect = track.getBoundingClientRect()
      let ratio: number
      if (isHorizontal.value) {
        if (rect.width <= 0) return props.modelValue
        ratio = (clientX - rect.left) / rect.width
      } else {
        if (rect.height <= 0) return props.modelValue
        // Vertical: top = max, bottom = min (common convention)
        ratio = 1 - (clientY - rect.top) / rect.height
      }
      ratio = Math.max(0, Math.min(1, ratio))
      return props.min + ratio * (props.max - props.min)
    }

    useDrag({
      handle: thumbRef,
      disabled: computed(() => props.disabled),
      onStart: ({ x, y }) => {
        if (props.disabled) return false
        dragging.value = true
        setValue(valueFromPointer(x, y), false)
        return true
      },
      onDrag: ({ x, y }) => {
        setValue(valueFromPointer(x, y), false)
      },
      onEnd: () => {
        dragging.value = false
        emit('change', props.modelValue)
      },
    })

    const onTrackClick = (event: MouseEvent) => {
      if (props.disabled) return
      // Only handle direct clicks on the track (not the thumb — drag handles that).
      if (event.target !== event.currentTarget) return
      setValue(valueFromPointer(event.clientX, event.clientY), true)
      thumbRef.value?.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (props.disabled) return
      const big = props.step * 10
      let next: number | null = null
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = props.modelValue - props.step
          break
        case 'ArrowRight':
        case 'ArrowUp':
          next = props.modelValue + props.step
          break
        case 'Home':
          next = props.min
          break
        case 'End':
          next = props.max
          break
        case 'PageUp':
          next = props.modelValue + big
          break
        case 'PageDown':
          next = props.modelValue - big
          break
      }
      if (next !== null) {
        event.preventDefault()
        setValue(next, true)
      }
    }

    const trackStyle = computed<Record<string, string>>(() => {
      const horiz = isHorizontal.value
      return {
        position: 'relative',
        background: 'var(--iris-surface)',
        borderRadius: '9999px',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? '0.6' : '1',
        ...(horiz ? { width: '100%', height: '6px' } : { width: '6px', height: '120px' }),
      }
    })

    const fillStyle = computed<Record<string, string>>(() => {
      const horiz = isHorizontal.value
      return {
        position: 'absolute',
        background: 'var(--iris-primary)',
        borderRadius: '9999px',
        pointerEvents: 'none',
        ...(horiz
          ? { top: '0', bottom: '0', left: '0', width: `${percent.value}%` }
          : { left: '0', right: '0', bottom: '0', height: `${percent.value}%` }),
      }
    })

    const thumbStyle = computed<Record<string, string>>(() => {
      const horiz = isHorizontal.value
      return {
        position: 'absolute',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'var(--iris-background)',
        border: '2px solid var(--iris-primary)',
        boxShadow: dragging.value
          ? '0 0 0 4px rgba(99, 102, 241, 0.18)'
          : '0 1px 2px rgba(0,0,0,.15)',
        cursor: props.disabled ? 'not-allowed' : 'grab',
        transition: 'box-shadow 120ms ease',
        touchAction: 'none',
        ...(horiz
          ? { top: '50%', left: `${percent.value}%`, transform: 'translate(-50%, -50%)' }
          : { left: '50%', bottom: `${percent.value}%`, transform: 'translate(-50%, 50%)' }),
      }
    })

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-slider': '',
          'data-iris-slider-orientation': props.orientation,
          'data-state': props.disabled ? 'disabled' : dragging.value ? 'dragging' : 'idle',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            ...(isHorizontal.value ? { width: '100%', padding: '8px 0' } : { padding: '0 8px' }),
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        h(
          'div',
          {
            ref: (el: unknown) => {
              trackRef.value = (el ?? null) as HTMLElement | null
            },
            'data-iris-slider-track': '',
            style: trackStyle.value,
            onClick: onTrackClick,
          },
          [
            h('div', { 'data-iris-slider-fill': '', style: fillStyle.value }),
            h('div', {
              ref: (el: unknown) => {
                thumbRef.value = (el ?? null) as HTMLElement | null
              },
              'data-iris-slider-thumb': '',
              role: 'slider',
              'aria-label': props.label,
              'aria-valuemin': props.min,
              'aria-valuemax': props.max,
              'aria-valuenow': props.modelValue,
              'aria-orientation': props.orientation,
              'aria-disabled': props.disabled ? 'true' : undefined,
              tabindex: props.disabled ? -1 : 0,
              style: thumbStyle.value,
              onKeydown: onKeyDown,
            }),
          ],
        ),
      )
  },
})
