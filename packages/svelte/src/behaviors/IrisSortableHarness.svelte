<script lang="ts">
  // Test fixture: IrisSortable's `children` snippet takes no per-item args
  // (it's re-rendered once per item), so a plain .ts test file can't supply
  // one directly — wrap it in a harness .svelte file instead.
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
  {#snippet children()}
    <div>x</div>
  {/snippet}
</IrisSortable>
