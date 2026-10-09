<script lang="ts">
  // Test fixture: the provider's `componentSize` changes at runtime, so the
  // real control must re-render at the new size. The button cycles
  // sm → lg → (unset → md).
  import IrisProvider from './IrisProvider.svelte'
  import IrisInput from '../primitives/input/Input.svelte'
  import type { IrisComponentSize } from './componentSize'

  const sizes: Array<IrisComponentSize | undefined> = ['sm', 'lg', undefined]
  let index = $state(0)
  const componentSize = $derived(sizes[index])
</script>

<IrisProvider {componentSize}>
  <IrisInput />
</IrisProvider>
<button type="button" data-testid="cycle" onclick={() => (index = (index + 1) % sizes.length)}>
  cycle
</button>
