import * as React from 'react'

export type IrisGaugeStatus = 'default' | 'success' | 'danger' | 'warning'

export interface IrisGaugeProps {
  value: number
  min?: number
  max?: number
  /** Diameter in px. */
  size?: number
  strokeWidth?: number
  status?: IrisGaugeStatus
  showValue?: boolean
  /** Custom center label given the value and rounded percent. */
  format?: (value: number, percent: number) => React.ReactNode
  ariaLabel?: string
  style?: React.CSSProperties
  className?: string
}

const COLOR: Record<IrisGaugeStatus, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #16a34a)',
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning, #f59e0b)',
}

/**
 * Semicircular arc gauge built from a structured SVG — a 180° track arc plus a
 * value arc whose `stroke-dashoffset` encodes `(value − min) / (max − min)`.
 * Distinct from the full-ring `IrisProgressCircle`.
 *
 * React port of {@link import('@iris-ui/vue').IrisGauge}.
 */
export function IrisGauge({
  value,
  min = 0,
  max = 100,
  size = 120,
  strokeWidth = 10,
  status = 'default',
  showValue = true,
  format,
  ariaLabel,
  style,
  className,
}: IrisGaugeProps): React.ReactElement {
  const span = max - min
  const ratio = Math.max(0, Math.min(1, span > 0 ? (value - min) / span : 0))
  const percent = Math.round(ratio * 100)
  const mid = size / 2
  const r = (size - strokeWidth) / 2
  const arc = Math.PI * r
  const offset = arc * (1 - ratio)
  const d = `M ${strokeWidth / 2} ${mid} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${mid}`
  const height = size / 2 + strokeWidth / 2

  return (
    <div
      data-iris-gauge=""
      data-status={status}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`${percent}%`}
      aria-label={ariaLabel}
      className={className}
      style={{ position: 'relative', display: 'inline-block', width: size, ...style }}
    >
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden="true">
        <path
          d={d}
          fill="none"
          stroke="var(--iris-border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          data-iris-gauge-value=""
          d={d}
          fill="none"
          stroke={COLOR[status]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 200ms ease' }}
        />
      </svg>
      {showValue ? (
        <div
          data-iris-gauge-label=""
          style={{
            position: 'absolute',
            insetBlockEnd: 0,
            insetInlineStart: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: Math.round(size * 0.18),
            fontWeight: 600,
            color: 'var(--iris-foreground)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {format ? format(value, percent) : `${percent}%`}
        </div>
      ) : null}
    </div>
  )
}
