<script lang="ts">
  import type { MarkdownNode } from '../core'
  import MarkdownNodeView from './MarkdownNode.svelte'

  let { node }: { node: MarkdownNode } = $props()
</script>

{#if node.type === 'text'}
  {node.value}
{:else if node.children.length === 0}
  <svelte:element this={node.tag} {...node.attrs} />
{:else}
  <svelte:element this={node.tag} {...node.attrs}>
    {#each node.children as child}
      <MarkdownNodeView node={child} />
    {/each}
  </svelte:element>
{/if}
