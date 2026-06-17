<script lang="ts">
  // Test fixture: wraps <ThemeProvider> around a consumer so the context hooks
  // resolve against a real provider ancestor.
  import type { ThemeStore } from '@iris-ui/theme'
  import ThemeProvider from './ThemeProvider.svelte'
  import ThemeConsumer from './ThemeConsumer.svelte'
  import type { UseThemeReturn } from './useTheme'

  let { store, onready }: { store: ThemeStore; onready?: (api: UseThemeReturn) => void } = $props()
</script>

<ThemeProvider {store}>
  <ThemeConsumer {onready} />
</ThemeProvider>
