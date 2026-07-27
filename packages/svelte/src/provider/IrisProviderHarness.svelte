<script lang="ts">
  // Test fixture: mounts a consumer under <IrisProvider> with the given plugins.
  import type { IrisPlugin } from '@iris-ui-kit/core'
  import IrisProvider from './IrisProvider.svelte'
  import PluginConsumer from './PluginConsumer.svelte'

  let { plugins }: { plugins: IrisPlugin[] } = $props()
</script>

<IrisProvider {plugins}>
  <PluginConsumer />
</IrisProvider>
