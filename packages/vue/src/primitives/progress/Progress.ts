import { computed, defineComponent, h, onMounted, type PropType } from 'vue'
import { installProgressStyles } from './styles'

export type IrisProgressTone = 'primary' | 'success' | 'warning' | 'danger'
export type IrisProgressSize = 'sm' | 'md'

const TONE_TO_VAR: Record<IrisProgressTone, string> = {
  primary: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
}

const HEIGHT_MAP: Record<IrisProgressSize, string> = {
  sm: '4px',
  md: '8px',
}

/**
 * Linear progress bar with two modes:
 *
 *   - **Determinate** — pass `value` (and optionally `max`). Width interpolates
 *     smoothly between renders. `aria-valuenow` is set.
 *   - **Indeterminate** — pass `indeterminate` or leave `value` as `null`.
 *     A continuous slide animation runs; `aria-valuenow` is omitted.
 *
 * Honors `prefers-reduced-motion`: indeterminate becomes a static half-bar.
 */
export const IrisProgress = defineComponent({
  name: 'IrisProgress',
  inheritAttrs: false,
  props: {
    value: { type: Number, default: null as number | null },
    max: { type: Number, default: 100 },
    indeterminate: { type: Boolean, default: false },
    tone: { type: String as PropType<IrisProgressTone>, default: 'primary' },
    size: { type: String as PropType<IrisProgressSize>, default: 'md' },
  },
  setup(props, { attrs }) {
    onMounted(installProgressStyles)

    const isIndeterminate = computed(
      () => props.indeterminate || props.value === null || props.value === undefined,
    )

    const clamped = computed(() => {
      if (isIndeterminate.value || props.value === null) return 0
      return Math.max(0, Math.min(props.max, props.value))
    })
    const percent = computed(() =>
      isIndeterminate.value ? 0 : (clamped.value / Math.max(1, props.max)) * 100,
    )

    const containerStyle = computed<Record<string, string>>(() => ({
      width: '100%',
      height: HEIGHT_MAP[props.size],
    }))

    const barStyle = computed<Record<string, string>>(() => ({
      background: `var(${TONE_TO_VAR[props.tone]})`,
      width: isIndeterminate.value ? 'auto' : `${percent.value}%`,
    }))

    return () =>
      h(
        'div',
        {
          ...attrs,
          role: 'progressbar',
          'aria-valuemin': 0,
          'aria-valuemax': props.max,
          'aria-valuenow': isIndeterminate.value ? undefined : clamped.value,
          'data-iris-progress': '',
          'data-state': isIndeterminate.value ? 'indeterminate' : 'determinate',
          'data-iris-progress-tone': props.tone,
          'data-iris-progress-size': props.size,
          style: { ...containerStyle.value, ...((attrs.style as Record<string, string>) ?? {}) },
        },
        h('div', { 'data-iris-progress-bar': '', style: barStyle.value }),
      )
  },
})
