<script setup lang="ts">
/**
 * Launcher dispatcher — the Vue mirror of React's `Launcher`. Renders macOS
 * Spotlight / KDE Kickoff when the active chrome asks for it, else the Win11
 * Start menu — driven by `chrome.launcher`.
 */
import { useOs } from '../os-state'
import StartMenu from './StartMenu.vue'
import Spotlight from './Spotlight.vue'
import Kickoff from './Kickoff.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { chrome } = useOs()
</script>

<template>
  <Spotlight v-if="chrome.launcher === 'spotlight'" :open="open" @close="emit('close')" />
  <Kickoff v-else-if="chrome.launcher === 'kickoff'" :open="open" @close="emit('close')" />
  <StartMenu v-else :open="open" @close="emit('close')" />
</template>
