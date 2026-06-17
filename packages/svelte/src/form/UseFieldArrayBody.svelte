<script lang="ts">
  import type { UseFieldArrayReturn } from './useFieldArray'
  import { useFieldArray } from './useFieldArray'
  import FieldRow from './FieldRow.svelte'

  interface Props {
    onready?: (api: UseFieldArrayReturn<{ name: string }>) => void
  }

  // svelte-ignore state_referenced_locally — fixture: hand the controller out once
  let { onready }: Props = $props()

  const arr = useFieldArray<{ name: string }>('items')
  const { fields, push, remove } = arr

  $effect(() => {
    onready?.(arr)
  })
</script>

{#each $fields as _, i (i)}
  <FieldRow index={i} onRemove={() => remove(i)} />
{/each}
<button type="button" onclick={() => push({ name: '' })} data-testid="push">Add</button>
<span data-testid="count">{$fields.length}</span>
