<script setup lang="ts">
import { IrisButton } from '@iris-ui-kit/vue'
import { wm, useWmState } from '../wm'

// Live list of windows, straight from the framework-agnostic manager store.
const state = useWmState()
</script>

<template>
  <div class="taskmgr">
    <div style="opacity: 0.6; font-size: 12px; padding: 0 8px">
      {{ state.windows.length }} open window(s) — live from the window manager store
    </div>
    <div v-for="w in state.windows" :key="w.id" class="taskmgr-row">
      <span style="flex: 1">{{ w.title }}</span>
      <span style="font-size: 12px; opacity: 0.5">{{ w.state }}</span>
      <IrisButton variant="ghost" @click="wm.close(w.id)">End task</IrisButton>
    </div>
  </div>
</template>

<style scoped>
.taskmgr {
  padding: 12px;
  display: grid;
  gap: 4px;
}
.taskmgr-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}
</style>
