<script lang="ts">
  import { useField } from './useField'

  interface Props {
    index: number
    onRemove: () => void
  }

  // svelte-ignore state_referenced_locally — fixture: capture once on mount
  let { index, onRemove }: Props = $props()

  const { value, setValue } = useField<string>(`items.${index}.name`)

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    setValue(target.value)
  }
</script>
<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->

<div>
  <input aria-label="item-{index}" value={$value} oninput={handleInput} />
  <button type="button" onclick={onRemove} data-testid="remove-{index}">Remove</button>
</div>
