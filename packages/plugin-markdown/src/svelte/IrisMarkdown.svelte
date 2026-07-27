<script lang="ts">
  import { markdownToNodes } from '../core'
  import MarkdownNodeView from './MarkdownNode.svelte'

  let {
    content,
    class: klass = '',
  }: {
    content: string
    class?: string
  } = $props()

  let nodes = $derived(markdownToNodes(content))
</script>

<div data-iris-markdown class={klass} style="font-family:var(--iris-md-font)">
  {#each nodes as node}
    <MarkdownNodeView {node} />
  {/each}
</div>
