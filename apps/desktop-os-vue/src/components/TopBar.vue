<script setup lang="ts">
/**
 * Top-bar dispatcher — the Vue mirror of React's `TopBar`. Renders the macOS
 * global menu bar when the active chrome asks for one; nothing otherwise (Win11).
 */
import { useOs } from '../os-state'
import MenuBar from './MenuBar.vue'

const { chrome } = useOs()
</script>

<template>
  <MenuBar v-if="chrome.topBar === 'menubar'" />
</template>
