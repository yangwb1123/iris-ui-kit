<script lang="ts">
  // Test fixture: wraps <SkinProvider> around a consumer.
  import type { SkinEngine } from '@iris-ui/skins'
  import SkinProvider from './SkinProvider.svelte'
  import SkinConsumer from './SkinConsumer.svelte'
  import type { UseSkinReturn } from './useSkin'

  let { engine, onready }: { engine: SkinEngine; onready?: (api: UseSkinReturn) => void } = $props()
</script>

<SkinProvider {engine}>
  <SkinConsumer {onready} />
</SkinProvider>
