import { computed, defineComponent, h, ref, type PropType } from 'vue'
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

/**
 * Two-handle numeric range slider. `modelValue` is `[start, end]` with
 * `start <= end`. The two handles never cross (each clamps against the other).
 *
 * Keyboard (per handle):
 *   - ←/↓  : −step
 *   - →/↑  : +step
 *   - Home : min (start) / start (end)
 *   - End  : end (start) / max (end)
 *   - PgUp/PgDn : ±step × 10
 */
export const IrisRangeSlider = defineComponent({
  name: 'IrisRangeSlider',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: Array as unknown as PropType<IrisRangeSliderValue>,
      default: () => [0, 100] as IrisRangeSliderValue,
    },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    /** Accessible label prefixes for screen readers. */
    labelStart: { type: String, default: 'Start' },
    labelEnd: { type: String, default: 'End' },
  },
  emits: {
    'update:modelValue': (_value: IrisRangeSliderValue) => true,
    change: (_value: IrisRangeSliderValue) => true,
  },
  setup(props, { attrs, emit }) {
    const trackRef = ref<HTMLElement | null>(null)
    const startThumbRef = ref<HTMLElement | null>(null)
    const endThumbRef = ref<HTMLElement | null>(null)
    const dragging = ref<'start' | 'end' | null>(null)

    const startVal = computed(() =>
      clamp(roundToStep(props.modelValue[0] ?? props.min, props.step, props.min), props.min, props.max),
    )
    const endVal = computed(() =>
      clamp(roundToStep(props.modelValue[1] ?? props.max, props.step, props.min), props.min, props.max),
    )

    const percent = (v: number): number => {
      const range = props.max - props.min
      if (range <= 0) return 0
      return ((v - props.min) / range) * 100
    }

    const updateAt = (handle: 'start' | 'end', next: number) => {
      const clamped = clamp(roundToStep(next, props.step, props.min), props.min, props.max)
      let s = startVal.value
      let e = endVal.value
      if (handle === 'start') {
        s = Math.min(clamped, e)
      } else {
        e = Math.max(clamped, s)
      }
      if (s === startVal.value && e === endVal.value) return
      const newValue: IrisRangeSliderValue = [s, e]
      emit('update:modelValue', newValue)
      emit('change', newValue)
    }

    const pointerValue = (clientX: number): number => {
      const track = trackRef.value
      if (!track) return startVal.value
      const rect = track.getBoundingClientRect()
      const rel = (clientX - rect.left) / Math.max(1, rect.width)
      return props.min + Math.max(0, Math.min(1, rel)) * (props.max - props.min)
    }

    useDrag({
      handle: startThumbRef,
      disabled: computed(() => props.disabled),
      onStart: () => {
        dragging.value = 'start'
      },
      onDrag: ({ x }) => {
        updateAt('start', pointerValue(x))
      },
      onEnd: () => {
        dragging.value = null
      },
    })
    useDrag({
      handle: endThumbRef,
      disabled: computed(() => props.disabled),
      onStart: () => {
        dragging.value = 'end'
      },
      onDrag: ({ x }) => {
        updateAt('end', pointerValue(x))
      },
      onEnd: () => {
        dragging.value = null
      },
    })

    const keyHandler = (handle: 'start' | 'end') => (event: KeyboardEvent) => {
      if (props.disabled) return
      const v = handle === 'start' ? startVal.value : endVal.value
      let next = v
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = v - props.step
          break
        case 'ArrowRight':
        case 'ArrowUp':
          next = v + props.step
          break
        case 'Home':
          next = handle === 'start' ? props.min : startVal.value
          break
        case 'End':
          next = handle === 'end' ? props.max : endVal.value
          break
        case 'PageDown':
          next = v - props.step * 10
          break
        case 'PageUp':
          next = v + props.step * 10
          break
        default:
          return
      }
      event.preventDefault()
      updateAt(handle, next)
    }

    return () => {
      const startPct = percent(startVal.value)
      const endPct = percent(endVal.value)
      return h(
        'div',
        {
          ...attrs,
          'data-iris-range-slider': '',
          'data-disabled': props.disabled ? '' : undefined,
          style: {
            position: 'relative',
            width: '100%',
            padding: '14px 8px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'div',
            {
              ref: (el: unknown) => {
                trackRef.value = (el ?? null) as HTMLElement | null
              },
              'data-iris-range-slider-track': '',
              style: {
                position: 'relative',
                height: '4px',
                background: 'var(--iris-border)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
              },
            },
            [
              h('div', {
                'data-iris-range-slider-range': '',
                style: {
                  position: 'absolute',
                  top: '0',
                  bottom: '0',
                  left: `${startPct}%`,
                  width: `${endPct - startPct}%`,
                  background: props.disabled ? 'var(--iris-muted)' : 'var(--iris-primary)',
                  borderRadius: 'inherit',
                },
              }),
              h('div', {
                ref: (el: unknown) => {
                  startThumbRef.value = (el ?? null) as HTMLElement | null
                },
                role: 'slider',
                tabindex: props.disabled ? -1 : 0,
                'aria-label': props.labelStart,
                'aria-valuemin': props.min,
                'aria-valuemax': endVal.value,
                'aria-valuenow': startVal.value,
                'aria-disabled': props.disabled ? 'true' : undefined,
                'data-iris-range-slider-thumb': 'start',
                'data-dragging': dragging.value === 'start' ? 'true' : undefined,
                onKeydown: keyHandler('start'),
                style: {
                  position: 'absolute',
                  top: '50%',
                  left: `${startPct}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--iris-background)',
                  border: `2px solid ${props.disabled ? 'var(--iris-muted)' : 'var(--iris-primary)'}`,
                  cursor: props.disabled ? 'not-allowed' : 'grab',
                  touchAction: 'none',
                  outline: 'none',
                },
              }),
              h('div', {
                ref: (el: unknown) => {
                  endThumbRef.value = (el ?? null) as HTMLElement | null
                },
                role: 'slider',
                tabindex: props.disabled ? -1 : 0,
                'aria-label': props.labelEnd,
                'aria-valuemin': startVal.value,
                'aria-valuemax': props.max,
                'aria-valuenow': endVal.value,
                'aria-disabled': props.disabled ? 'true' : undefined,
                'data-iris-range-slider-thumb': 'end',
                'data-dragging': dragging.value === 'end' ? 'true' : undefined,
                onKeydown: keyHandler('end'),
                style: {
                  position: 'absolute',
                  top: '50%',
                  left: `${endPct}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--iris-background)',
                  border: `2px solid ${props.disabled ? 'var(--iris-muted)' : 'var(--iris-primary)'}`,
                  cursor: props.disabled ? 'not-allowed' : 'grab',
                  touchAction: 'none',
                  outline: 'none',
                },
              }),
            ],
          ),
        ],
      )
    }
  },
})
