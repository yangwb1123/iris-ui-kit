<script lang="ts">
  import { getAccordionContext } from './context'

  let {
    value,
    title = '',
    disabled = false,
    titleSnippet,
    children,
    ...rest
  }: {
    value: string
    title?: string
    disabled?: boolean
    titleSnippet?: import('svelte').Snippet
    children?: import('svelte').Snippet
    [key: string]: unknown
  } = $props()

  const ctx = getAccordionContext('IrisAccordionItem')

  const open = $derived(ctx.isOpen(value))
  const headerId = $derived(`${ctx.rootId}-h-${value}`)
  const contentId = $derived(`${ctx.rootId}-c-${value}`)

  function onTrigger(): void {
    if (disabled) return
    ctx.toggle(value)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (disabled) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      ctx.toggle(value)
    }
  }
</script>

<div
  {...rest}
  data-iris-accordion-item
  data-state={open ? 'open' : 'closed'}
  data-disabled={disabled ? 'true' : undefined}
  style="border-bottom: 1px solid var(--iris-border);"
>
  <button
    type="button"
    id={headerId}
    data-iris-accordion-trigger
    aria-expanded={open ? 'true' : 'false'}
    aria-controls={contentId}
    {disabled}
    onclick={onTrigger}
    onkeydown={onKeyDown}
    style="width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:var(--iris-padding-md,12px); background:transparent; color:var(--iris-foreground); border:none; cursor:{disabled ? 'not-allowed' : 'pointer'}; opacity:{disabled ? '0.6' : '1'}; font:inherit; text-align:start;"
  >
    <span data-iris-accordion-title style="flex:1; min-width:0">
      {#if titleSnippet}
        {@render titleSnippet()}
      {:else}
        {title}
      {/if}
    </span>
    <span
      aria-hidden="true"
      data-iris-accordion-chevron
      style="transition:transform 160ms ease; transform:{open ? 'rotate(180deg)' : 'rotate(0deg)'}; color:var(--iris-muted)"
    >⌄</span>
  </button>
  {#if open}
    <div
      role="region"
      id={contentId}
      aria-labelledby={headerId}
      data-iris-accordion-content
      style="padding: 0 var(--iris-padding-md,12px) var(--iris-padding-md,12px)"
    >
      {@render children?.()}
    </div>
  {/if}
</div>
