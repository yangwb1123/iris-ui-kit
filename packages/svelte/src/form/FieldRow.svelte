<script lang="ts">
  import { untrack } from 'svelte'
  import { useField } from './useField'

  interface Props {
    index: number
    onRemove: () => void
  }

  let { index, onRemove }: Props = $props()

  // A field hook binds to one path for the lifetime of this keyed row.
  const { value, setValue } = useField<string>(`items.${untrack(() => index)}.name`)

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    setValue(target.value)
  }
</script>

<div>
  <input aria-label="item-{index}" value={$value} oninput={handleInput} />
  <button type="button" onclick={onRemove} data-testid="remove-{index}">Remove</button>
</div>
