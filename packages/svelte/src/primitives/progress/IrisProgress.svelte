<script lang="ts">
  type ProgressTone = 'primary' | 'success' | 'warning' | 'danger'
  type ProgressSize = 'sm' | 'md'

  const TONE_TO_VAR: Record<ProgressTone, string> = {
    primary: '--iris-primary',
    success: '--iris-success',
    warning: '--iris-warning',
    danger: '--iris-danger',
  }

  const HEIGHT_MAP: Record<ProgressSize, string> = { sm: '4px', md: '8px' }

  let {
    value = null,
    max = 100,
    indeterminate = false,
    tone = 'primary',
    size = 'md',
    style,
    ...rest
  }: {
    value?: number | null
    max?: number
    indeterminate?: boolean
    tone?: ProgressTone
    size?: ProgressSize
    style?: string
    [key: string]: unknown
  } = $props()

  const isIndeterminate = $derived(indeterminate || value === null || value === undefined)
  const clamped = $derived(isIndeterminate || value === null ? 0 : Math.max(0, Math.min(max, value)))
  const percent = $derived(isIndeterminate ? 0 : (clamped / Math.max(1, max)) * 100)

  const containerStyle = $derived(
    `width:100%; height:${HEIGHT_MAP[size]}; background:var(--iris-border); border-radius:999px; overflow:hidden;${style ? ' ' + style : ''}`,
  )

  const barStyle = $derived(
    isIndeterminate
      ? `background:var(${TONE_TO_VAR[tone]}); width:40%; animation:iris-progress-indeterminate 1.4s ease infinite; height:100%; border-radius:999px;`
      : `background:var(${TONE_TO_VAR[tone]}); width:${percent}%; height:100%; border-radius:999px; transition:width 200ms ease;`,
  )
</script>

<svelte:head>
  <style>
    @keyframes iris-progress-indeterminate {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }
    @media (prefers-reduced-motion: reduce) {
      @keyframes iris-progress-indeterminate {
        0%, 100% { transform: translateX(0); }
      }
    }
  </style>
</svelte:head>

<div
  {...rest}
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={isIndeterminate ? undefined : clamped}
  data-iris-progress
  data-state={isIndeterminate ? 'indeterminate' : 'determinate'}
  data-iris-progress-tone={tone}
  data-iris-progress-size={size}
  style={containerStyle}
>
  <div data-iris-progress-bar style={barStyle}></div>
</div>
