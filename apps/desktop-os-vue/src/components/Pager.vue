<script setup lang="ts">
/**
 * Virtual-desktop PAGER — the Vue mirror of React's `Pager`. A compact switcher
 * for the window manager's workspaces (GNOME/KDE pager feel): one pip per desktop,
 * highlights the active one, marks desktops that have windows, and switches on
 * click. Renders nothing when there's only a single workspace (the feature is
 * opt-in via the WM config). Token-skinned to the active OS; sits top-center
 * above windows.
 */
import { computed } from 'vue'
import { wm, useWmState } from '../wm'

const state = useWmState()

const desktops = computed(() =>
  Array.from({ length: state.value.workspaces }, (_, i) => ({
    index: i,
    active: i === state.value.currentWorkspace,
    hasWindows: state.value.windows.some((w) => w.workspace === i),
  })),
)
</script>

<template>
  <div v-if="state.workspaces > 1" role="tablist" aria-label="Virtual desktops" class="pager">
    <button
      v-for="d in desktops"
      :key="d.index"
      type="button"
      role="tab"
      :aria-selected="d.active"
      :aria-label="`Desktop ${d.index + 1}`"
      :title="`Desktop ${d.index + 1}`"
      class="pager-pip"
      :class="{ 'pager-pip--active': d.active, 'pager-pip--has': d.hasWindows }"
      @click="wm.setWorkspace(d.index)"
    >
      {{ d.index + 1 }}
    </button>
  </div>
</template>

<style scoped>
.pager {
  position: absolute;
  top: calc(var(--os-topbar-h, 0px) + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 80000;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--os-window-bg);
  border: var(--os-window-border);
  box-shadow: var(--os-window-shadow);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
}
.pager-pip {
  width: 26px;
  height: 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  line-height: 18px;
  color: inherit;
  border: 1px solid rgba(127, 127, 127, 0.4);
  background: transparent;
}
.pager-pip--has {
  border: 1px solid var(--os-accent);
}
.pager-pip--active {
  color: #fff;
  background: color-mix(in srgb, var(--os-accent) 85%, transparent);
}
</style>
