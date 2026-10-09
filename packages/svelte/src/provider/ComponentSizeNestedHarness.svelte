<script lang="ts">
  // Test fixture: nested providers. The outer provider sets `sm`; the inner one
  // optionally sets its own size; inputs before / inside / after prove scoping.
  import IrisProvider from './IrisProvider.svelte'
  import IrisInput from '../primitives/input/Input.svelte'
  import type { IrisComponentSize } from './componentSize'

  let { innerSize }: { innerSize?: IrisComponentSize } = $props()
</script>

<IrisProvider componentSize="sm">
  <div data-testid="before"><IrisInput /></div>
  <IrisProvider componentSize={innerSize}>
    <div data-testid="inner"><IrisInput /></div>
  </IrisProvider>
  <div data-testid="after"><IrisInput /></div>
</IrisProvider>
