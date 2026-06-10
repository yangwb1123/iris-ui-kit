<script lang="ts">
  // Test harness: provides a custom `fallback` snippet receiving { error, reset }
  // to verify the user fallback path.
  import IrisErrorBoundary from './IrisErrorBoundary.svelte'
  import ThrowingChild from './ThrowingChild.svelte'

  let { message = 'custom-boom' }: { message?: string } = $props()
</script>

<IrisErrorBoundary>
  {#snippet children()}
    <ThrowingChild shouldThrow message={message} />
  {/snippet}
  {#snippet fallback({ error, reset })}
    <div data-testid="custom-fallback">
      <span data-testid="custom-error-message">
        {error instanceof Error ? error.message : String(error)}
      </span>
      <button type="button" data-testid="custom-reset" onclick={reset}>retry</button>
    </div>
  {/snippet}
</IrisErrorBoundary>
