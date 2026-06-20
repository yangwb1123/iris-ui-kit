<script setup lang="ts">
import { computed, ref } from 'vue'
import { IrisButton } from '@iris-ui/vue'
import { useClipboard, useClipboardState } from '../clipboard'

/**
 * Clipboard — a desktop CLIPBOARD MANAGER (Win+V / macOS clipboard-manager feel)
 * over `@iris-ui/core/clipboard-history`. Records copied text, lets you re-copy a
 * past clip (writes the real system clipboard), pin clips so they survive Clear,
 * and remove individual entries. This is what makes the `clipboard` permission the
 * app requests actually do something. The Vue twin of the React demo's Clipboard.
 */

const clip = useClipboard()
const state = useClipboardState()
const entries = computed(() => state.value.entries)

const draft = ref('')

/** Write to the real system clipboard (best-effort; demo tolerates failure). */
async function writeSystemClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText(text)
  } catch {
    /* clipboard API unavailable / denied — history still records it */
  }
}

async function copy(text: string): Promise<void> {
  await writeSystemClipboard(text)
  clip.add(text) // move-to-front / record
}

async function submit(): Promise<void> {
  const t = draft.value.trim()
  if (!t) return
  draft.value = ''
  await copy(t)
}
</script>

<template>
  <div class="clip">
    <header class="clip-head">
      <div class="clip-title">📋 Clipboard history ({{ entries.length }})</div>
      <p class="muted">Recent clips. Click one to copy it again; ★ pins it (survives Clear).</p>
    </header>

    <div class="clip-list">
      <div v-for="e in entries" :key="e.id" class="clip-row">
        <button type="button" class="clip-text" title="Copy again" @click="copy(e.text)">
          {{ e.text }}
        </button>
        <button
          type="button"
          class="clip-pin"
          :class="{ 'clip-pin--on': e.pinned }"
          :aria-label="e.pinned ? 'Unpin' : 'Pin'"
          :aria-pressed="e.pinned"
          @click="clip.togglePin(e.id)"
        >
          ★
        </button>
        <button type="button" class="clip-remove" aria-label="Remove" @click="clip.remove(e.id)">
          ✕
        </button>
      </div>
      <div v-if="entries.length === 0" class="clip-empty">
        Nothing copied yet — type below and Copy, or copy from another app.
      </div>
    </div>

    <form class="clip-form" @submit.prevent="submit">
      <input v-model="draft" class="clip-input" placeholder="Text to copy…" />
      <IrisButton type="submit" variant="solid">Copy</IrisButton>
      <IrisButton type="button" variant="outline" @click="clip.clear()">Clear</IrisButton>
    </form>
  </div>
</template>

<style scoped>
.clip {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--os-window-fg);
}
.clip-head {
  padding: 16px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
}
.clip-title {
  font-weight: 600;
  font-size: 14px;
}
.muted {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
  margin: 4px 0 0;
}
.clip-list {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: grid;
  gap: 8px;
  align-content: start;
}
.clip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.1);
}
.clip-text {
  flex: 1;
  min-width: 0;
  text-align: left;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: 13px var(--os-font);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.clip-pin {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  opacity: 0.4;
  color: inherit;
}
.clip-pin--on {
  opacity: 1;
  color: var(--os-accent);
}
.clip-remove {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.5;
  font-size: 13px;
}
.clip-empty {
  font-size: 13px;
  opacity: 0.6;
}
.clip-form {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid rgba(127, 127, 127, 0.2);
}
.clip-input {
  flex: 1;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  background: rgba(255, 255, 255, 0.5);
  color: inherit;
  outline: none;
  font-size: 14px;
}
</style>
