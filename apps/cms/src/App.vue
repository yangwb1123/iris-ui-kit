<script setup lang="ts">
import { SkinProvider, IrisProvider } from '@iris-ui/vue'
import { notificationsPlugin } from '@iris-ui/plugin-notifications/vue'
import { skinEngine } from './skin'
import Shell from './Shell.vue'
import LoginPage from './pages/LoginPage.vue'
import { authStore } from './auth'
</script>

<template>
  <SkinProvider :engine="skinEngine">
    <IrisProvider :plugins="[notificationsPlugin]">
      <LoginPage v-if="!authStore.getState().session" />
      <Shell v-else />
    </IrisProvider>
  </SkinProvider>
</template>
