<script lang="ts">
  // Test fixture: mounts an anchor + floating element and wires them through
  // `useFloating`, so the positioning `$effect` runs on mount (which is where
  // the middleware list — including the optional `size` middleware — is built).
  import { useFloating, type UseFloatingOptions } from './useFloating.svelte'

  let { size }: { size?: UseFloatingOptions['size'] } = $props()

  let anchor = $state<HTMLDivElement>()
  let floating = $state<HTMLDivElement>()

  useFloating({
    anchor: () => anchor,
    floating: () => floating,
    open: () => true,
    size,
  })
</script>

<div bind:this={anchor}></div>
<div bind:this={floating}></div>
