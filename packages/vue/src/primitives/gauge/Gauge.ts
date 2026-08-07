import { defineComponent, h, type PropType } from 'vue'

export type IrisGaugeStatus = 'default' | 'success' | 'danger' | 'warning'

const COLOR: Record<IrisGaugeStatus, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #10b981)',
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning, #f59e0b)',
}

/**
 * Semicircular arc gauge built from a structured SVG — a 180° track arc plus a
 * value arc whose `stroke-dashoffset` encodes `(value − min) / (max − min)`.
 * Distinct from the full-ring `IrisProgressCircle`.
 */
export const IrisGauge = defineComponent({
  name: 'IrisGauge',
  inheritAttrs: false,
  props: {
    value: { type: Number, required: true },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    /** Diameter in px. */
    size: { type: Number, default: 120 },
    strokeWidth: { type: Number, default: 10 },
    status: { type: String as PropType<IrisGaugeStatus>, default: 'default' },
    showValue: { type: Boolean, default: true },
    /** Custom center label given the value and rounded percent. */
    format: {
      type: Function as PropType<(value: number, percent: number) => string>,
      default: undefined,
    },
    ariaLabel: { type: String, default: undefined },
  },
  setup(props, { attrs }) {
    return () => {
      const span = props.max - props.min
      const ratio = Math.max(0, Math.min(1, span > 0 ? (props.value - props.min) / span : 0))
      const percent = Math.round(ratio * 100)
      const mid = props.size / 2
      const r = (props.size - props.strokeWidth) / 2
      const arc = Math.PI * r
      const offset = arc * (1 - ratio)
      const d = `M ${props.strokeWidth / 2} ${mid} A ${r} ${r} 0 0 1 ${props.size - props.strokeWidth / 2} ${mid}`
      const height = props.size / 2 + props.strokeWidth / 2

      return h(
        'div',
        {
          ...attrs,
          'data-iris-gauge': '',
          'data-status': props.status,
          role: 'meter',
          'aria-valuenow': props.value,
          'aria-valuemin': props.min,
          'aria-valuemax': props.max,
          'aria-valuetext': `${percent}%`,
          'aria-label': props.ariaLabel,
          style: {
            position: 'relative',
            display: 'inline-block',
            width: `${props.size}px`,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'svg',
            {
              width: props.size,
              height,
              viewBox: `0 0 ${props.size} ${height}`,
              'aria-hidden': 'true',
            },
            [
              h('path', {
                d,
                fill: 'none',
                stroke: 'var(--iris-border)',
                'stroke-width': props.strokeWidth,
                'stroke-linecap': 'round',
              }),
              h('path', {
                'data-iris-gauge-value': '',
                d,
                fill: 'none',
                stroke: COLOR[props.status],
                'stroke-width': props.strokeWidth,
                'stroke-linecap': 'round',
                'stroke-dasharray': arc,
                'stroke-dashoffset': offset,
                style: { transition: 'stroke-dashoffset 200ms ease' },
              }),
            ],
          ),
          props.showValue
            ? h(
                'div',
                {
                  'data-iris-gauge-label': '',
                  style: {
                    position: 'absolute',
                    insetBlockEnd: '0',
                    insetInlineStart: '0',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: `${Math.round(props.size * 0.18)}px`,
                    fontWeight: '600',
                    color: 'var(--iris-foreground)',
                    fontVariantNumeric: 'tabular-nums',
                  },
                },
                props.format ? props.format(props.value, percent) : `${percent}%`,
              )
            : null,
        ],
      )
    }
  },
})
