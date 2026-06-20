<script setup lang="ts">
/**
 * Bottom-bar dispatcher — the Vue mirror of React's `BottomBar`. Renders the
 * macOS Dock when the active chrome asks for one, else the Win11 Taskbar. (KDE's
 * Panel isn't built in this Vue shell yet, so a `panel` chrome falls back to the
 * taskbar — but KDE isn't in OS_ORDER, so it's never selected.)
 */
import { useOs } from '../os-state'
import Taskbar from './Taskbar.vue'
import Dock from './Dock.vue'

defineProps<{ launcherOpen: boolean }>()
const emit = defineEmits<{ toggleLauncher: [] }>()

const { chrome } = useOs()
</script>

<template>
  <Dock v-if="chrome.bottomBar === 'dock'" @toggle-launcher="emit('toggleLauncher')" />
  <Taskbar v-else :launcher-open="launcherOpen" @toggle-launcher="emit('toggleLauncher')" />
</template>
