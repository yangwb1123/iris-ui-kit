<script lang="ts">
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type ChipVariant = 'solid' | 'outline' | 'subtle'
  type ChipTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  type ChipSize = 'sm' | 'md'

  const TONE_TO_VAR: Record<ChipTone, string> = {
    primary: '--iris-primary',
    success: '--iris-success',
    warning: '--iris-warning',
    danger: '--iris-danger',
    neutral: '--iris-muted',
  }

  function chipStyle(
    variant: ChipVariant,
    tone: ChipTone,
    size: ChipSize,
    clickable: boolean,
    disabled: boolean,
  ): string {
    const v = `var(${TONE_TO_VAR[tone]})`
    const base = `display:inline-flex; align-items:center; gap:6px; border-radius:9999px; font-family:var(--iris-font-family,inherit); font-weight:500; line-height:1; white-space:nowrap; cursor:${disabled ? 'not-allowed' : clickable ? 'pointer' : 'default'}; opacity:${disabled ? '0.6' : '1'}; transition:background-color 120ms ease,box-shadow 120ms ease; font-size:${size === 'sm' ? '11px' : '12px'}; padding:${size === 'sm' ? '3px 8px' : '4px 10px'}; user-select:none;`
    switch (variant) {
      case 'solid':
        return `${base} background:${v}; color:var(--iris-primary-foreground,#fff); border:1px solid transparent;`
      case 'outline':
        return `${base} background:transparent; color:${v}; border:1px solid ${v};`
      case 'subtle':
        // Precomputed fallback first; color-mix shorthand overrides on modern engines.
        return `${base} background-color:var(${TONE_TO_VAR[tone]}-subtle); background:color-mix(in srgb,${v} 14%,transparent); color:${v}; border:1px solid transparent;`
    }
  }

  let {
    variant = 'subtle',
    tone = 'neutral',
    size = 'md',
    closable = false,
    clickable = false,
    disabled = false,
    iconSnippet,
    onclose,
    onclick: onclickProp,
    children,
    style,
    ...rest
  }: {
    variant?: ChipVariant
    tone?: ChipTone
    size?: ChipSize
    closable?: boolean
    clickable?: boolean
    disabled?: boolean
    iconSnippet?: import('svelte').Snippet
    onclose?: () => void
    onclick?: (event: MouseEvent) => void
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  } = $props()

  const baseStyle = $derived(chipStyle(variant, tone, size, clickable, disabled))
  const mergedStyle = $derived(`${baseStyle}${style ? ' ' + style : ''}`)

  function onClick(event: MouseEvent): void {
    if (disabled) return
    onclickProp?.(event)
  }

  function onCloseClick(event: MouseEvent): void {
    if (disabled) return
    event.stopPropagation()
    onclose?.()
  }
</script>

{#if clickable}
  <button
    {...rest}
    type="button"
    data-iris-chip
    data-iris-chip-variant={variant}
    data-iris-chip-tone={tone}
    data-iris-chip-size={size}
    {disabled}
    onclick={onClick}
    style={mergedStyle}
  >
    {#if iconSnippet}
      <span data-iris-chip-icon style="display:inline-flex; align-items:center; flex-shrink:0;">
        {@render iconSnippet()}
      </span>
    {/if}
    <span data-iris-chip-label>{@render children?.()}</span>
    {#if closable}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        role="button"
        tabindex={disabled ? -1 : 0}
        data-iris-chip-close
        aria-label={t('chip.remove')}
        aria-disabled={disabled ? 'true' : undefined}
        onclick={onCloseClick}
        onkeydown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onclose?.()
          }
        }}
        style="background:transparent; border:none; cursor:{disabled ? 'not-allowed' : 'pointer'}; color:inherit; padding:0; margin-inline-start:2px; font-size:12px; line-height:1; flex-shrink:0; opacity:0.7; display:inline-flex;"
      >✕</span>
    {/if}
  </button>
{:else}
  <span
    {...rest}
    data-iris-chip
    data-iris-chip-variant={variant}
    data-iris-chip-tone={tone}
    data-iris-chip-size={size}
    style={mergedStyle}
  >
    {#if iconSnippet}
      <span data-iris-chip-icon style="display:inline-flex; align-items:center; flex-shrink:0;">
        {@render iconSnippet()}
      </span>
    {/if}
    <span data-iris-chip-label>{@render children?.()}</span>
    {#if closable}
      <button
        type="button"
        data-iris-chip-close
        aria-label={t('chip.remove')}
        {disabled}
        onclick={onCloseClick}
        style="background:transparent; border:none; cursor:{disabled ? 'not-allowed' : 'pointer'}; color:inherit; padding:0; margin-inline-start:2px; font-size:12px; line-height:1; flex-shrink:0; opacity:0.7;"
      >✕</button>
    {/if}
  </span>
{/if}
