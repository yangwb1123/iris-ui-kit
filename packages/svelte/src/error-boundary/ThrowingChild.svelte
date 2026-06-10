<script lang="ts">
  // Test fixture: throws during render when `shouldThrow` is true. Svelte
  // boundaries only catch errors thrown by child components' render/effects,
  // so the throw must live in a child (not the boundary's own snippet body).
  let { shouldThrow = false, message = 'boom' }: { shouldThrow?: boolean; message?: string } =
    $props()

  // svelte-ignore state_referenced_locally — intentional: throw on initial render
  if (shouldThrow) {
    // svelte-ignore state_referenced_locally
    throw new Error(message)
  }
</script>

<div data-testid="throwing-child-ok">child rendered</div>
