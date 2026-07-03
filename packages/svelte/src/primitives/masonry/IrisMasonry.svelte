<script lang="ts">
  interface Props {
    columns?: number
    gap?: number
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  }

  let { columns = 3, gap = 16, children, style, ...rest }: Props = $props()
</script>

<div
  {...rest}
  data-iris-masonry
  data-columns={columns}
  style="column-count: {columns}; column-gap: {gap}px; --iris-masonry-gap: {gap}px;{style
    ? ' ' + style
    : ''}"
>
  <!-- Children are wrapped individually for break-inside avoid -->
  {#if children}
    <div data-iris-masonry-inner style="display: contents">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  div[data-iris-masonry] :global(> * > *),
  div[data-iris-masonry] :global(> *) {
    break-inside: avoid;
    margin-block-end: var(--iris-masonry-gap, 16px);
  }
</style>
