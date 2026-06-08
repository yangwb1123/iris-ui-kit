<script lang="ts">
  // Test fixture: reads the plugin layer via the consumer hooks and reflects it
  // to the DOM for bare-DOM assertions.
  import { usePlugin, usePluginStore } from './hooks'

  const store = usePluginStore<{ id: string }>('example')
  const hasExample = usePlugin('example')
  const hasNope = usePlugin('nope')
</script>

<div data-store-id>{store.id}</div>
<div data-has-example>{hasExample}</div>
<div data-has-nope>{hasNope}</div>
