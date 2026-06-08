<script lang="ts">
  let {
    legend,
    disabled = false,
    hint,
    legendSnippet,
    children,
    style,
    ...rest
  }: {
    legend?: string
    disabled?: boolean
    hint?: string
    legendSnippet?: import('svelte').Snippet
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  } = $props()
</script>

<fieldset
  {...rest}
  data-iris-fieldset
  {disabled}
  style="min-inline-size:0; margin:0; padding:16px; border:1px solid var(--iris-border); border-radius:var(--iris-radius-md,6px); opacity:{disabled ? '0.6' : '1'};{style ? ' ' + style : ''}"
>
  {#if legendSnippet || legend != null}
    <legend
      data-iris-fieldset-legend
      style="padding:0 6px; font-size:14px; font-weight:600; color:var(--iris-foreground);"
    >
      {#if legendSnippet}
        {@render legendSnippet()}
      {:else}
        {legend}
      {/if}
    </legend>
  {/if}
  {#if hint != null}
    <div
      data-iris-fieldset-hint
      style="font-size:12px; color:var(--iris-muted); margin-block-end:8px;"
    >
      {hint}
    </div>
  {/if}
  {@render children?.()}
</fieldset>
