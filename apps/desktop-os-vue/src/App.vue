<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { serializeSession, restoreSession, type WindowSession } from '@iris-ui-kit/core/window'
import { type VfsState } from '@iris-ui-kit/core/fs'
import { wm } from './wm'
import { fs } from './fs'
import { profile } from './profile'
import { getManifest, registerCustomApps, type AppManifest } from './catalog'
import { useOs } from './os-state'
import { barInsets } from './os'
import Desktop from './components/Desktop.vue'

/**
 * The desktop, parameterized by the active OS skin. The skin is a set of CSS
 * custom properties (`--os-*`) applied on the root so the whole shell — and the
 * @iris-ui-kit/vue components inside windows — reads `var(--os-*)`. Switching the OS
 * swaps the variables AND the structural chrome (top menu bar, bottom dock,
 * spotlight, traffic-lights) live; mirrors the React shell, which carries all
 * three (Win11 / macOS / KDE). This Vue build ships Win11 + macOS chrome.
 */
const { chrome } = useOs()

// The root style: position + font + wallpaper, plus the active skin's vars
// spread in so they cascade into the whole shell. Reactive to the OS choice.
const rootStyle = computed<Record<string, string>>(() => ({
  position: 'fixed',
  inset: '0',
  overflow: 'hidden',
  fontFamily: 'var(--os-font)',
  background: 'var(--os-wallpaper)',
  ...chrome.value.vars,
}))

const rootRef = ref<HTMLElement | null>(null)
let ro: ResizeObserver | undefined

// ── Window-session persistence ───────────────────────────────────────────────
// Open windows (geometry, state, stacking, focus) survive a reload: restored ONCE
// after hydrate + work-area are ready, then re-saved (debounced) on every change.
// Mirrors the React shell (apps/desktop-os/src/App.tsx).
const restored = ref(false)
let saveUnsubscribe: (() => void) | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined

// ── Virtual file-system persistence ──────────────────────────────────────────
// The Files app's contents survive a reload: hydrated ONCE from the profile (or
// seeded with a starter set), then re-saved (debounced) on every change. Mirrors
// the React shell (apps/desktop-os/src/App.tsx).
const fsReady = ref(false)
let fsSaveUnsubscribe: (() => void) | undefined
let fsSaveTimer: ReturnType<typeof setTimeout> | undefined

/** The saved session, filtered to apps that still resolve (removed apps skipped). */
function knownSession(): WindowSession {
  const raw = profile.getPref<WindowSession>('session')
  if (!Array.isArray(raw)) return []
  // Custom (URL-added) apps live in prefs — register them so getManifest resolves.
  registerCustomApps((profile.getPref<AppManifest[]>('customApps') ?? []) as AppManifest[])
  return raw.filter((e) => Boolean(getManifest(e.appId)))
}

/**
 * Restore the saved session ONCE, after hydrate populated prefs and the work area
 * is set (so geometry clamps correctly), then start persisting on every change.
 */
function restoreSessionOnce() {
  if (restored.value) return
  restored.value = true
  if (wm.getState().windows.length === 0) restoreSession(wm, knownSession())
  // Persist (debounced) on every WM change, now that restore has run — so the
  // debounced save can never overwrite the saved session before restore.
  saveUnsubscribe = wm.subscribe(() => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => profile.setPref('session', serializeSession(wm.getState())), 400)
  })
}

/**
 * Hydrate the virtual file system from the profile ONCE (or seed a starter set),
 * then persist it (debounced) on every change — so user files survive reloads.
 * Runs after hydrate has populated prefs, so the saved `fs` pref is available.
 */
function hydrateFsOnce() {
  if (fsReady.value) return
  fsReady.value = true
  const saved = profile.getPref<VfsState>('fs')
  if (saved && Array.isArray(saved.folders) && saved.files) {
    fs.store.setState(() => saved)
  } else if (Object.keys(fs.getState().files).length === 0) {
    fs.write(
      '/Documents/Welcome.txt',
      'Welcome to Iris Desktop OS.\n\nThis Files app is a real virtual file system — create folders and text files, rename, delete. It persists to your profile and survives a reload.',
    )
    fs.write(
      '/Documents/notes.md',
      '# Notes\n\n- Backed by @iris-ui-kit/core/fs\n- The same engine drives all four shells.',
    )
    fs.mkdir('/Pictures')
  }
  // Persist (debounced) on every fs change, now that hydrate has run — so the
  // debounced save can never overwrite the saved state before hydrate.
  fsSaveUnsubscribe = fs.subscribe(() => {
    clearTimeout(fsSaveTimer)
    fsSaveTimer = setTimeout(() => profile.setPref('fs', fs.getState()), 400)
  })
}

// Reserve the top + bottom bars (from the active chrome's insets) and feed the
// remaining rectangle to the WM as its work area (drives maximize + snap).
// Re-measured on resize AND whenever the OS skin changes (different bar heights).
function applyWorkArea() {
  const el = rootRef.value
  if (!el) return
  const { top, bottom } = barInsets(chrome.value)
  const r = el.getBoundingClientRect()
  wm.setWorkArea({
    x: 0,
    y: top,
    width: r.width,
    height: Math.max(240, r.height - top - bottom),
  })
}

onMounted(() => {
  // Set the work area first (sync) so a restored window's geometry clamps right.
  applyWorkArea()
  const el = rootRef.value
  if (el) {
    ro = new ResizeObserver(applyWorkArea)
    ro.observe(el)
  }
  // Restore the persisted profile (incl. the saved OS skin) — the desktop renders
  // immediately and re-skins when hydrate lands — then restore the window session
  // and hydrate the virtual file system.
  void profile.hydrate().then(() => {
    restoreSessionOnce()
    hydrateFsOnce()
  })
})

// Recompute the work area when the OS changes (top-bar appears, bar height differs).
watch(chrome, applyWorkArea)

onUnmounted(() => {
  ro?.disconnect()
  clearTimeout(saveTimer)
  saveUnsubscribe?.()
  clearTimeout(fsSaveTimer)
  fsSaveUnsubscribe?.()
})
</script>

<template>
  <div ref="rootRef" :style="rootStyle">
    <Desktop />
  </div>
</template>
