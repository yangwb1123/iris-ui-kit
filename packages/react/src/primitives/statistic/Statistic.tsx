import * as React from 'react'

export type IrisStatisticSize = 'sm' | 'md' | 'lg'
export type IrisStatisticTrend = 'up' | 'down' | 'neutral'

export interface IrisStatisticProps {
  label?: React.ReactNode
  value: React.ReactNode
  /** Rendered before the value (e.g. a currency sign). */
  prefix?: React.ReactNode
  /** Rendered after the value (e.g. a unit). */
  suffix?: React.ReactNode
  description?: React.ReactNode
  /** Trend direction — colors the trend line and shows a ▲/▼ glyph. */
  trend?: IrisStatisticTrend
  /** Trend magnitude text (e.g. "12%"). */
  trendValue?: React.ReactNode
  size?: IrisStatisticSize
  style?: React.CSSProperties
  className?: string
}

const VALUE_FONT: Record<IrisStatisticSize, number> = { sm: 20, md: 28, lg: 36 }
const TREND_COLOR: Record<IrisStatisticTrend, string> = {
  up: 'var(--iris-success, #10b981)',
  down: 'var(--iris-danger)',
  neutral: 'var(--iris-muted)',
}
const TREND_ARROW: Record<IrisStatisticTrend, string> = { up: '▲', down: '▼', neutral: '' }

/**
 * Compact statistic / KPI display: a label, a prominent value (with optional
 * prefix/suffix), an optional colored trend line, and a description. Pure
 * presentation; the trend glyph is decorative (aria-hidden) — the magnitude
 * text carries the meaning.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisStatistic}.
 */
export function IrisStatistic({
  label,
  value,
  prefix,
  suffix,
  description,
  trend,
  trendValue,
  size = 'md',
  style,
  className,
  ...rest
}: IrisStatisticProps): React.ReactElement {
  const affix: React.CSSProperties = { fontSize: '0.6em', color: 'var(--iris-muted)' }
  return (
    <div
      data-iris-statistic=""
      data-trend={trend}
      className={className}
      {...rest}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}
    >
      {label != null ? (
        <div
          data-iris-statistic-label=""
          style={{ fontSize: 'var(--iris-font-size-sm, 13px)', color: 'var(--iris-muted)' }}
        >
          {label}
        </div>
      ) : null}
      <div
        data-iris-statistic-value=""
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 4,
          fontSize: VALUE_FONT[size],
          fontWeight: 600,
          color: 'var(--iris-foreground)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {prefix != null ? (
          <span data-iris-statistic-prefix="" style={affix}>
            {prefix}
          </span>
        ) : null}
        <span data-iris-statistic-number="">{value}</span>
        {suffix != null ? (
          <span data-iris-statistic-suffix="" style={affix}>
            {suffix}
          </span>
        ) : null}
      </div>
      {trend != null || trendValue != null ? (
        <div
          data-iris-statistic-trend=""
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: trend ? TREND_COLOR[trend] : 'var(--iris-muted)',
          }}
        >
          {trend && TREND_ARROW[trend] ? (
            <span aria-hidden="true">{TREND_ARROW[trend]}</span>
          ) : null}
          {trendValue != null ? <span data-iris-statistic-trend-value="">{trendValue}</span> : null}
        </div>
      ) : null}
      {description != null ? (
        <div
          data-iris-statistic-desc=""
          style={{ fontSize: 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' }}
        >
          {description}
        </div>
      ) : null}
    </div>
  )
}
