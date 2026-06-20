<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { type SnapZone } from '@iris-ui/core/window'
import { getManifest } from '../catalog'
import { launchApp } from '../profile'
import { useRegisterDesktopCommands } from '../commands'
import { wm, useWmState } from '../wm'
import Window from './Window.vue'
import SnapPreview from './SnapPreview.vue'
import Taskbar from './Taskbar.vue'
import StartMenu from './StartMenu.vue'
import CommandPalette from './CommandPalette.vue'

/** Desktop shortcuts shown top-left; double-click opens the app. */
const SHORTCUTS = ['about', 'appstore', 'files', 'showcase', 'taskmgr']

const state = useWmState()
const launcherOpen = ref(false)
const paletteOpen = ref(false)
// Live drag-to-edge snap zone (lifted from Window) → drives the snap preview.
const snapHint = ref<SnapZone | null>(null)

// Keep the shared command registry in sync with the live shell state (apps +
// focused window) for the lifetime of the desktop.
useRegisterDesktopCommands()

const shortcuts = computed(() => SHORTCUTS.map((id) => getManifest(id)).filter(Boolean))
// Windows painted in ascending z-order. Depend on `state.windows` so this
// recomputes on every manager mutation (open/focus/close/…).
const windows = computed(() => {
  void state.value.windows
  return wm.ordered()
})

function open(appId: string) {
  launchApp(appId)
}

// (Meta|Ctrl)+K toggles the command palette; Alt+Tab cycles focus; Meta+Space
// toggles the launcher; Escape closes whichever overlay is open.
function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
    if (paletteOpen.value) launcherOpen.value = false
    return
  }
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
  if (e.key === 'Escape') {
    if (paletteOpen.value) {
      e.preventDefault()
      paletteOpen.value = false
    } else if (launcherOpen.value) {
      e.preventDefault()
      launcherOpen.value = false
    }
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
          Double-click an icon, press Start, or hit <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>. Runs
          on the same <code>@iris-ui/core/window</code> manager — plus
          <code>@iris-ui/core/{profile,commands}</code> — as the React demo.
        </div>
      </div>
    </div>

    <StartMenu :open="launcherOpen" @close="launcherOpen = false" />
    <Taskbar :launcher-open="launcherOpen" @toggle-launcher="launcherOpen = !launcherOpen" />
    <CommandPalette :open="paletteOpen" @close="paletteOpen = false" />
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
