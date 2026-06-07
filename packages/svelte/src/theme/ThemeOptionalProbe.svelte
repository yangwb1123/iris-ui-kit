<script lang="ts">
  // Test fixture: renders WITHOUT a provider to verify graceful fallbacks.
  import { useThemeOptional, useDirection } from './useTheme'

  const theme = useThemeOptional()
  const dir = useDirection()
</script>

<div data-optional>{theme === undefined ? 'none' : 'some'}</div>
<div data-dir>{$dir}</div>
