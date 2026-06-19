<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IrisMovable, IrisResizable } from '@iris-ui/vue'
import {
  type DesktopWindow,
  type SnapZone,
  type IrisMovablePosition,
  type IrisResizableSize,
} from './window-types'
import { getApp } from '../apps'
import { snapHintFor } from '../depth'
import { wm, useWmState } from '../wm'

const props = defineProps<{ window: DesktopWindow }>()
const emit = defineEmits<{ snapHint: [zone: SnapZone | null] }>()

const state = useWmState()
// Geometry to actually render (work area when maximized) — from the manager.
const rect = computed(() => wm.displayRect(props.window))
const focused = computed(() => wm.isFocused(props.window.id))
const maximized = computed(() => props.window.state === 'maximized')
const app = computed(() => getApp(props.window.appId))

// Play the open animation on the FIRST mount only.
const firstMount = ref(true)
onMounted(() => {
  firstMount.value = false
})

// The snap zone hinted by the IN-FLIGHT drag (mirrored to Desktop via emit).
let dragZone: SnapZone | null = null

function onPositionChange(p: IrisMovablePosition) {
  wm.move(props.window.id, p.x, p.y)
  const zone = snapHintFor(p, state.value.workArea)
  if (zone !== dragZone) {
    dragZone = zone
    emit('snapHint', zone)
  }
}

function onDragEnd() {
  const zone = dragZone
  dragZone = null
  emit('snapHint', null)
  if (zone) wm.snap(props.window.id, zone)
}

function onSizeChange(s: IrisResizableSize) {
  wm.resize(props.window.id, s.width, s.height)
}

const frameStyle = computed(() => ({
  display: 'flex',
  flexDirection: 'column' as const,
  width: '100%',
  height: '100%',
  borderRadius: maximized.value ? '0' : 'var(--os-window-radius)',
  overflow: 'hidden',
  background: 'var(--os-window-bg)',
  color: 'var(--os-window-fg)',
  border: 'var(--os-window-border)',
  boxShadow: focused.value ? 'var(--os-window-shadow)' : '0 6px 20px rgba(0,0,0,0.22)',
  backdropFilter: 'var(--os-blur)',
  WebkitBackdropFilter: 'var(--os-blur)',
}))
</script>

<template>
  <!-- Minimized windows render nothing. -->
  <template v-if="window.state !== 'minimized'">
    <!-- Maximized: pinned to the work area, no drag/resize. -->
    <div
      v-if="maximized"
      :style="{
        position: 'absolute',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: window.z,
      }"
    >
      <div
        class="win-frame"
        :class="{ 'win-open': firstMount }"
        :style="frameStyle"
        @pointerdown.capture="wm.focus(window.id)"
      >
        <!-- Titlebar (Windows 11: title left, controls right). -->
        <div
          class="win-titlebar"
          :style="{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--os-titlebar-bg)',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
          }"
        >
          <div data-iris-movable-handle class="win-title" @dblclick="wm.toggleMaximize(window.id)">
            <span aria-hidden="true" style="font-size: 14px">{{ app?.icon }}</span>
            <span class="win-title-text">{{ window.title }}</span>
          </div>
          <div style="display: flex; align-items: stretch">
            <button
              type="button"
              aria-label="Minimize"
              class="win-ctl"
              @pointerdown.stop="wm.minimize(window.id)"
            >
              –
            </button>
            <button
              type="button"
              aria-label="Maximize"
              class="win-ctl"
              @pointerdown.stop="wm.toggleMaximize(window.id)"
            >
              ❒
            </button>
            <button
              type="button"
              aria-label="Close"
              class="win-ctl win-ctl--close"
              @pointerdown.stop="wm.close(window.id)"
            >
              ✕
            </button>
          </div>
        </div>
        <div class="win-body" style="flex: 1; min-height: 0; overflow: auto">
          <component :is="app.component" v-if="app" />
          <div v-else style="padding: 16px">Unknown app: {{ window.appId }}</div>
        </div>
      </div>
    </div>

    <!-- Normal: draggable (IrisMovable) + resizable (IrisResizable). -->
    <IrisMovable
      v-else
      :position="{ x: rect.x, y: rect.y }"
      by-handle
      :style="{ zIndex: window.z }"
      @update:position="onPositionChange"
      @drag-end="onDragEnd"
    >
      <IrisResizable
        :size="{ width: rect.width, height: rect.height }"
        :handles="['right', 'bottom', 'bottom-right']"
        :min-width="window.minSize.width"
        :min-height="window.minSize.height"
        @update:size="onSizeChange"
      >
        <div
          class="win-frame"
          :class="{ 'win-open': firstMount }"
          :style="frameStyle"
          @pointerdown.capture="wm.focus(window.id)"
        >
          <div
            class="win-titlebar"
            :style="{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--os-titlebar-bg)',
              borderTopLeftRadius: 'inherit',
              borderTopRightRadius: 'inherit',
            }"
          >
            <div
              data-iris-movable-handle
              class="win-title"
              @dblclick="wm.toggleMaximize(window.id)"
            >
              <span aria-hidden="true" style="font-size: 14px">{{ app?.icon }}</span>
              <span class="win-title-text">{{ window.title }}</span>
            </div>
            <div style="display: flex; align-items: stretch">
              <button
                type="button"
                aria-label="Minimize"
                class="win-ctl"
                @pointerdown.stop="wm.minimize(window.id)"
              >
                –
              </button>
              <button
                type="button"
                aria-label="Maximize"
                class="win-ctl"
                @pointerdown.stop="wm.toggleMaximize(window.id)"
              >
                ☐
              </button>
              <button
                type="button"
                aria-label="Close"
                class="win-ctl win-ctl--close"
                @pointerdown.stop="wm.close(window.id)"
              >
                ✕
              </button>
            </div>
          </div>
          <div class="win-body" style="flex: 1; min-height: 0; overflow: auto">
            <component :is="app.component" v-if="app" />
            <div v-else style="padding: 16px">Unknown app: {{ window.appId }}</div>
          </div>
        </div>
      </IrisResizable>
    </IrisMovable>
  </template>
</template>

<style scoped>
.win-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--os-titlebar-h);
  padding: 0 10px;
  cursor: default;
  user-select: none;
  min-width: 0;
}
.win-title-text {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
