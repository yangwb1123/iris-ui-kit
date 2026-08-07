import { defineComponent, h, type PropType } from 'vue'

export type IrisStatisticSize = 'sm' | 'md' | 'lg'
export type IrisStatisticTrend = 'up' | 'down' | 'neutral'

const VALUE_FONT: Record<IrisStatisticSize, number> = { sm: 20, md: 28, lg: 36 }
const TREND_COLOR: Record<IrisStatisticTrend, string> = {
  up: 'var(--iris-success, #10b981)',
  down: 'var(--iris-danger)',
  neutral: 'var(--iris-muted)',
}
const TREND_ARROW: Record<IrisStatisticTrend, string> = { up: '▲', down: '▼', neutral: '' }

/**
 * Compact statistic / KPI display: a label, a prominent value (with optional
 * prefix/suffix), an optional colored trend line, and a description. The trend
 * glyph is decorative (aria-hidden) — the magnitude text carries the meaning.
 */
export const IrisStatistic = defineComponent({
  name: 'IrisStatistic',
  inheritAttrs: false,
  props: {
    label: { type: [String, Number], default: undefined },
    value: { type: [String, Number], default: '' },
    prefix: { type: [String, Number], default: undefined },
    suffix: { type: [String, Number], default: undefined },
    description: { type: [String, Number], default: undefined },
    trend: { type: String as PropType<IrisStatisticTrend>, default: undefined },
    trendValue: { type: [String, Number], default: undefined },
    size: { type: String as PropType<IrisStatisticSize>, default: 'md' },
  },
  setup(props, { attrs }) {
    const affix = { fontSize: '0.6em', color: 'var(--iris-muted)' }
    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-statistic': '',
          'data-trend': props.trend,
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          props.label != null
            ? h(
                'div',
                {
                  'data-iris-statistic-label': '',
                  style: { fontSize: 'var(--iris-font-size-sm, 13px)', color: 'var(--iris-muted)' },
                },
                String(props.label),
              )
            : null,
          h(
            'div',
            {
              'data-iris-statistic-value': '',
              style: {
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '4px',
                fontSize: `${VALUE_FONT[props.size]}px`,
                fontWeight: '600',
                color: 'var(--iris-foreground)',
                fontVariantNumeric: 'tabular-nums',
              },
            },
            [
              props.prefix != null
                ? h(
                    'span',
                    { 'data-iris-statistic-prefix': '', style: affix },
                    String(props.prefix),
                  )
                : null,
              h('span', { 'data-iris-statistic-number': '' }, String(props.value)),
              props.suffix != null
                ? h(
                    'span',
                    { 'data-iris-statistic-suffix': '', style: affix },
                    String(props.suffix),
                  )
                : null,
            ],
          ),
          props.trend != null || props.trendValue != null
            ? h(
                'div',
                {
                  'data-iris-statistic-trend': '',
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    color: props.trend ? TREND_COLOR[props.trend] : 'var(--iris-muted)',
                  },
                },
                [
                  props.trend && TREND_ARROW[props.trend]
                    ? h('span', { 'aria-hidden': 'true' }, TREND_ARROW[props.trend])
                    : null,
                  props.trendValue != null
                    ? h('span', { 'data-iris-statistic-trend-value': '' }, String(props.trendValue))
                    : null,
                ],
              )
            : null,
          props.description != null
            ? h(
                'div',
                {
                  'data-iris-statistic-desc': '',
                  style: { fontSize: 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' },
                },
                String(props.description),
              )
            : null,
        ],
      )
  },
})
