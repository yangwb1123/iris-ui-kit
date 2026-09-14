<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IrisFormField,
  IrisInput,
  IrisSegmented,
  IrisSwitch,
  IrisButton,
  IrisFieldset,
  IrisStack,
} from '@iris-ui-kit/vue'
import { readCmsSettings, saveCmsSettings, type CmsSettings } from '@iris-ui-kit/cms-shared'

const environmentOptions = [
  { label: 'Live', value: 'live' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Read-only preview', value: 'preview', disabled: true },
]

const initial = readCmsSettings()
const siteName = ref(initial.siteName)
const supportEmail = ref(initial.supportEmail)
const notifications = ref(initial.notifications)
const maintenance = ref(initial.maintenance)
const status = ref('')
const settingsLocked = ref(false)
const selectedEnvironment = computed({
  get: () => (maintenance.value ? 'maintenance' : 'live'),
  set: (value: string) => {
    if (value === 'live') maintenance.value = false
    if (value === 'maintenance') maintenance.value = true
  },
})

function toggleSettingsLock() {
  settingsLocked.value = !settingsLocked.value
}

function save() {
  if (!siteName.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.value)) {
    status.value = 'Enter a site name and a valid support email.'
    return
  }
  const saved = saveCmsSettings({
    siteName: siteName.value.trim(),
    supportEmail: supportEmail.value.trim(),
    notifications: notifications.value,
    maintenance: selectedEnvironment.value === 'maintenance',
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
      <div style="margin-block-end: var(--iris-space-md, 16px)">
        <IrisButton type="button" variant="outline" @click="toggleSettingsLock">
          {{ settingsLocked ? 'Unlock settings' : 'Lock settings' }}
        </IrisButton>
      </div>
      <IrisFieldset
        legend="Site settings"
        hint="These settings apply to the entire site."
        :disabled="settingsLocked"
      >
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
            <IrisSegmented
              v-model="selectedEnvironment"
              :options="environmentOptions"
              ariaLabel="Environment"
            />
          </IrisFormField>
          <div>
            <IrisButton type="submit" variant="solid">Save changes</IrisButton>
          </div>
          <span role="status" aria-live="polite">{{ status }}</span>
        </IrisStack>
      </IrisFieldset>
    </form>
  </section>
</template>
