import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisProgressCircleStatus = 'default' | 'success' | 'danger' | 'warning'

const COLOR: Record<IrisProgressCircleStatus, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #16a34a)',
  danger: 'var(--iris-danger)',
  warning: 'var(--iris-warning, #f59e0b)',
}

export interface IrisProgressCircleProps {
  value: number
  max?: number
  /** Diameter in px */
  size?: number
  strokeWidth?: number
  status?: IrisProgressCircleStatus
  showLabel?: boolean
  format?: (percent: number) => string
  ariaLabel?: string
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Circular (ring) progress indicator. Solid port of the Vue/React IrisProgressCircle.
 */
export function IrisProgressCircle(props: IrisProgressCircleProps): JSX.Element {
  const merged = mergeProps(
    {
      max: 100,
      size: 80,
      strokeWidth: 6,
      status: 'default' as IrisProgressCircleStatus,
      showLabel: true,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'max',
    'size',
    'strokeWidth',
    'status',
    'showLabel',
    'format',
    'ariaLabel',
  ])

  const ratio = (): number => Math.max(0, Math.min(1, local.max > 0 ? local.value / local.max : 0))
  const percent = (): number => Math.round(ratio() * 100)
  const center = (): number => local.size / 2
  const r = (): number => (local.size - local.strokeWidth) / 2
  const circumference = (): number => 2 * Math.PI * r()
  const offset = (): number => circumference() * (1 - ratio())

  return (
    <div
      {...rest}
      data-iris-progress-circle=""
      data-status={local.status}
      role="progressbar"
      aria-valuenow={local.value}
      aria-valuemin={0}
      aria-valuemax={local.max}
      aria-valuetext={`${percent()}%`}
      aria-label={local.ariaLabel}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: `${local.size}px`,
        height: `${local.size}px`,
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <svg
        width={local.size}
        height={local.size}
        viewBox={`0 0 ${local.size} ${local.size}`}
        aria-hidden="true"
      >
        <circle
          cx={center()}
          cy={center()}
          r={r()}
          fill="none"
          stroke="var(--iris-border)"
          stroke-width={local.strokeWidth}
        />
        <circle
          data-iris-progress-circle-value=""
          cx={center()}
          cy={center()}
          r={r()}
          fill="none"
          stroke={COLOR[local.status]}
          stroke-width={local.strokeWidth}
          stroke-linecap="round"
          stroke-dasharray={String(circumference())}
          stroke-dashoffset={String(offset())}
          transform={`rotate(-90 ${center()} ${center()})`}
          style={{ transition: 'stroke-dashoffset 200ms ease' }}
        />
      </svg>
      {local.showLabel && (
        <span
          data-iris-progress-circle-label=""
          style={{
            position: 'absolute',
            inset: '0',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': `${Math.round(local.size * 0.25)}px`,
            'font-weight': '600',
            color: 'var(--iris-foreground)',
            'font-variant-numeric': 'tabular-nums',
          }}
        >
          {local.format ? local.format(percent()) : `${percent()}%`}
        </span>
      )}
    </div>
  )
}
