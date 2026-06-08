<script lang="ts">
  type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

  const TONE_TO_VAR: Record<BannerTone, string> = {
    info: '--iris-primary',
    success: '--iris-success',
    warning: '--iris-warning',
    danger: '--iris-danger',
    neutral: '--iris-muted',
  }

  let {
    tone = 'info',
    closable = false,
    open: openProp,
    sticky = false,
    onclose,
    iconSnippet,
    actionsSnippet,
    children,
    style,
    ...rest
  }: {
    tone?: BannerTone
    closable?: boolean
    open?: boolean
    sticky?: boolean
    onclose?: () => void
    iconSnippet?: import('svelte').Snippet
    actionsSnippet?: import('svelte').Snippet
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  } = $props()

  let internalOpen = $state(true)

  $effect(() => {
    if (openProp !== undefined) internalOpen = openProp
  })

  const isOpen = $derived(openProp !== undefined ? openProp : internalOpen)
  const isControlled = $derived(openProp !== undefined)
  const tonalVar = $derived(`var(${TONE_TO_VAR[tone]})`)

  function handleClose(): void {
    if (!isControlled) internalOpen = false
    onclose?.()
  }
</script>

{#if isOpen}
  <div
    {...rest}
    role="status"
    data-iris-banner
    data-iris-banner-tone={tone}
    style="display:flex; align-items:center; gap:var(--iris-gap-md,12px); padding:8px var(--iris-padding-md,16px); width:100%; background:color-mix(in srgb,{tonalVar} 14%,var(--iris-background)); color:var(--iris-foreground); border-bottom:1px solid color-mix(in srgb,{tonalVar} 50%,transparent);{sticky ? ' position:sticky; top:0; z-index:40;' : ''}{style ? ' ' + style : ''}"
  >
    {#if iconSnippet}
      <span
        data-iris-banner-icon
        style="color:{tonalVar}; display:inline-flex; flex-shrink:0;"
      >
        {@render iconSnippet()}
      </span>
    {/if}
    <div data-iris-banner-content style="flex:1; min-width:0;">
      {@render children?.()}
    </div>
    {#if actionsSnippet}
      <div data-iris-banner-actions style="display:inline-flex; gap:8px; flex-shrink:0;">
        {@render actionsSnippet()}
      </div>
    {/if}
    {#if closable}
      <button
        type="button"
        data-iris-banner-close
        aria-label="Close"
        onclick={handleClose}
        style="background:transparent; border:none; cursor:pointer; color:var(--iris-muted); font-size:16px; padding:0 4px; line-height:1; flex-shrink:0;"
      >✕</button>
    {/if}
  </div>
{/if}
