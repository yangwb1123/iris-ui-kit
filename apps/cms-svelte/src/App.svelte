<script lang="ts">
  import { SkinProvider, IrisProvider } from '@iris-ui/svelte'
  import { notificationsPlugin } from '@iris-ui/plugin-notifications/svelte'
  import { skinEngine } from './skin'
  import AuthProvider from './AuthProvider.svelte'
  import Gate from './Gate.svelte'
</script>

<SkinProvider engine={skinEngine}>
  <IrisProvider plugins={[notificationsPlugin]}>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </IrisProvider>
</SkinProvider>
