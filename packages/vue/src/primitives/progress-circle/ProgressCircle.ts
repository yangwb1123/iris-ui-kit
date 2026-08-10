import { defineComponent, h, type PropType } from 'vue'

export type IrisProgressCircleStatus = 'default' | 'success' | 'danger' | 'warning'

const COLOR: Record<IrisProgressCircleStatus, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #10b981)',
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning, #f59e0b)',
}

/**
 * Circular (ring) progress indicator built from a structured SVG — a track
 * circle plus a value circle whose `stroke-dashoffset` encodes the ratio. An
 * optional centered percent label sits on top. Distinct from the linear
 * `IrisProgress`.
 */
export const IrisProgressCircle = defineComponent({
  name: 'IrisProgressCircle',
  inheritAttrs: false,
  props: {
    value: { type: Number, required: true },
    max: { type: Number, default: 100 },
    /** Diameter in px. */
    size: { type: Number, default: 80 },
    strokeWidth: { type: Number, default: 6 },
    status: { type: String as PropType<IrisProgressCircleStatus>, default: 'default' },
    showLabel: { type: Boolean, default: true },
    /** Custom center label given the rounded percent. */
    format: { type: Function as PropType<(percent: number) => string>, default: undefined },
    ariaLabel: { type: String, default: undefined },
  },
  setup(props, { attrs }) {
    return () => {
      const ratio = Math.max(0, Math.min(1, props.max > 0 ? props.value / props.max : 0))
      const percent = Math.round(ratio * 100)
      const center = props.size / 2
      const r = (props.size - props.strokeWidth) / 2
      const circumference = 2 * Math.PI * r
      const offset = circumference * (1 - ratio)

      return h(
        'div',
        {
          ...attrs,
          'data-iris-progress-circle': '',
          'data-status': props.status,
          role: 'progressbar',
          'aria-valuenow': props.value,
          'aria-valuemin': 0,
          'aria-valuemax': props.max,
          'aria-valuetext': `${percent}%`,
          'aria-label': props.ariaLabel,
          style: {
            position: 'relative',
            display: 'inline-flex',
            width: `${props.size}px`,
            height: `${props.size}px`,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'svg',
            {
              width: props.size,
              height: props.size,
              viewBox: `0 0 ${props.size} ${props.size}`,
              'aria-hidden': 'true',
            },
            [
              h('circle', {
                cx: center,
                cy: center,
                r,
                fill: 'none',
                stroke: 'var(--iris-border)',
                'stroke-width': props.strokeWidth,
              }),
              h('circle', {
                'data-iris-progress-circle-value': '',
                cx: center,
                cy: center,
                r,
                fill: 'none',
                stroke: COLOR[props.status],
                'stroke-width': props.strokeWidth,
                'stroke-linecap': 'round',
                'stroke-dasharray': circumference,
                'stroke-dashoffset': offset,
                transform: `rotate(-90 ${center} ${center})`,
                style: { transition: 'stroke-dashoffset 200ms ease' },
              }),
            ],
          ),
          props.showLabel
            ? h(
                'span',
                {
                  'data-iris-progress-circle-label': '',
                  style: {
                    position: 'absolute',
                    inset: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${Math.round(props.size * 0.25)}px`,
                    fontWeight: '600',
                    color: 'var(--iris-foreground)',
                    fontVariantNumeric: 'tabular-nums',
                  },
                },
                props.format ? props.format(percent) : `${percent}%`,
              )
            : null,
        ],
      )
    }
  },
})
