<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { wm } from './wm'
import { profile } from './profile'
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
  // Restore the persisted profile (incl. the saved OS skin) — the desktop renders
  // immediately and re-skins when hydrate lands. Mirrors the React shell.
  void profile.hydrate()
  applyWorkArea()
  const el = rootRef.value
  if (el) {
    ro = new ResizeObserver(applyWorkArea)
    ro.observe(el)
  }
})

// Recompute the work area when the OS changes (top-bar appears, bar height differs).
watch(chrome, applyWorkArea)

onUnmounted(() => ro?.disconnect())
</script>

<template>
  <div ref="rootRef" :style="rootStyle">
    <Desktop />
  </div>
</template>
