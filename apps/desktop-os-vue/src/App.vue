<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { serializeSession, restoreSession, type WindowSession } from '@iris-ui/core/window'
import { wm } from './wm'
import { profile } from './profile'
import { getManifest, registerCustomApps, type AppManifest } from './catalog'
import { useOs } from './os-state'
import { barInsets } from './os'
import Desktop from './components/Desktop.vue'

/**
 * The desktop, parameterized by the active OS skin. The skin is a set of CSS
 * custom properties (`--os-*`) applied on the root so the whole shell — and the
 * @iris-ui/vue components inside windows — reads `var(--os-*)`. Switching the OS
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
  // immediately and re-skins when hydrate lands — then restore the window session.
  void profile.hydrate().then(restoreSessionOnce)
})

// Recompute the work area when the OS changes (top-bar appears, bar height differs).
watch(chrome, applyWorkArea)

onUnmounted(() => {
  ro?.disconnect()
  clearTimeout(saveTimer)
  saveUnsubscribe?.()
})
</script>

<template>
  <div ref="rootRef" :style="rootStyle">
    <Desktop />
  </div>
</template>
