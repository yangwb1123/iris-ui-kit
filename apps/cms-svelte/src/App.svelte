<script lang="ts">
  import { SkinProvider } from '@iris-ui/svelte'
  import { skinEngine } from './skin'
  import AuthProvider from './AuthProvider.svelte'
  import Gate from './Gate.svelte'
</script>

<SkinProvider engine={skinEngine}>
  <AuthProvider>
    <Gate />
  </AuthProvider>
</SkinProvider>
