<script lang="ts">
  import { SkinProvider } from '@iris-ui/svelte'
  import { skinEngine } from './skin'
  import Shell from './Shell.svelte'
</script>

<SkinProvider engine={skinEngine}>
  <Shell />
</SkinProvider>
