<script setup lang="ts">
import { computed } from 'vue'
import { type SnapZone } from '@iris-ui-kit/core/window'
import { previewRect } from '../depth'
import { useWmState } from '../wm'

const props = defineProps<{ zone: SnapZone | null }>()

const state = useWmState()
const rect = computed(() => (props.zone ? previewRect(props.zone, state.value.workArea) : null))
</script>

<template>
  <div
    v-if="rect"
    aria-hidden="true"
    class="snap-preview"
    :style="{
      position: 'absolute',
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    }"
  />
</template>

<style scoped>
.snap-preview {
  z-index: 0;
  pointer-events: none;
  border-radius: var(--os-window-radius);
  background: color-mix(in srgb, var(--os-accent) 22%, transparent);
  border: 2px solid var(--os-accent);
  transition:
    left 0.1s ease,
    top 0.1s ease,
    width 0.1s ease,
    height 0.1s ease;
}
</style>
