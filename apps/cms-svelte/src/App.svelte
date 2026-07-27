<script lang="ts">
  import { SkinProvider, IrisProvider } from '@iris-ui-kit/svelte'
  import { notificationsPlugin } from '@iris-ui-kit/plugin-notifications/svelte'
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
