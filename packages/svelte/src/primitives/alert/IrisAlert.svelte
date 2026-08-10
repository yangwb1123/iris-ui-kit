<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type AlertTone = 'info' | 'success' | 'warning' | 'danger'

  const TONE_TO_VAR: Record<AlertTone, string> = {
    info: '--iris-info',
    success: '--iris-success',
    warning: '--iris-warning',
    danger: '--iris-danger',
  }

  let {
    tone = 'info' as AlertTone,
    title = '',
    closable = false,
    open = undefined as boolean | undefined,
    onclose,
    style,
    children,
    icon,
    titleSlot,
    ...rest
  } = $props()

  // svelte-ignore state_referenced_locally
  let internalOpen = $state(true)
  const isControlled = $derived(open !== undefined)
  const isOpen = $derived(isControlled ? Boolean(open) : internalOpen)

  function handleClose() {
    if (!isControlled) internalOpen = false
    onclose?.()
  }

  const tonalVar = $derived(`var(${TONE_TO_VAR[tone as AlertTone]})`)

  const containerStyle = $derived(
    styleToString({
      display: 'flex',
      gap: 'var(--iris-gap-md, 12px)',
      padding: 'var(--iris-padding-md, 12px)',
      'border-radius': 'var(--iris-radius-md, 6px)',
      border: `1px solid ${tonalVar}`,
      // `background-color` is the precomputed fallback under color-mix (engines
      // without it); the `background` shorthand overrides with the exact mix.
      'background-color': `var(${TONE_TO_VAR[tone as AlertTone]}-subtle)`,
      background: `color-mix(in srgb, ${tonalVar} 10%, var(--iris-background))`,
      color: 'var(--iris-foreground)',
      'align-items': 'flex-start',
    }),
  )
</script>

{#if isOpen}
  <div
    {...rest}
    role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    data-iris-alert
    data-iris-alert-tone={tone}
    style={mergeStyle(containerStyle, style)}
  >
    {#if icon}
      <span data-iris-alert-icon style="color: {tonalVar}; flex-shrink: 0; display: inline-flex">
        {@render icon()}
      </span>
    {/if}
    <div data-iris-alert-body style="flex: 1; min-width: 0">
      {#if title || titleSlot}
        <div data-iris-alert-title style="font-weight: 600; margin-bottom: 4px; color: {tonalVar}">
          {#if titleSlot}
            {@render titleSlot()}
          {:else}
            {title}
          {/if}
        </div>
      {/if}
      <div data-iris-alert-content>
        {@render children?.()}
      </div>
    </div>
    {#if closable}
      <button
        type="button"
        data-iris-alert-close
        aria-label={t('alert.close')}
        onclick={handleClose}
        style="background: transparent; border: none; cursor: pointer; color: var(--iris-muted); font-size: var(--iris-font-size-lg, 16px); padding: 0; line-height: 1; flex-shrink: 0"
      >
        ✕
      </button>
    {/if}
  </div>
{/if}
