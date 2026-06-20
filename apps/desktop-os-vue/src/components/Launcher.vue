<script setup lang="ts">
/**
 * Launcher dispatcher — the Vue mirror of React's `Launcher`. Renders macOS
 * Spotlight when the active chrome asks for it, else the Win11 Start menu. (KDE's
 * Kickoff isn't built in this Vue shell yet; KDE isn't offered, so never hit.)
 */
import { useOs } from '../os-state'
import StartMenu from './StartMenu.vue'
import Spotlight from './Spotlight.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { chrome } = useOs()
</script>

<template>
  <Spotlight v-if="chrome.launcher === 'spotlight'" :open="open" @close="emit('close')" />
  <StartMenu v-else :open="open" @close="emit('close')" />
</template>
