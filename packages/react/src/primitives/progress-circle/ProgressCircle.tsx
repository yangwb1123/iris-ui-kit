import * as React from 'react'

export type IrisProgressCircleStatus = 'default' | 'success' | 'danger' | 'warning'

export interface IrisProgressCircleProps {
  value: number
  max?: number
  /** Diameter in px. */
  size?: number
  strokeWidth?: number
  status?: IrisProgressCircleStatus
  showLabel?: boolean
  /** Custom center label given the rounded percent. */
  format?: (percent: number) => React.ReactNode
  ariaLabel?: string
  style?: React.CSSProperties
  className?: string
}

const COLOR: Record<IrisProgressCircleStatus, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #16a34a)',
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning, #f59e0b)',
}

/**
 * Circular (ring) progress indicator built from a structured SVG — a track
 * circle plus a value circle whose `stroke-dashoffset` encodes the ratio. An
 * optional centered percent label sits on top. Distinct from the linear
 * `IrisProgress`.
 *
 * React port of {@link import('@iris-ui/vue').IrisProgressCircle}.
 */
export function IrisProgressCircle({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  status = 'default',
  showLabel = true,
  format,
  ariaLabel,
  style,
  className,
}: IrisProgressCircleProps): React.ReactElement {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0))
  const percent = Math.round(ratio * 100)
  const center = size / 2
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - ratio)

  return (
    <div
      data-iris-progress-circle=""
      data-status={status}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${percent}%`}
      aria-label={ariaLabel}
      className={className}
      style={{ position: 'relative', display: 'inline-flex', width: size, height: size, ...style }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--iris-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          data-iris-progress-circle-value=""
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={COLOR[status]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 200ms ease' }}
        />
      </svg>
      {showLabel ? (
        <span
          data-iris-progress-circle-label=""
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.25),
            fontWeight: 600,
            color: 'var(--iris-foreground)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {format ? format(percent) : `${percent}%`}
        </span>
      ) : null}
    </div>
  )
}
