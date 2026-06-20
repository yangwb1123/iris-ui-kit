<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { getManifest } from '../catalog'
import { wm, useWmState } from '../wm'

defineProps<{ launcherOpen: boolean }>()
const emit = defineEmits<{ toggleLauncher: [] }>()

const state = useWmState()

// Only windows on the active virtual desktop appear as task buttons.
const tasks = computed(() =>
  state.value.windows.filter((w) => w.workspace === state.value.currentWorkspace),
)

// Clock — refreshed every 30s.
const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000 * 30)
onUnmounted(() => clearInterval(timer))

function onTask(id: string) {
  const w = state.value.windows.find((x) => x.id === id)
  if (!w) return
  if (w.focused && w.state !== 'minimized') wm.minimize(id)
  else wm.focus(id)
}
</script>

<template>
  <div class="taskbar" @pointerdown.stop>
    <div style="display: flex; align-items: center; gap: 4px">
      <button
        type="button"
        aria-label="Start"
        :aria-pressed="launcherOpen"
        class="task-btn task-btn--start"
        style="font-size: 18px"
        @pointerdown.stop="emit('toggleLauncher')"
      >
        ⊞
      </button>
      <button
        v-for="w in tasks"
        :key="w.id"
        type="button"
        :title="w.title"
        class="task-btn"
        :class="{ 'task-btn--active': w.focused && w.state !== 'minimized' }"
        @pointerdown.stop="onTask(w.id)"
      >
        <span style="font-size: 18px">{{ getManifest(w.appId)?.icon }}</span>
      </button>
    </div>
    <div class="taskbar-clock">
      <div>{{ now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</div>
      <div>
        {{ now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' }) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.taskbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--os-bar-h);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--os-bar-fg);
  background: var(--os-bar-bg);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}
.taskbar-clock {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  text-align: right;
  font-size: 12px;
  line-height: 1.25;
  padding: 0 14px;
}
</style>
