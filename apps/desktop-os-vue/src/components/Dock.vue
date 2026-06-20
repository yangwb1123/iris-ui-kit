<script setup lang="ts">
/**
 * macOS Dock — the Vue mirror of the React `Dock`. A centered translucent pill of
 * pinned + running apps, with running-window dots, hover magnification (cosine
 * falloff), and a launch bounce, plus a Launchpad trigger that toggles the
 * launcher (Spotlight). Token-styled to the skin; clicking an app focuses /
 * minimizes / launches it like the React shell.
 */
import { computed, ref } from 'vue'
import { getManifest } from '../catalog'
import { useApps, launchApp } from '../profile'
import { wm, useWmState } from '../wm'

const emit = defineEmits<{ toggleLauncher: [] }>()

const PINNED = ['about', 'appstore', 'files', 'showcase', 'settings']
const BASE = 46 // resting icon box
const MAX_BOOST = 26 // extra px added to the icon under the cursor
const RADIUS = 110 // how far (px) the magnification reaches along the dock
const GAP = 6
const PAD = 10

const state = useWmState()
const apps = useApps()

// Only windows on the active virtual desktop count as "running" here.
const wsWindows = computed(() =>
  state.value.windows.filter((w) => w.workspace === state.value.currentWorkspace),
)
const running = computed(() => new Set(wsWindows.value.map((w) => w.appId)))

// Pinned apps that are actually available + any running app not already pinned.
const items = computed(() => {
  const available = new Set(apps.value.map((a) => a.id))
  const ids = [
    ...PINNED.filter((id) => available.has(id)),
    ...wsWindows.value.map((w) => w.appId).filter((id) => !PINNED.includes(id)),
  ]
  const seen = new Set<string>()
  return ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
})

// Resolve each item's resting center so magnification is symmetric around the cursor.
const centers = computed(() => {
  let cursor = 0
  return items.value.map(() => {
    const c = PAD + cursor + BASE / 2
    cursor += BASE + GAP
    return c
  })
})

// Pointer X relative to the dock pill; null when the cursor isn't over it.
const pointerX = ref<number | null>(null)
// Icons that should bounce (keyed by appId) right after launch.
const bouncing = ref<Set<string>>(new Set())

function onMove(e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  pointerX.value = e.clientX - rect.left
}

function bounce(appId: string) {
  const next = new Set(bouncing.value)
  next.add(appId)
  bouncing.value = next
  window.setTimeout(() => {
    const after = new Set(bouncing.value)
    after.delete(appId)
    bouncing.value = after
  }, 560)
}

function activate(appId: string) {
  const win = state.value.windows.find((w) => w.appId === appId)
  if (win) {
    if (win.focused && win.state !== 'minimized') wm.minimize(win.id)
    else wm.focus(win.id)
  } else {
    const app = getManifest(appId)
    if (!app) return
    launchApp(appId)
    // Only window-creating apps bounce; `link` apps open in a new tab.
    if (app.kind !== 'link') bounce(appId)
  }
}

/** Magnification scale (1 → 1+boost) for an icon centered at `center` px. */
function scaleFor(center: number): number {
  if (pointerX.value == null) return 1
  const dist = Math.abs(pointerX.value - center)
  if (dist >= RADIUS) return 1
  // Cosine falloff: smooth, peaks at the cursor, settles to 1 at the radius.
  const t = (Math.cos((dist / RADIUS) * Math.PI) + 1) / 2
  return 1 + (MAX_BOOST / BASE) * t
}

function itemStyle(id: string, i: number) {
  const scale = scaleFor(centers.value[i] ?? 0)
  const transform = bouncing.value.has(id)
    ? 'translateY(-22px) scale(1.08)'
    : `scale(${scale.toFixed(3)})`
  return {
    width: `${BASE}px`,
    height: `${BASE}px`,
    transform,
  }
}
</script>

<template>
  <div class="dock-wrap" @pointerdown.stop>
    <div class="dock" @pointermove="onMove" @pointerleave="pointerX = null">
      <button
        v-for="(id, i) in items"
        :key="id"
        type="button"
        class="dock-item"
        :title="getManifest(id)?.name"
        :style="itemStyle(id, i)"
        @click="activate(id)"
      >
        <span style="display: block">{{ getManifest(id)?.icon }}</span>
        <span v-if="running.has(id)" class="dock-running" />
      </button>
      <span class="dock-sep" />
      <button
        type="button"
        class="dock-item dock-launcher"
        title="Launchpad"
        @click="emit('toggleLauncher')"
      >
        🚀
      </button>
    </div>
  </div>
</template>

<style scoped>
.dock-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.dock {
  pointer-events: auto;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 10px;
  background: var(--os-bar-bg);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  border-radius: var(--os-bar-radius);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
.dock-item {
  position: relative;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 30px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transition: transform 140ms cubic-bezier(0.25, 1, 0.5, 1);
  transform-origin: bottom center;
  will-change: transform;
}
.dock-running {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--os-window-fg);
  opacity: 0.7;
}
.dock-sep {
  width: 1px;
  align-self: stretch;
  margin: 4px;
  background: rgba(0, 0, 0, 0.18);
}
.dock-launcher {
  font-size: 28px;
}
.dock-launcher:hover {
  transform: scale(1.35);
}
</style>
