<script lang="ts">
  // Test harness: wires ThrowingChild as IrisErrorBoundary's children so the
  // boundary can catch the child's render-time throw.
  import IrisErrorBoundary from './IrisErrorBoundary.svelte'
  import ThrowingChild from './ThrowingChild.svelte'

  let {
    shouldThrow = false,
    message = 'boom',
    onError = undefined,
  }: {
    shouldThrow?: boolean
    message?: string
    onError?: (error: unknown) => void
  } = $props()
</script>

<IrisErrorBoundary {onError}>
  {#snippet children()}
    <ThrowingChild {shouldThrow} {message} />
  {/snippet}
</IrisErrorBoundary>
