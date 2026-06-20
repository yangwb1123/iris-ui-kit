<script setup lang="ts">
/**
 * KDE Plasma panel — the Vue mirror of the React `Panel`. A full-width dark bar:
 * a Kickoff launcher button at the LEFT, LEFT-aligned task buttons that show app
 * LABELS (per `chrome.taskLabels`) for every open window, and a right cluster
 * with a system-tray quick-settings popup + a stacked digital clock. Clicking a
 * task focuses (or minimizes the focused one); right-click opens a task menu;
 * the launcher button toggles Kickoff. Token-styled to the KDE skin.
 */
import { computed, onUnmounted, ref } from 'vue'
import { getManifest } from '../catalog'
import { wm, useWmState } from '../wm'

const emit = defineEmits<{ toggleLauncher: [] }>()

/** A faux quick-toggle in the KDE system-tray popup (Wi-Fi / Sound / Night-Color). */
interface Toggle {
  id: string
  label: string
  icon: string
}

const TOGGLES: Toggle[] = [
  { id: 'wifi', label: 'Wi-Fi', icon: '🌐' },
  { id: 'sound', label: 'Sound', icon: '🔊' },
  { id: 'night', label: 'Night Color', icon: '🌙' },
]

const state = useWmState()

// Only windows on the active virtual desktop appear as task buttons.
const tasks = computed(() =>
  state.value.windows.filter((w) => w.workspace === state.value.currentWorkspace),
)

// Clock — refreshed every 30s.
const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000 * 30)
onUnmounted(() => clearInterval(timer))

const time = computed(() =>
  now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
)
const date = computed(() => now.value.toLocaleDateString([], { month: 'short', day: 'numeric' }))

// System-tray quick-settings popup.
const trayOpen = ref(false)
const toggles = ref<Record<string, boolean>>({ wifi: true, sound: true, night: false })

// Task-button right-click context menu ({ id, x } = open at offsetLeft x; null = closed).
const taskMenu = ref<{ id: string; x: number } | null>(null)

const rootRef = ref<HTMLElement | null>(null)

// Click-outside closes the tray popup + the task context menu.
function onDocPointerDown(e: PointerEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    trayOpen.value = false
    taskMenu.value = null
  }
}
document.addEventListener('pointerdown', onDocPointerDown)
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointerDown))

function onTask(id: string) {
  taskMenu.value = null
  const w = state.value.windows.find((x) => x.id === id)
  if (!w) return
  if (w.focused && w.state !== 'minimized') wm.minimize(id)
  else wm.focus(id)
}

function onTaskContext(e: MouseEvent, id: string) {
  trayOpen.value = false
  taskMenu.value = { id, x: (e.currentTarget as HTMLElement).offsetLeft }
}

function onLauncher() {
  trayOpen.value = false
  taskMenu.value = null
  emit('toggleLauncher')
}

function onTray() {
  taskMenu.value = null
  trayOpen.value = !trayOpen.value
}

function toggle(id: string) {
  toggles.value = { ...toggles.value, [id]: !toggles.value[id] }
}

const taskMenuActions = computed(() => {
  const id = taskMenu.value?.id
  return [
    { label: 'Minimize', icon: '🗕', run: () => id && wm.minimize(id) },
    { label: 'Close', icon: '✕', run: () => id && wm.close(id) },
  ]
})

function runTaskAction(run: () => void) {
  run()
  taskMenu.value = null
}
</script>

<template>
  <div ref="rootRef" class="kde-panel" @pointerdown.stop>
    <!-- Kickoff launcher button. -->
    <button
      type="button"
      aria-label="Application Launcher"
      class="kde-launch"
      @pointerdown.stop="onLauncher"
    >
      <span style="font-size: 18px">☰</span>
    </button>

    <!-- Left-aligned, labelled task buttons. -->
    <div class="kde-tasks">
      <button
        v-for="w in tasks"
        :key="w.id"
        type="button"
        :title="w.title"
        class="kde-task"
        :class="{
          'kde-task--active': w.focused && w.state !== 'minimized',
          'kde-task--min': w.state === 'minimized',
        }"
        @pointerdown.stop.left="onTask(w.id)"
        @contextmenu.prevent.stop="onTaskContext($event, w.id)"
      >
        <span style="font-size: 16px">{{ getManifest(w.appId)?.icon }}</span>
        <span class="kde-task-label">{{ w.title }}</span>
      </button>
    </div>

    <!-- System tray cluster — toggles the quick-settings popup. -->
    <button
      type="button"
      aria-label="System Tray"
      class="kde-tray"
      :class="{ 'kde-tray--open': trayOpen }"
      @pointerdown.stop="onTray"
    >
      <span :style="{ opacity: toggles.sound ? 1 : 0.4 }">🔊</span>
      <span :style="{ opacity: toggles.wifi ? 1 : 0.4 }">🌐</span>
      <span>🔔</span>
    </button>

    <!-- Digital clock — time over date, stacked. -->
    <div aria-label="Clock" class="kde-clock">
      <span class="kde-clock-time">{{ time }}</span>
      <span class="kde-clock-date">{{ date }}</span>
    </div>

    <!-- Quick-settings tray popup. -->
    <div v-if="trayOpen" role="menu" aria-label="Quick Settings" class="kde-popup kde-popup--tray">
      <div class="kde-popup-title">Quick Settings</div>
      <button
        v-for="t in TOGGLES"
        :key="t.id"
        type="button"
        role="menuitemcheckbox"
        :aria-checked="toggles[t.id]"
        class="kde-toggle"
        @pointerdown.stop
        @click="toggle(t.id)"
      >
        <span aria-hidden="true" class="kde-toggle-icon" :class="{ 'is-on': toggles[t.id] }">
          {{ t.icon }}
        </span>
        <span style="flex: 1; font-size: 13px">{{ t.label }}</span>
        <span style="font-size: 11px; opacity: 0.7">{{ toggles[t.id] ? 'On' : 'Off' }}</span>
      </button>
    </div>

    <!-- Task button right-click context menu. -->
    <div
      v-if="taskMenu"
      role="menu"
      aria-label="Task Actions"
      class="kde-popup kde-popup--task"
      :style="{ left: `${Math.max(6, taskMenu.x)}px` }"
    >
      <button
        v-for="item in taskMenuActions"
        :key="item.label"
        type="button"
        role="menuitem"
        class="kde-menuitem"
        @pointerdown.stop
        @click="runTaskAction(item.run)"
      >
        <span aria-hidden="true" style="width: 16px; text-align: center">{{ item.icon }}</span>
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.kde-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--os-bar-h);
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 0 6px;
  color: var(--os-bar-fg);
  background: var(--os-bar-bg);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  border-top: 2px solid var(--os-accent);
  font-family: var(--os-font);
}

/* Kickoff launcher button. */
.kde-launch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 600;
  transition:
    background 0.12s,
    box-shadow 0.12s;
}
.kde-launch:hover {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 2px 0 0 var(--os-accent);
}

/* Left-aligned task buttons (the panel's flexible middle). */
.kde-tasks {
  display: flex;
  align-items: stretch;
  gap: 4px;
  flex: 1;
  overflow: hidden;
}
.kde-task {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
  padding: 0 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition:
    background 0.12s,
    box-shadow 0.12s;
}
.kde-task:hover {
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 2px 0 0 var(--os-accent);
}
.kde-task--active {
  border-bottom: 2px solid var(--os-accent);
  background: rgba(255, 255, 255, 0.12);
}
.kde-task--active:hover {
  background: rgba(255, 255, 255, 0.12);
}
.kde-task--min {
  opacity: 0.6;
}
.kde-task-label {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* System-tray button. */
.kde-tray {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  transition:
    background 0.12s,
    box-shadow 0.12s;
}
.kde-tray:hover {
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 2px 0 0 var(--os-accent);
}
.kde-tray--open,
.kde-tray--open:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* Stacked digital clock. */
.kde-clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  line-height: 1.1;
  min-width: 64px;
}
.kde-clock-time {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.kde-clock-date {
  font-size: 10px;
  opacity: 0.7;
}

/* Popups (tray quick-settings + task context menu). */
.kde-popup {
  position: absolute;
  padding: 6px;
  border-radius: 6px;
  background: var(--os-bar-bg);
  color: var(--os-bar-fg);
  border: 1px solid rgba(61, 174, 233, 0.5);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  z-index: 100000;
}
.kde-popup--tray {
  bottom: calc(var(--os-bar-h) + 6px);
  right: 6px;
  width: 240px;
}
.kde-popup--task {
  bottom: calc(var(--os-bar-h) + 4px);
  width: 150px;
  padding: 4px;
}
.kde-popup-title {
  padding: 6px 10px 8px;
  font-size: 11px;
  opacity: 0.6;
}
.kde-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.kde-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
}
.kde-toggle-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.06);
}
.kde-toggle-icon.is-on {
  background: color-mix(in srgb, var(--os-accent) 85%, transparent);
}
.kde-menuitem {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}
.kde-menuitem:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
