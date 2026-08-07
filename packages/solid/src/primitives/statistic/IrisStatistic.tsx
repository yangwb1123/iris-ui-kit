import { mergeProps, Show, splitProps, type JSX } from 'solid-js'

export type IrisStatisticSize = 'sm' | 'md' | 'lg'
export type IrisStatisticTrend = 'up' | 'down' | 'neutral'

const VALUE_FONT: Record<IrisStatisticSize, number> = { sm: 20, md: 28, lg: 36 }
const TREND_COLOR: Record<IrisStatisticTrend, string> = {
  up: 'var(--iris-success, #10b981)',
  down: 'var(--iris-danger)',
  neutral: 'var(--iris-muted)',
}
const TREND_ARROW: Record<IrisStatisticTrend, string> = { up: '▲', down: '▼', neutral: '' }

export interface IrisStatisticProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'prefix'> {
  label?: string | number
  value?: string | number
  prefix?: string | number
  suffix?: string | number
  description?: string | number
  trend?: IrisStatisticTrend
  trendValue?: string | number
  size?: IrisStatisticSize
}

/**
 * Compact statistic / KPI display: label, prominent value with optional
 * prefix/suffix, optional trend indicator, and description.
 */
export function IrisStatistic(props: IrisStatisticProps): JSX.Element {
  const merged = mergeProps({ value: '', size: 'md' as IrisStatisticSize }, props)
  const [local, rest] = splitProps(merged, [
    'label',
    'value',
    'prefix',
    'suffix',
    'description',
    'trend',
    'trendValue',
    'size',
    'style',
  ])

  const affix: JSX.CSSProperties = { 'font-size': '0.6em', color: 'var(--iris-muted)' }

  return (
    <div
      {...rest}
      data-iris-statistic=""
      data-trend={local.trend}
      style={{
        display: 'flex',
        'flex-direction': 'column',
        gap: '4px',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <Show when={local.label != null}>
        <div
          data-iris-statistic-label=""
          style={{ 'font-size': 'var(--iris-font-size-sm, 13px)', color: 'var(--iris-muted)' }}
        >
          {String(local.label)}
        </div>
      </Show>
      <div
        data-iris-statistic-value=""
        style={{
          display: 'inline-flex',
          'align-items': 'baseline',
          gap: '4px',
          'font-size': `${VALUE_FONT[local.size]}px`,
          'font-weight': '600',
          color: 'var(--iris-foreground)',
          'font-variant-numeric': 'tabular-nums',
        }}
      >
        <Show when={local.prefix != null}>
          <span data-iris-statistic-prefix="" style={affix}>
            {String(local.prefix)}
          </span>
        </Show>
        <span data-iris-statistic-number="">{String(local.value)}</span>
        <Show when={local.suffix != null}>
          <span data-iris-statistic-suffix="" style={affix}>
            {String(local.suffix)}
          </span>
        </Show>
      </div>
      <Show when={local.trend != null || local.trendValue != null}>
        <div
          data-iris-statistic-trend=""
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            gap: '4px',
            'font-size': 'var(--iris-font-size-sm, 13px)',
            color: local.trend ? TREND_COLOR[local.trend] : 'var(--iris-muted)',
          }}
        >
          <Show when={local.trend && TREND_ARROW[local.trend]}>
            <span aria-hidden="true">{TREND_ARROW[local.trend!]}</span>
          </Show>
          <Show when={local.trendValue != null}>
            <span data-iris-statistic-trend-value="">{String(local.trendValue)}</span>
          </Show>
        </div>
      </Show>
      <Show when={local.description != null}>
        <div
          data-iris-statistic-desc=""
          style={{ 'font-size': 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' }}
        >
          {String(local.description)}
        </div>
      </Show>
    </div>
  )
}
