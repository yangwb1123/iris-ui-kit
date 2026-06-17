<script lang="ts">
  type ProgressCircleStatus = 'default' | 'success' | 'danger' | 'warning'

  const COLOR: Record<ProgressCircleStatus, string> = {
    default: 'var(--iris-primary)',
    success: 'var(--iris-success, #16a34a)',
    danger: 'var(--iris-danger)',
    warning: 'var(--iris-warning, #f59e0b)',
  }

  let {
    value,
    max = 100,
    size = 80,
    strokeWidth = 6,
    status = 'default',
    showLabel = true,
    format,
    ariaLabel,
    style,
    ...rest
  }: {
    value: number
    max?: number
    size?: number
    strokeWidth?: number
    status?: ProgressCircleStatus
    showLabel?: boolean
    format?: (percent: number) => string
    ariaLabel?: string
    style?: string
    [key: string]: unknown
  } = $props()

  const ratio = $derived(Math.max(0, Math.min(1, max > 0 ? value / max : 0)))
  const percent = $derived(Math.round(ratio * 100))
  const center = $derived(size / 2)
  const r = $derived((size - strokeWidth) / 2)
  const circumference = $derived(2 * Math.PI * r)
  const offset = $derived(circumference * (1 - ratio))
</script>

<div
  {...rest}
  data-iris-progress-circle
  data-status={status}
  role="progressbar"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuetext="{percent}%"
  aria-label={ariaLabel}
  style="position:relative; display:inline-flex; width:{size}px; height:{size}px;{style
    ? ' ' + style
    : ''}"
>
  <svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle
      cx={center}
      cy={center}
      {r}
      fill="none"
      stroke="var(--iris-border)"
      stroke-width={strokeWidth}
    />
    <circle
      data-iris-progress-circle-value
      cx={center}
      cy={center}
      {r}
      fill="none"
      stroke={COLOR[status]}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      transform="rotate(-90 {center} {center})"
      style="transition:stroke-dashoffset 200ms ease"
    />
  </svg>
  {#if showLabel}
    <span
      data-iris-progress-circle-label
      style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:{Math.round(
        size * 0.25,
      )}px; font-weight:600; color:var(--iris-foreground); font-variant-numeric:tabular-nums;"
    >
      {format ? format(percent) : `${percent}%`}
    </span>
  {/if}
</div>
