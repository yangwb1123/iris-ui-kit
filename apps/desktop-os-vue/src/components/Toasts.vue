<script setup lang="ts">
import { computed } from 'vue'
import { type NotificationTone } from '@iris-ui/core/notifications'
import { useNotifications, useNotificationState } from '../notifications'
import ToastItem from './ToastItem.vue'

/**
 * The desktop TOAST stack — renders the newest notifications from the shared
 * {@link createNotificationCenter} in a corner, above windows. Each toast
 * auto-dismisses after its timeout; the full history lives in the center. Token-
 * skinned to the active OS. The Vue twin of the React demo's Toasts.tsx.
 */

/** Accent glyph + color per tone (color via token-friendly literals). */
const TONE: Record<NotificationTone, { glyph: string; color: string }> = {
  info: { glyph: 'ℹ️', color: 'var(--os-accent)' },
  success: { glyph: '✅', color: '#28c840' },
  warning: { glyph: '⚠️', color: '#febc2e' },
  error: { glyph: '⛔', color: '#ff5f57' },
}

const MAX_TOASTS = 4

const nc = useNotifications()
const state = useNotificationState()

// The newest few notifications surface as transient toasts.
const toasts = computed(() => state.value.notifications.slice(0, MAX_TOASTS))
</script>

<template>
  <div v-if="toasts.length" class="toasts" aria-live="polite">
    <ToastItem
      v-for="n in toasts"
      :key="n.id"
      :n="n"
      :tone-color="TONE[n.tone].color"
      :glyph="n.icon || TONE[n.tone].glyph"
      @dismiss="nc.dismiss(n.id)"
    />
  </div>
</template>

<style scoped>
.toasts {
  position: absolute;
  top: calc(var(--os-topbar-h, 0px) + 12px);
  right: 12px;
  z-index: 90000;
  display: grid;
  gap: 10px;
  pointer-events: auto;
}
</style>
