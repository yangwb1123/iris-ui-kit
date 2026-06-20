<script setup lang="ts">
/**
 * Bottom-bar dispatcher — the Vue mirror of React's `BottomBar`. Renders the
 * macOS Dock / KDE Panel when the active chrome asks for one, else the Win11
 * Taskbar — driven by `chrome.bottomBar`.
 */
import { useOs } from '../os-state'
import Taskbar from './Taskbar.vue'
import Dock from './Dock.vue'
import Panel from './Panel.vue'

defineProps<{ launcherOpen: boolean }>()
const emit = defineEmits<{ toggleLauncher: [] }>()

const { chrome } = useOs()
</script>

<template>
  <Dock v-if="chrome.bottomBar === 'dock'" @toggle-launcher="emit('toggleLauncher')" />
  <Panel v-else-if="chrome.bottomBar === 'panel'" @toggle-launcher="emit('toggleLauncher')" />
  <Taskbar v-else :launcher-open="launcherOpen" @toggle-launcher="emit('toggleLauncher')" />
</template>
