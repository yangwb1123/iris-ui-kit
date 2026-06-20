<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { type DesktopNotification } from '@iris-ui/core/notifications'

/**
 * One toast — auto-dismisses after its `timeout` (0 = sticky); ✕ dismisses now.
 * The shell owns the setTimeout (the core notification engine is timer-free).
 * Mirrors the React demo's inner `Toast` component.
 */
const props = defineProps<{
  n: DesktopNotification
  /** Accent color for the tone (left border). */
  toneColor: string
  /** Resolved glyph (the posting app's icon, or a tone glyph). */
  glyph: string
}>()

const emit = defineEmits<{ dismiss: [] }>()

let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (!props.n.timeout) return
  timer = setTimeout(() => emit('dismiss'), props.n.timeout)
})

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="toast" role="status" :style="{ borderLeft: `3px solid ${toneColor}` }">
    <span class="toast-glyph">{{ glyph }}</span>
    <div class="toast-body">
      <div class="toast-title">{{ n.title }}</div>
      <div v-if="n.body" class="toast-text">{{ n.body }}</div>
    </div>
    <button
      type="button"
      class="toast-close"
      aria-label="Dismiss notification"
      @click="emit('dismiss')"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.toast {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 320px;
  padding: 10px 12px;
  border-radius: var(--os-window-radius);
  background: var(--os-window-bg);
  color: var(--os-window-fg);
  border: var(--os-window-border);
  box-shadow: var(--os-window-shadow);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  font: 13px var(--os-font);
}
.toast-glyph {
  font-size: 16px;
  line-height: 18px;
}
.toast-body {
  flex: 1;
  min-width: 0;
}
.toast-title {
  font-weight: 600;
}
.toast-text {
  opacity: 0.75;
  margin-top: 2px;
  line-height: 1.4;
}
.toast-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.5;
  font-size: 14px;
  line-height: 14px;
  padding: 2px;
}
</style>
