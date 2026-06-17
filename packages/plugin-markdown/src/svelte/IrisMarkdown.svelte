<script lang="ts">
  import { markdownToHtml } from '../core'

  let {
    content,
    class: klass = '',
  }: {
    content: string
    class?: string
  } = $props()

  // NB: do not name this `state` — a leading `$` would make Svelte read
  // `$state` as a store auto-subscription instead of the rune.
  let renderedHtml = $derived(markdownToHtml(content))
</script>

<div data-iris-markdown class={klass} style="font-family:var(--iris-md-font)">
  {@html renderedHtml}
</div>
