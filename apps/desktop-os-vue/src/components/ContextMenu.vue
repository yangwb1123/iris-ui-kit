<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

/** A single menu row, or a divider. */
export type MenuItem =
  | { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }
  | { separator: true }

const isSeparator = (item: MenuItem): item is { separator: true } =>
  (item as { separator?: true }).separator === true

const MENU_WIDTH = 220
const VIEWPORT_MARGIN = 8

/**
 * A reusable right-click menu, token-styled to the active OS skin. Renders at
 * (x, y), clamped into the viewport, and dismisses on click-outside (captured
 * pointerdown) or Escape. Item clicks fire `onClick` then close. The Vue twin of
 * the React demo's ContextMenu.
 */
const props = defineProps<{
  /** Anchor position (viewport coordinates); the menu is clamped to stay on screen. */
  x: number
  y: number
  items: MenuItem[]
}>()
const emit = defineEmits<{ close: [] }>()

const root = ref<HTMLDivElement | null>(null)
// Measured position so the clamp can account for the menu's real height.
const pos = ref({ left: props.x, top: props.y })

/** Re-clamp into the viewport using the menu's measured size. */
function clamp() {
  const el = root.value
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = el?.offsetWidth ?? MENU_WIDTH
  const height = el?.offsetHeight ?? 0
  pos.value = {
    left: Math.max(VIEWPORT_MARGIN, Math.min(props.x, vw - width - VIEWPORT_MARGIN)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(props.y, vh - height - VIEWPORT_MARGIN)),
  }
}

// Re-clamp whenever the anchor or item set changes (after the DOM updates).
watch(
  () => [props.x, props.y, props.items] as const,
  () => clamp(),
  { flush: 'post' },
)

function select(item: Extract<MenuItem, { label: string }>) {
  if (item.disabled) return
  item.onClick?.()
  emit('close')
}

function onPointerDown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) emit('close')
}
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  clamp()
  // Capture so we win over the desktop's own pointerdown handler.
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeyDown)
})

const style = computed(() => ({ left: `${pos.value.left}px`, top: `${pos.value.top}px` }))
</script>

<template>
  <div
    ref="root"
    role="menu"
    class="ctx-menu"
    :style="style"
    @pointerdown.stop
    @contextmenu.prevent
  >
    <template v-for="(item, i) in items" :key="isSeparator(item) ? `sep-${i}` : item.label">
      <div v-if="isSeparator(item)" role="separator" class="ctx-menu-sep" />
      <button
        v-else
        type="button"
        role="menuitem"
        class="ctx-menu-item"
        :class="{ 'ctx-menu-item--danger': item.danger }"
        :disabled="item.disabled"
        @click="select(item)"
      >
        {{ item.label }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 99999;
  min-width: 220px;
  padding: 6px;
  border-radius: var(--os-window-radius);
  background: var(--os-window-bg);
  color: var(--os-window-fg);
  border: var(--os-window-border);
  box-shadow: var(--os-window-shadow);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  font: 13px var(--os-font);
  user-select: none;
}
.ctx-menu-sep {
  height: 1px;
  margin: 5px 6px;
  background: rgba(127, 127, 127, 0.28);
}
.ctx-menu-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.ctx-menu-item:hover:not(:disabled) {
  background: color-mix(in srgb, var(--os-accent) 22%, transparent);
}
.ctx-menu-item:disabled {
  opacity: 0.45;
  cursor: default;
}
.ctx-menu-item--danger {
  color: #e5484d;
}
</style>
