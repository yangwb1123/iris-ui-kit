<script setup lang="ts">
import { SkinProvider, IrisProvider, IrisToastViewport, useStore } from '@iris-ui/vue'
import { notificationsPlugin } from '@iris-ui/plugin-notifications/vue'
import { skinEngine } from './skin'
import Shell from './Shell.vue'
import LoginPage from './pages/LoginPage.vue'
import { authStore } from './auth'

const session = useStore(authStore)
</script>

<template>
  <SkinProvider :engine="skinEngine">
    <IrisProvider :plugins="[notificationsPlugin]">
      <LoginPage v-if="!session?.session" />
      <Shell v-else />
      <IrisToastViewport position="bottom-right" />
    </IrisProvider>
  </SkinProvider>
</template>
