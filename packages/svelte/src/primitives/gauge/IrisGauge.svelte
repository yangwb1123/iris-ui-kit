<script lang="ts">
  type GaugeStatus = 'default' | 'success' | 'danger' | 'warning'

  const COLOR: Record<GaugeStatus, string> = {
    default: 'var(--iris-primary)',
    success: 'var(--iris-success, #16a34a)',
    danger: 'var(--iris-danger)',
    warning: 'var(--iris-warning, #f59e0b)',
  }

  let {
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
    ...rest
  }: {
    value: number
    min?: number
    max?: number
    size?: number
    strokeWidth?: number
    status?: GaugeStatus
    showValue?: boolean
    format?: (value: number, percent: number) => string
    ariaLabel?: string
    style?: string
    [key: string]: unknown
  } = $props()

  const span = $derived(max - min)
  const ratio = $derived(Math.max(0, Math.min(1, span > 0 ? (value - min) / span : 0)))
  const percent = $derived(Math.round(ratio * 100))
  const mid = $derived(size / 2)
  const r = $derived((size - strokeWidth) / 2)
  const arc = $derived(Math.PI * r)
  const arcOffset = $derived(arc * (1 - ratio))
  const pathD = $derived(
    `M ${strokeWidth / 2} ${mid} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${mid}`,
  )
  const height = $derived(size / 2 + strokeWidth / 2)
</script>

<div
  {...rest}
  data-iris-gauge
  data-status={status}
  role="meter"
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuetext="{percent}%"
  aria-label={ariaLabel}
  style="position:relative; display:inline-block; width:{size}px;{style ? ' ' + style : ''}"
>
  <svg
    width={size}
    height={height}
    viewBox="0 0 {size} {height}"
    aria-hidden="true"
  >
    <path
      d={pathD}
      fill="none"
      stroke="var(--iris-border)"
      stroke-width={strokeWidth}
      stroke-linecap="round"
    />
    <path
      data-iris-gauge-value
      d={pathD}
      fill="none"
      stroke={COLOR[status]}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-dasharray={arc}
      stroke-dashoffset={arcOffset}
      style="transition:stroke-dashoffset 200ms ease"
    />
  </svg>
  {#if showValue}
    <div
      data-iris-gauge-label
      style="position:absolute; inset-block-end:0; inset-inline-start:0; width:100%; text-align:center; font-size:{Math.round(size * 0.18)}px; font-weight:600; color:var(--iris-foreground); font-variant-numeric:tabular-nums;"
    >
      {format ? format(value, percent) : `${percent}%`}
    </div>
  {/if}
</div>
