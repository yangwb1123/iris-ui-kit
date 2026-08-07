import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisGaugeStatus = 'default' | 'success' | 'danger' | 'warning'

const COLOR: Record<IrisGaugeStatus, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #10b981)',
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning, #f59e0b)',
}

export interface IrisGaugeProps {
  value: number
  min?: number
  max?: number
  /** Diameter in px */
  size?: number
  strokeWidth?: number
  status?: IrisGaugeStatus
  showValue?: boolean
  format?: (value: number, percent: number) => string
  ariaLabel?: string
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Semicircular arc gauge. Solid port of the Vue/React IrisGauge.
 */
export function IrisGauge(props: IrisGaugeProps): JSX.Element {
  const merged = mergeProps(
    {
      min: 0,
      max: 100,
      size: 120,
      strokeWidth: 10,
      status: 'default' as IrisGaugeStatus,
      showValue: true,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'min',
    'max',
    'size',
    'strokeWidth',
    'status',
    'showValue',
    'format',
    'ariaLabel',
  ])

  const span = (): number => local.max - local.min
  const ratio = (): number =>
    Math.max(0, Math.min(1, span() > 0 ? (local.value - local.min) / span() : 0))
  const percent = (): number => Math.round(ratio() * 100)
  const mid = (): number => local.size / 2
  const r = (): number => (local.size - local.strokeWidth) / 2
  const arc = (): number => Math.PI * r()
  const offset = (): number => arc() * (1 - ratio())
  const height = (): number => local.size / 2 + local.strokeWidth / 2
  const d = (): string =>
    `M ${local.strokeWidth / 2} ${mid()} A ${r()} ${r()} 0 0 1 ${local.size - local.strokeWidth / 2} ${mid()}`

  return (
    <div
      {...rest}
      data-iris-gauge=""
      data-status={local.status}
      role="meter"
      aria-valuenow={local.value}
      aria-valuemin={local.min}
      aria-valuemax={local.max}
      aria-valuetext={
        local.min === 0 && local.max === 100 ? `${percent()}%` : `${local.value} (${percent()}%)`
      }
      aria-label={local.ariaLabel}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: `${local.size}px`,
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <svg
        width={local.size}
        height={height()}
        viewBox={`0 0 ${local.size} ${height()}`}
        aria-hidden="true"
      >
        <path
          d={d()}
          fill="none"
          stroke="var(--iris-border)"
          stroke-width={local.strokeWidth}
          stroke-linecap="round"
        />
        <path
          data-iris-gauge-value=""
          d={d()}
          fill="none"
          stroke={COLOR[local.status]}
          stroke-width={local.strokeWidth}
          stroke-linecap="round"
          stroke-dasharray={String(arc())}
          stroke-dashoffset={String(offset())}
          style={{ transition: 'stroke-dashoffset 200ms ease' }}
        />
      </svg>
      {local.showValue && (
        <div
          data-iris-gauge-label=""
          style={{
            position: 'absolute',
            'inset-block-end': '0',
            'inset-inline-start': '0',
            width: '100%',
            'text-align': 'center',
            'font-size': `${Math.round(local.size * 0.18)}px`,
            'font-weight': '600',
            color: 'var(--iris-foreground)',
            'font-variant-numeric': 'tabular-nums',
          }}
        >
          {local.format
            ? local.format(local.value, percent())
            : local.min === 0 && local.max === 100
              ? `${percent()}%`
              : String(local.value)}
        </div>
      )}
    </div>
  )
}
