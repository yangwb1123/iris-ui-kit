<script setup lang="ts">
import { SkinProvider, IrisProvider, IrisToastViewport } from '@iris-ui-kit/vue'
import { notificationsPlugin } from '@iris-ui-kit/plugin-notifications/vue'
import { skinEngine } from './skin'
import Shell from './Shell.vue'
import LoginPage from './pages/LoginPage.vue'
import { authState } from './auth'
</script>

<template>
  <SkinProvider :engine="skinEngine">
    <IrisProvider :plugins="[notificationsPlugin]">
      <LoginPage v-if="!authState.session" />
      <Shell v-else />
      <IrisToastViewport position="bottom-right" />
    </IrisProvider>
  </SkinProvider>
</template>
