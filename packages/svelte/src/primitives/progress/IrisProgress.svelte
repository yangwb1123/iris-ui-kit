<script lang="ts">
  import { PROGRESS_INDETERMINATE_ANIMATION } from '@iris-ui-kit/core'
  import { onMount } from 'svelte'
  import { installProgressStyles } from './styles'

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

  onMount(installProgressStyles)

  const isIndeterminate = $derived(indeterminate || value === null || value === undefined)
  const clamped = $derived(
    isIndeterminate || value === null ? 0 : Math.max(0, Math.min(max, value)),
  )
  const percent = $derived(isIndeterminate ? 0 : (clamped / Math.max(1, max)) * 100)

  const containerStyle = $derived(
    `width:100%; height:${HEIGHT_MAP[size]}; background:var(--iris-border); border-radius:999px; overflow:hidden;${style ? ' ' + style : ''}`,
  )

  const barStyle = $derived(
    isIndeterminate
      ? `background:var(${TONE_TO_VAR[tone]}); width:40%; animation:${PROGRESS_INDETERMINATE_ANIMATION}; height:100%; border-radius:999px;`
      : `background:var(${TONE_TO_VAR[tone]}); width:${percent}%; height:100%; border-radius:999px; transition:width 200ms ease;`,
  )
</script>

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
