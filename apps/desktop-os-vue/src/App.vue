<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { wm, TASKBAR_H } from './wm'
import Desktop from './components/Desktop.vue'

/**
 * The Windows-11 skin — applied as CSS custom properties on the root so the
 * whole shell (and the @iris-ui/vue components inside windows) reads `var(--os-*)`.
 * One look here; the React demo carries all three (Win11 / macOS / KDE).
 */
const WIN11_VARS: Record<string, string> = {
  '--os-accent': '#0a84ff',
  '--os-window-bg': 'rgba(243, 243, 243, 0.92)',
  '--os-window-fg': '#1b1b1b',
  '--os-window-radius': '8px',
  '--os-window-border': '1px solid rgba(255, 255, 255, 0.5)',
  '--os-window-shadow': '0 16px 48px rgba(0, 0, 0, 0.36)',
  '--os-titlebar-bg': 'rgba(255, 255, 255, 0.6)',
  '--os-titlebar-h': '36px',
  '--os-bar-bg': 'rgba(243, 243, 243, 0.72)',
  '--os-bar-fg': '#1b1b1b',
  '--os-bar-h': `${TASKBAR_H}px`,
  '--os-blur': 'blur(28px) saturate(1.6)',
  '--os-wallpaper': 'radial-gradient(140% 120% at 70% 10%, #4cc2ff 0%, #2b6cb0 42%, #11294f 100%)',
  '--os-font': "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif",
}

const rootStyle: Record<string, string> = {
  position: 'fixed',
  inset: '0',
  overflow: 'hidden',
  fontFamily: 'var(--os-font)',
  background: 'var(--os-wallpaper)',
  ...WIN11_VARS,
}

const rootRef = ref<HTMLElement | null>(null)
let ro: ResizeObserver | undefined

// Reserve the taskbar and feed the remaining rectangle to the WM as its work
// area (drives maximize + snap). Re-measured on resize.
onMounted(() => {
  const el = rootRef.value
  if (!el) return
  const apply = () => {
    const r = el.getBoundingClientRect()
    wm.setWorkArea({
      x: 0,
      y: 0,
      width: r.width,
      height: Math.max(240, r.height - TASKBAR_H),
    })
  }
  apply()
  ro = new ResizeObserver(apply)
  ro.observe(el)
})

onUnmounted(() => ro?.disconnect())
</script>

<template>
  <div ref="rootRef" :style="rootStyle">
    <Desktop />
  </div>
</template>
