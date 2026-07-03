<script lang="ts">
  // Test fixture: supplies a `children` snippet to IrisLongPress so specs
  // can assert its content renders inside the [data-iris-long-press] wrapper.
  import IrisLongPress from './IrisLongPress.svelte'

  let {
    holdDelay,
    onLongPress,
    disabled = false,
  }: {
    holdDelay?: number
    onLongPress: () => void
    disabled?: boolean
  } = $props()
</script>

<IrisLongPress {holdDelay} {onLongPress} {disabled}>
  {#snippet children()}
    <div data-testid="child">x</div>
  {/snippet}
</IrisLongPress>
