<script setup lang="ts">
import { IrisButton } from '@iris-ui-kit/vue'
import { IrisNotificationCenter } from '@iris-ui-kit/plugin-notifications/vue'
import { center } from '../notificationCenter'

function pushTestNotification(): void {
  center.push({
    title: 'Test notification pushed',
    description: 'Created from the Notifications page.',
    tone: 'success',
  })
}
</script>

<template>
  <section data-page="notifications" class="notifications-page">
    <h1 class="page-title">Notifications</h1>
    <p class="page-desc">
      This page demonstrates read, dismiss, clear, and push interactions with a persistent
      notification center.
    </p>

    <div class="notifications-demo-action">
      <div>
        <h2>Try a live update</h2>
        <p>Push an item into the center without reloading the page.</p>
      </div>
      <IrisButton type="button" variant="solid" @click="pushTestNotification">
        Push test notification
      </IrisButton>
    </div>

    <div class="notifications-panel">
      <IrisNotificationCenter
        :center="center"
        title="Notifications"
        empty-text="No notifications"
        dismiss-label="Dismiss"
        mark-all-read-label="Mark all read"
        clear-label="Clear"
        class-name="notifications-center"
      />
    </div>
  </section>
</template>
