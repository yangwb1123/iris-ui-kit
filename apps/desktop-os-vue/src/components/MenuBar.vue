<script setup lang="ts">
/**
 * macOS global menu bar — the Vue mirror of the React `MenuBar`. Apple menu +
 * the focused app's name + working menus (File/Edit/View/Window/Help) on the
 * left; status glyphs + a live clock on the right. Click a title to open its
 * dropdown; click outside or pick an item to close. Token-styled to the skin.
 */
import { computed, onUnmounted, ref } from 'vue'
import { getManifest } from '../catalog'
import { launchApp } from '../profile'
import { wm, useWmState } from '../wm'

interface MenuEntry {
  label: string
  /** Action to run; omit for a disabled-looking, inert item. */
  onSelect?: () => void
  /** Render as a thin divider instead of a clickable row. */
  separator?: boolean
}

const state = useWmState()
const focused = computed(
  () =>
    state.value.windows.find((w) => w.id === state.value.focusedId && w.state !== 'minimized') ??
    null,
)
const appName = computed(() =>
  focused.value ? (getManifest(focused.value.appId)?.name ?? focused.value.title) : 'Finder',
)

// Clock — refreshed every 30s.
const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000 * 30)
onUnmounted(() => clearInterval(timer))

// Which menu is open (by key); null = none. Click-outside / select closes.
const openMenu = ref<string | null>(null)
const barRef = ref<HTMLElement | null>(null)

function onDocPointerDown(e: PointerEvent) {
  if (barRef.value && !barRef.value.contains(e.target as Node)) openMenu.value = null
}
// Subscribe to outside-clicks only while a menu is open.
function watchOutside(open: boolean) {
  if (open) document.addEventListener('pointerdown', onDocPointerDown, true)
  else document.removeEventListener('pointerdown', onDocPointerDown, true)
}
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointerDown, true))

function toggle(key: string) {
  const next = openMenu.value === key ? null : key
  watchOutside(next != null)
  openMenu.value = next
}
function hover(key: string) {
  // Only follow the cursor between titles while a menu is already open.
  if (openMenu.value) openMenu.value = key
}
function run(fn?: () => void) {
  watchOutside(false)
  openMenu.value = null
  fn?.()
}

function openAbout() {
  launchApp('about')
}
function openSettings() {
  launchApp('settings')
}

const menus = computed<Record<string, MenuEntry[]>>(() => {
  const f = focused.value
  const name = appName.value
  return {
    apple: [
      { label: 'About This Mac', onSelect: openAbout },
      { label: 'sep1', separator: true },
      { label: 'System Settings…', onSelect: openSettings },
      { label: 'sep2', separator: true },
      { label: 'Sleep' },
      { label: 'Restart…' },
      { label: 'Shut Down…' },
    ],
    app: [
      { label: `About ${name}` },
      { label: 'sep1', separator: true },
      { label: 'Preferences…', onSelect: openSettings },
      { label: 'sep2', separator: true },
      { label: `Quit ${name}`, onSelect: f ? () => wm.close(f.id) : undefined },
    ],
    file: [
      { label: 'New' },
      { label: 'Open…' },
      { label: 'sep1', separator: true },
      { label: 'Save' },
    ],
    edit: [
      { label: 'Undo' },
      { label: 'Redo' },
      { label: 'sep1', separator: true },
      { label: 'Cut' },
      { label: 'Copy' },
      { label: 'Paste' },
    ],
    view: [{ label: 'as Icons' }, { label: 'as List' }, { label: 'Show Toolbar' }],
    window: [
      { label: 'Minimize', onSelect: f ? () => wm.minimize(f.id) : undefined },
      { label: 'Zoom', onSelect: f ? () => wm.toggleMaximize(f.id) : undefined },
      { label: 'sep1', separator: true },
      { label: 'Close Window', onSelect: f ? () => wm.close(f.id) : undefined },
    ],
    help: [{ label: 'Iris Desktop OS Help' }],
  }
})

const clock = computed(
  () =>
    `${now.value.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })} ${now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
)

// Title definitions (key + label + bold flag), in bar order.
const titles = computed(() => [
  { key: 'apple', label: '', bold: false },
  { key: 'app', label: appName.value, bold: true },
  { key: 'file', label: 'File', bold: false },
  { key: 'edit', label: 'Edit', bold: false },
  { key: 'view', label: 'View', bold: false },
  { key: 'window', label: 'Window', bold: false },
  { key: 'help', label: 'Help', bold: false },
])
</script>

<template>
  <div ref="barRef" class="menubar" @pointerdown.stop>
    <span v-for="t in titles" :key="t.key" class="menubar-title-wrap">
      <button
        type="button"
        class="menubar-title"
        :class="{ 'menubar-title--apple': t.key === 'apple', 'is-active': openMenu === t.key }"
        :style="{ fontWeight: t.bold ? 700 : 500 }"
        @click="toggle(t.key)"
        @pointerenter="hover(t.key)"
      >
        {{ t.key === 'apple' ? '' : t.label }}
      </button>
      <div v-if="openMenu === t.key" role="menu" class="menubar-dropdown">
        <template v-for="entry in menus[t.key]" :key="entry.label">
          <div v-if="entry.separator" class="menubar-sep" />
          <button
            v-else
            type="button"
            role="menuitem"
            class="menubar-item"
            :disabled="!entry.onSelect"
            @click="run(entry.onSelect)"
          >
            {{ entry.label }}
          </button>
        </template>
      </div>
    </span>
    <span style="flex: 1" />
    <span style="padding: 0 10px">🔋 􀙇 🔍</span>
    <span style="padding: 0 14px 0 6px">{{ clock }}</span>
  </div>
</template>

<style scoped>
.menubar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--os-topbar-h);
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  z-index: 90000;
  user-select: none;
}
.menubar-title-wrap {
  position: relative;
}
.menubar-title {
  padding: 0 10px;
  height: var(--os-topbar-h);
  line-height: var(--os-topbar-h);
  font-size: 13px;
  border: none;
  background: transparent;
  color: inherit;
  text-shadow: inherit;
  cursor: default;
  border-radius: 4px;
}
.menubar-title.is-active {
  background: rgba(255, 255, 255, 0.22);
}
/* The Apple-logo title. */
.menubar-title--apple {
  font-size: 15px;
}
.menubar-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  min-width: 200px;
  padding: 5px;
  border-radius: 8px;
  background: var(--os-window-bg);
  color: var(--os-window-fg);
  border: var(--os-window-border);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  text-shadow: none;
  z-index: 1;
}
.menubar-sep {
  height: 1px;
  margin: 5px 6px;
  background: rgba(127, 127, 127, 0.28);
}
.menubar-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 10px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  cursor: default;
}
.menubar-item:disabled {
  opacity: 0.4;
}
.menubar-item:not(:disabled):hover {
  background: color-mix(in srgb, var(--os-accent) 90%, white);
  color: #fff;
}
</style>
