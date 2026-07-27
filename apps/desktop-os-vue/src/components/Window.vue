<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IrisMovable, IrisResizable } from '@iris-ui-kit/vue'
import {
  type DesktopWindow,
  type SnapZone,
  type IrisMovablePosition,
  type IrisResizableSize,
} from './window-types'
import { getManifest } from '../catalog'
import { snapHintFor } from '../depth'
import { useOs } from '../os-state'
import { wm, useWmState } from '../wm'
import WindowBody from './WindowBody.vue'

const props = defineProps<{ window: DesktopWindow }>()
const emit = defineEmits<{ snapHint: [zone: SnapZone | null] }>()

const state = useWmState()
const { chrome } = useOs()
// Geometry to actually render (work area when maximized) — from the manager.
const rect = computed(() => wm.displayRect(props.window))
const focused = computed(() => wm.isFocused(props.window.id))
const maximized = computed(() => props.window.state === 'maximized')
const app = computed(() => getManifest(props.window.appId))
// iframe bodies own their own scrolling; component bodies scroll in the frame.
const bodyOverflow = computed(() => (app.value?.kind === 'iframe' ? 'hidden' : 'auto'))

// Window-control placement + style per OS: macOS = traffic-lights on the LEFT,
// Windows/KDE = glyph buttons on the RIGHT. Driven by the active chrome.
const controlsLeft = computed(() => chrome.value.controls === 'left')
// KDE shares the right-side glyph layout with Windows but uses a distinct button
// style (square-ish, tighter, accent hover) — keyed off `controlStyle`.
const kdeControls = computed(() => chrome.value.controlStyle === 'kde')
// Win11 maximize glyph differs by state; mac uses traffic-light dots instead.
const maxGlyph = computed(() => (maximized.value ? '❒' : '☐'))

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
          <!-- macOS: traffic-lights LEFT, then title. -->
          <template v-if="controlsLeft">
            <div style="padding: 0 10px">
              <div class="win-traffic">
                <button
                  type="button"
                  aria-label="Close"
                  class="win-dot win-dot--close"
                  @pointerdown.stop="wm.close(window.id)"
                />
                <button
                  type="button"
                  aria-label="Minimize"
                  class="win-dot win-dot--min"
                  @pointerdown.stop="wm.minimize(window.id)"
                />
                <button
                  type="button"
                  aria-label="Maximize"
                  class="win-dot win-dot--max"
                  @pointerdown.stop="wm.toggleMaximize(window.id)"
                />
              </div>
            </div>
            <div
              data-iris-movable-handle
              class="win-title"
              @dblclick="wm.toggleMaximize(window.id)"
            >
              <span aria-hidden="true" style="font-size: 14px">{{ app?.icon }}</span>
              <span class="win-title-text">{{ window.title }}</span>
            </div>
          </template>

          <!-- Windows/KDE: title left, glyph controls RIGHT. -->
          <template v-else>
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
                :class="{ 'win-ctl--kde': kdeControls }"
                @pointerdown.stop="wm.minimize(window.id)"
              >
                –
              </button>
              <button
                type="button"
                aria-label="Maximize"
                class="win-ctl"
                :class="{ 'win-ctl--kde': kdeControls }"
                @pointerdown.stop="wm.toggleMaximize(window.id)"
              >
                {{ maxGlyph }}
              </button>
              <button
                type="button"
                aria-label="Close"
                class="win-ctl win-ctl--close"
                :class="{ 'win-ctl--kde': kdeControls }"
                @pointerdown.stop="wm.close(window.id)"
              >
                ✕
              </button>
            </div>
          </template>
        </div>
        <div class="win-body" :style="{ flex: 1, minHeight: 0, overflow: bodyOverflow }">
          <WindowBody :app-id="window.appId" />
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
            <!-- macOS: traffic-lights LEFT, then title. -->
            <template v-if="controlsLeft">
              <div style="padding: 0 10px">
                <div class="win-traffic">
                  <button
                    type="button"
                    aria-label="Close"
                    class="win-dot win-dot--close"
                    @pointerdown.stop="wm.close(window.id)"
                  />
                  <button
                    type="button"
                    aria-label="Minimize"
                    class="win-dot win-dot--min"
                    @pointerdown.stop="wm.minimize(window.id)"
                  />
                  <button
                    type="button"
                    aria-label="Maximize"
                    class="win-dot win-dot--max"
                    @pointerdown.stop="wm.toggleMaximize(window.id)"
                  />
                </div>
              </div>
              <div
                data-iris-movable-handle
                class="win-title"
                @dblclick="wm.toggleMaximize(window.id)"
              >
                <span aria-hidden="true" style="font-size: 14px">{{ app?.icon }}</span>
                <span class="win-title-text">{{ window.title }}</span>
              </div>
            </template>

            <!-- Windows/KDE: title left, glyph controls RIGHT. -->
            <template v-else>
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
                  {{ maxGlyph }}
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
            </template>
          </div>
          <div class="win-body" :style="{ flex: 1, minHeight: 0, overflow: bodyOverflow }">
            <WindowBody :app-id="window.appId" />
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
/* macOS traffic-lights */
.win-traffic {
  display: flex;
  gap: 8px;
  align-items: center;
}
.win-dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  padding: 0;
}
.win-dot--close {
  background: #ff5f57;
}
.win-dot--min {
  background: #febc2e;
}
.win-dot--max {
  background: #28c840;
}
</style>
