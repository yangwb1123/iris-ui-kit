<script lang="ts">
  // Test fixture: a child of <SkinProvider> that reads the skin via the hook.
  import { useSkin, type UseSkinReturn } from './useSkin'

  let { onready }: { onready?: (api: UseSkinReturn) => void } = $props()

  const api = useSkin()
  // svelte-ignore state_referenced_locally — fixture: hand the api out synchronously.
  onready?.(api)
  const { skin } = api
</script>

<div data-skin>{$skin.id}</div>
