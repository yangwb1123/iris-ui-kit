<script setup lang="ts">
import { ref } from 'vue'

// State lives in this component instance — i.e. per window.
const text = ref('')
</script>

<template>
  <textarea
    v-model="text"
    placeholder="Type something… (state lives in this window)"
    class="notepad"
  />
</template>

<style scoped>
.notepad {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: none;
  outline: none;
  resize: none;
  padding: 16px;
  font:
    14px/1.6 ui-monospace,
    monospace;
  background: transparent;
  color: var(--os-window-fg);
}
</style>
