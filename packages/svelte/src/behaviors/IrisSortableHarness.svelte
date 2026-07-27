<script lang="ts">
  // Test fixture kept in Svelte so the item-aware snippet is compiled exactly
  // like an application consumer.
  import IrisSortable from './IrisSortable.svelte'

  let {
    items,
    onReorder,
    getKey,
    disabled = false,
  }: {
    items: unknown[]
    onReorder?: (items: unknown[]) => void
    getKey?: (item: unknown, index: number) => string
    disabled?: boolean
  } = $props()
</script>

<IrisSortable {items} {onReorder} {getKey} {disabled}>
  {#snippet children(item)}
    <div>{String(item)}</div>
  {/snippet}
</IrisSortable>
