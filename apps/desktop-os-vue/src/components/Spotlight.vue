<script setup lang="ts">
/**
 * macOS Spotlight — the Vue mirror of the React `Spotlight`. A centered search
 * overlay over the surfaced apps: type to filter, ↑/↓ to move, Enter / click to
 * open, Esc to close, with a live preview column for the selected result and a
 * scale/opacity entrance. Reuses the shell's `useApps` + `launchApp` (the same
 * substrate the Start menu and ⌘K palette read). Token-styled to the skin.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useApps, launchApp } from '../profile'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const apps = useApps()
const query = ref('')
const active = ref(0)
// Drives the scale/opacity entrance; flipped on after open so CSS transitions in.
const shown = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = ''
      active.value = 0
      shown.value = false
      nextTick(() => {
        inputRef.value?.focus()
        requestAnimationFrame(() => (shown.value = true))
      })
    } else {
      shown.value = false
    }
  },
)

const q = computed(() => query.value.trim().toLowerCase())
const results = computed(() =>
  q.value ? apps.value.filter((a) => a.name.toLowerCase().includes(q.value)) : apps.value,
)
const activeIndex = computed(() => Math.min(active.value, results.value.length - 1))
const selected = computed(() => results.value[activeIndex.value])

function launch(id: string) {
  launchApp(id)
  emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && selected.value) launch(selected.value.id)
  else if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(active.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  }
}
</script>

<template>
  <div v-if="open" class="spotlight-backdrop" @pointerdown="emit('close')">
    <div class="spotlight" :class="{ 'is-shown': shown }" @pointerdown.stop>
      <div class="spotlight-search">
        <span style="font-size: 22px; opacity: 0.6">🔍</span>
        <input
          ref="inputRef"
          v-model="query"
          class="spotlight-input"
          placeholder="Spotlight Search"
          @input="active = 0"
          @keydown="onKeyDown"
        />
      </div>

      <div class="spotlight-body">
        <!-- Results list -->
        <div class="spotlight-results">
          <div class="spotlight-group">Applications</div>
          <button
            v-for="(app, i) in results"
            :key="app.id"
            type="button"
            class="spotlight-result"
            :class="{ 'is-active': i === activeIndex }"
            @click="launch(app.id)"
            @pointerenter="active = i"
          >
            <span style="font-size: 22px">{{ app.icon }}</span>
            {{ app.name }}
          </button>
          <div v-if="results.length === 0" style="padding: 18px; opacity: 0.6">No results.</div>
        </div>

        <!-- Preview column for the selected result -->
        <div class="spotlight-preview">
          <template v-if="selected">
            <div style="font-size: 64px; line-height: 1">{{ selected.icon }}</div>
            <div style="font-size: 17px; font-weight: 600">{{ selected.name }}</div>
            <div style="font-size: 12px; opacity: 0.55">Application</div>
          </template>
          <div v-else style="font-size: 13px; opacity: 0.45">No selection</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spotlight-backdrop {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 18vh;
  background: rgba(0, 0, 0, 0.06);
  z-index: 100000;
}
.spotlight {
  width: min(680px, 92vw);
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: var(--os-window-bg);
  color: var(--os-window-fg);
  border: var(--os-window-border);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  transform-origin: top center;
  transform: scale(0.96);
  opacity: 0;
  transition:
    transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1),
    opacity 160ms ease;
}
.spotlight.is-shown {
  transform: scale(1);
  opacity: 1;
}
.spotlight-search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
}
.spotlight-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 22px;
}
.spotlight-body {
  display: flex;
  min-height: 0;
}
.spotlight-results {
  flex: 1;
  overflow: auto;
  border-right: 1px solid rgba(127, 127, 127, 0.18);
}
.spotlight-group {
  padding: 8px 18px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  opacity: 0.45;
}
.spotlight-result {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 18px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 15px;
}
.spotlight-result.is-active {
  background: color-mix(in srgb, var(--os-accent) 22%, transparent);
}
.spotlight-preview {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  text-align: center;
}
</style>
