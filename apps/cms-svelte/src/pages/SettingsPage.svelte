<script lang="ts">
  import { IrisFormField, IrisInput, IrisSwitch, IrisButton, IrisStack } from '@iris-ui-kit/svelte'

  // Local form state — survives tab switches because inactive tabs stay mounted.
  let siteName = $state('Iris CMS')
  let supportEmail = $state('support@iris.dev')
  let notifications = $state(true)
  let maintenance = $state(false)
</script>

<section>
  <h1 class="page-title">Settings</h1>
  <p class="page-desc">
    A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
    preserved by the keep-alive content cache.
  </p>
  <div style="max-width: 480px">
    <IrisStack spacing={16}>
      <IrisFormField label="Site name">
        <IrisInput value={siteName} oninput={(e) => (siteName = e.currentTarget.value)} />
      </IrisFormField>
      <IrisFormField label="Support email">
        <IrisInput
          type="email"
          value={supportEmail}
          oninput={(e) => (supportEmail = e.currentTarget.value)}
        />
      </IrisFormField>
      <IrisFormField label="Email notifications">
        <IrisSwitch checked={notifications} onChange={(next) => (notifications = next)} />
      </IrisFormField>
      <IrisFormField label="Maintenance mode">
        <IrisSwitch checked={maintenance} onChange={(next) => (maintenance = next)} />
      </IrisFormField>
      <div>
        <IrisButton variant="solid">Save changes</IrisButton>
      </div>
    </IrisStack>
  </div>
</section>
