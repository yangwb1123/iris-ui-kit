<script lang="ts">
  // Test fixture: a child of <ThemeProvider> that reads the theme via the hooks.
  import { useTheme, useDirection, type UseThemeReturn } from './useTheme'

  let { onready }: { onready?: (api: UseThemeReturn) => void } = $props()

  const api = useTheme()
  const dir = useDirection()
  // svelte-ignore state_referenced_locally — fixture: hand the api out synchronously.
  onready?.(api)
  const { theme } = api
</script>

<div data-name>{$theme.name}</div>
<div data-dir>{$dir}</div>
