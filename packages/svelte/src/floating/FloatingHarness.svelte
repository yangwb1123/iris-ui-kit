<script lang="ts">
  // Test fixture: mounts an anchor + floating element and wires them through
  // `useFloating`, so the positioning `$effect` runs on mount (which is where
  // the middleware list — including the optional `size` middleware — is built).
  import { useFloating } from './useFloating.svelte'
  import type { Placement } from '@floating-ui/dom'

  let {
    size,
    placement = 'bottom',
    offset,
  }: { size?: boolean | number; placement?: Placement; offset?: number } = $props()

  let anchor = $state<HTMLDivElement>()
  let floating = $state<HTMLDivElement>()

  useFloating({
    anchor: () => anchor,
    floating: () => floating,
    open: () => true,
    size: () => size,
    placement: () => placement,
    offset: () => offset,
  })
</script>

<div role="presentation" bind:this={anchor}></div>
<div role="presentation" bind:this={floating}></div>
