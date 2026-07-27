<script setup lang="ts">
import { ref } from 'vue'
import { IrisFormField, IrisInput, IrisSwitch, IrisButton, IrisStack } from '@iris-ui-kit/vue'
import { readCmsSettings, saveCmsSettings, type CmsSettings } from '@iris-ui-kit/cms-shared'

const initial = readCmsSettings()
const siteName = ref(initial.siteName)
const supportEmail = ref(initial.supportEmail)
const notifications = ref(initial.notifications)
const maintenance = ref(initial.maintenance)
const status = ref('')

function save() {
  if (!siteName.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.value)) {
    status.value = 'Enter a site name and a valid support email.'
    return
  }
  const saved = saveCmsSettings({
    siteName: siteName.value.trim(),
    supportEmail: supportEmail.value.trim(),
    notifications: notifications.value,
    maintenance: maintenance.value,
  } satisfies CmsSettings)
  status.value = saved ? 'Settings saved.' : 'Settings could not be saved in this browser.'
}
</script>

<template>
  <section>
    <h1 class="page-title">Settings</h1>
    <p class="page-desc">
      A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
      preserved by the keep-alive content cache.
    </p>
    <form style="max-width: 480px" @submit.prevent="save">
      <IrisStack :spacing="16">
        <IrisFormField label="Site name">
          <IrisInput v-model="siteName" required />
        </IrisFormField>
        <IrisFormField label="Support email">
          <IrisInput v-model="supportEmail" type="email" required />
        </IrisFormField>
        <IrisFormField label="Email notifications">
          <IrisSwitch v-model="notifications" />
        </IrisFormField>
        <IrisFormField label="Maintenance mode">
          <IrisSwitch v-model="maintenance" />
        </IrisFormField>
        <div>
          <IrisButton type="submit" variant="solid">Save changes</IrisButton>
        </div>
        <span role="status" aria-live="polite">{{ status }}</span>
      </IrisStack>
    </form>
  </section>
</template>
