<script setup lang="ts">
import { ref } from 'vue'
import { IrisFormField, IrisInput, IrisSwitch, IrisButton, IrisStack } from '@iris-ui/vue'

// Local form state — survives tab switches thanks to <KeepAlive>.
const siteName = ref('Iris CMS')
const supportEmail = ref('support@iris.dev')
const notifications = ref(true)
const maintenance = ref(false)
</script>

<template>
  <section>
    <h1 class="page-title">Settings</h1>
    <p class="page-desc">
      A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
      preserved by the keep-alive content cache.
    </p>
    <div style="max-width: 480px">
      <IrisStack :spacing="16">
        <IrisFormField label="Site name">
          <IrisInput v-model="siteName" />
        </IrisFormField>
        <IrisFormField label="Support email">
          <IrisInput v-model="supportEmail" type="email" />
        </IrisFormField>
        <IrisFormField label="Email notifications">
          <IrisSwitch v-model="notifications" />
        </IrisFormField>
        <IrisFormField label="Maintenance mode">
          <IrisSwitch v-model="maintenance" />
        </IrisFormField>
        <div>
          <IrisButton variant="solid">Save changes</IrisButton>
        </div>
      </IrisStack>
    </div>
  </section>
</template>
