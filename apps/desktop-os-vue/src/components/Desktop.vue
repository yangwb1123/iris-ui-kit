<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { type SnapZone } from '@iris-ui/core/window'
import { APPS } from '../apps'
import { wm, useWmState } from '../wm'
import Window from './Window.vue'
import SnapPreview from './SnapPreview.vue'
import Taskbar from './Taskbar.vue'
import StartMenu from './StartMenu.vue'

/** Desktop shortcuts shown top-left; double-click opens the app. */
const SHORTCUTS = ['about', 'files', 'showcase', 'taskmgr']

const state = useWmState()
const launcherOpen = ref(false)
// Live drag-to-edge snap zone (lifted from Window) → drives the snap preview.
const snapHint = ref<SnapZone | null>(null)

const shortcuts = computed(() =>
  SHORTCUTS.map((id) => APPS.find((a) => a.id === id)).filter(Boolean),
)
// Windows painted in ascending z-order. Depend on `state.windows` so this
// recomputes on every manager mutation (open/focus/close/…).
const windows = computed(() => {
  void state.value.windows
  return wm.ordered()
})

function open(appId: string) {
  const app = APPS.find((a) => a.id === appId)
  if (app) wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
}

// Alt+Tab cycles focus; Meta+Space toggles the launcher; Escape closes it.
function onKeyDown(e: KeyboardEvent) {
  if (e.altKey && e.key === 'Tab') {
    e.preventDefault()
    const cyclable = wm.ordered().filter((w) => w.state !== 'minimized')
    if (cyclable.length === 0) return
    const focusedId = wm.getState().focusedId
    const idx = cyclable.findIndex((w) => w.id === focusedId)
    wm.focus(cyclable[(idx + 1) % cyclable.length].id)
    return
  }
  if (e.metaKey && e.code === 'Space') {
    e.preventDefault()
    launcherOpen.value = !launcherOpen.value
    return
  }
  if (e.key === 'Escape' && launcherOpen.value) {
    e.preventDefault()
    launcherOpen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="desktop" @pointerdown="launcherOpen = false">
    <!-- Desktop icons -->
    <div class="desktop-icons">
      <button
        v-for="app in shortcuts"
        :key="app!.id"
        type="button"
        class="desktop-icon"
        @dblclick="open(app!.id)"
        @pointerdown.stop
      >
        <span style="font-size: 30px">{{ app!.icon }}</span>
        <span style="font-size: 12px">{{ app!.name }}</span>
      </button>
    </div>

    <!-- Drag-to-edge snap preview — behind windows -->
    <SnapPreview :zone="snapHint" />

    <!-- Windows (painted in z-order) -->
    <Window v-for="w in windows" :key="w.id" :window="w" @snap-hint="(z) => (snapHint = z)" />

    <!-- Empty-desktop hint when nothing is open -->
    <div v-if="state.windows.length === 0" class="desktop-hint">
      <div>
        <div style="font-size: 22px; font-weight: 600">Iris Desktop OS</div>
        <div style="opacity: 0.85; margin-top: 6px">
          Double-click an icon, or press Start. Runs on the same
          <code>@iris-ui/core/window</code> manager as the React demo.
        </div>
      </div>
    </div>

    <StartMenu :open="launcherOpen" @close="launcherOpen = false" />
    <Taskbar :launcher-open="launcherOpen" @toggle-launcher="launcherOpen = !launcherOpen" />
  </div>
</template>

<style scoped>
.desktop {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.desktop-icons {
  position: absolute;
  top: 16px;
  left: 16px;
  display: grid;
  gap: 6px;
  grid-auto-rows: min-content;
}
.desktop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
  text-align: center;
}
</style>
