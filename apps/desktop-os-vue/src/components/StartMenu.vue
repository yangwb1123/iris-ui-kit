<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { APPS } from '../apps'
import { wm } from '../wm'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = ''
      nextTick(() => inputRef.value?.focus())
    }
  },
)

const q = computed(() => query.value.trim().toLowerCase())
const results = computed(() =>
  q.value ? APPS.filter((a) => a.name.toLowerCase().includes(q.value)) : APPS,
)

function launch(appId: string) {
  const app = APPS.find((a) => a.id === appId)
  if (!app) return
  wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
  emit('close')
}
</script>

<template>
  <div v-if="open" class="startmenu" @pointerdown.stop>
    <input ref="inputRef" v-model="query" class="startmenu-search" placeholder="Search apps…" />
    <div style="font-size: 12px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.4px">
      {{ q ? `${results.length} result(s)` : 'All apps' }}
    </div>
    <div class="startmenu-grid">
      <button
        v-for="app in results"
        :key="app.id"
        type="button"
        class="launch-tile"
        @click="launch(app.id)"
      >
        <span style="font-size: 28px">{{ app.icon }}</span>
        <span style="font-size: 12px; text-align: center">{{ app.name }}</span>
      </button>
      <div v-if="results.length === 0" style="opacity: 0.6; grid-column: 1 / -1; padding: 16px">
        No apps match “{{ query }}”.
      </div>
    </div>
  </div>
</template>

<style scoped>
.startmenu {
  position: absolute;
  bottom: calc(var(--os-bar-h) + 10px);
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, 92vw);
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 14px;
  background: var(--os-window-bg);
  color: var(--os-window-fg);
  border: var(--os-window-border);
  box-shadow: var(--os-window-shadow);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  z-index: 100000;
}
.startmenu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
  overflow: auto;
}
</style>
