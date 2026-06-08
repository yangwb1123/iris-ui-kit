<script lang="ts">
  /**
   * IrisSlot — "as-child" polymorphic slot pattern.
   * Merges props/handlers onto its single child element so the caller can
   * replace the default rendered element with any element of their choice.
   *
   * When `asChild` is false (default) it renders a <span style="display:contents">.
   * When `asChild` is true it passes its own props down to {@render children()}.
   */

  interface Props {
    asChild?: boolean
    class?: string
    style?: string
    [key: string]: unknown
    children?: import('svelte').Snippet<[]>
  }

  let { asChild = false, children, ...rest }: Props = $props()
</script>

{#if asChild}
  {@render children?.()}
{:else}
  <span data-iris-slot style="display:contents" {...rest}>{@render children?.()}</span>
{/if}
