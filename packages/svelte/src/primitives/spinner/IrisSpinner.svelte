<script lang="ts">
  import { installSpinnerStyles } from './styles'
  import { mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type SpinnerSize = 'sm' | 'md' | 'lg' | number

  const SIZE_MAP: Record<Exclude<SpinnerSize, number>, number> = {
    sm: 14,
    md: 18,
    lg: 24,
  }

  function resolveSize(s: SpinnerSize): number {
    return typeof s === 'number' ? s : SIZE_MAP[s]
  }

  let {
    size = 'md' as SpinnerSize,
    color = 'var(--iris-primary)',
    strokeWidth = 0,
    label = undefined as string | undefined,
    style,
    ...rest
  } = $props()

  const px = $derived(resolveSize(size))
  const sw = $derived(strokeWidth || Math.max(1.5, Math.round(px * 0.12)))
  const resolvedLabel = $derived(label ?? t('spinner.loading'))

  $effect(() => {
    installSpinnerStyles()
  })
</script>

<span
  {...rest}
  role="status"
  aria-live="polite"
  data-iris-spinner-wrap
  style={mergeStyle('display: inline-flex; align-items: center', style)}
>
  <svg
    data-iris-spinner
    width={px}
    height={px}
    viewBox="0 0 50 50"
    aria-hidden="true"
    focusable="false"
    style="color: {color}"
  >
    <circle cx="25" cy="25" r="20" stroke="currentColor" stroke-width={sw} />
  </svg>
  {#if resolvedLabel}
    <span
      style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0"
    >
      {resolvedLabel}
    </span>
  {/if}
</span>
