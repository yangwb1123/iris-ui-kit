<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisResizable,
  IrisMovable,
  IrisHotkey,
  IrisClickOutside,
  IrisCard,
  IrisButton,
  useToast,
} from '@iris-ui-kit/vue'

const toast = useToast()
const showFloating = ref(true)

const onEsc = () => toast.info({ title: 'Esc pressed' })
const onSave = (e: KeyboardEvent) => {
  e.preventDefault()
  toast.success({ title: 'Mod+S — Saved' })
}
const onStackedEsc = () => toast.info({ title: 'Esc captured by stacked panel' })
</script>

<template>
  <section class="section">
    <h2 class="section-title">Behaviors Layer</h2>

    <!-- resizable -->
    <div class="row col">
      <span class="row-label">resizable</span>
      <p class="hint">Drag any edge or corner of the box.</p>
      <IrisResizable :default-size="{ width: 320, height: 180 }" :min-width="120" :min-height="80">
        <IrisCard style="width: 100%; height: 100%; overflow: auto; margin: 0">
          <strong>I am resizable.</strong>
          <p class="hint" style="margin: 6px 0 0 0">
            The card itself doesn't know about resize — <code>IrisResizable</code> wraps it.
          </p>
        </IrisCard>
      </IrisResizable>
    </div>

    <!-- movable -->
    <div class="row col">
      <span class="row-label">movable</span>
      <p class="hint">Drag the title bar to move (byHandle mode).</p>
      <div class="stage" style="height: 240px">
        <IrisMovable
          :default-position="{ x: 20, y: 20 }"
          by-handle
          :bounds="{ minX: 0, minY: 0, maxX: 400, maxY: 160 }"
        >
          <IrisCard style="width: 240px; margin: 0; padding: 0">
            <div data-iris-movable-handle class="handle">≡ Drag me by this title bar</div>
            <div style="padding: 14px">
              <p class="hint" style="margin: 0">
                Body content stays still while you drag the handle.
              </p>
            </div>
          </IrisCard>
        </IrisMovable>
      </div>
    </div>

    <!-- hotkey -->
    <div class="row col">
      <span class="row-label">hotkey</span>
      <p class="hint">Press <code>Esc</code> or <code>⌘/Ctrl + S</code> anywhere on this page.</p>
      <IrisHotkey shortcut="Escape" @trigger="onEsc">
        <IrisHotkey shortcut="Mod+s" @trigger="onSave">
          <div />
        </IrisHotkey>
      </IrisHotkey>
    </div>

    <!-- click outside -->
    <div class="row col">
      <span class="row-label">click outside</span>
      <p class="hint">Click outside the orange box to dismiss it.</p>
      <IrisClickOutside v-if="showFloating" @outside="showFloating = false">
        <IrisCard class="warning" style="margin: 0; max-width: 320px">
          <strong>I'm listening for outside clicks.</strong>
          <p class="hint" style="margin: 6px 0 0 0">Try clicking anywhere outside this card.</p>
        </IrisCard>
      </IrisClickOutside>
      <IrisButton v-else size="sm" variant="outline" @click="showFloating = true"
        >Re-show</IrisButton
      >
    </div>

    <!-- stacked -->
    <div class="row col">
      <span class="row-label">stacked</span>
      <p class="hint">
        <code>&lt;Movable&gt;&lt;Hotkey&gt;&lt;Resizable&gt;…</code> — the same UI gets move +
        resize + Esc-to-log, with no change to the child component.
      </p>
      <div class="stage" style="height: 280px">
        <IrisMovable
          :default-position="{ x: 30, y: 30 }"
          by-handle
          :bounds="{ minX: 0, minY: 0, maxX: 380, maxY: 180 }"
        >
          <IrisHotkey shortcut="Escape" @trigger="onStackedEsc">
            <IrisResizable
              :default-size="{ width: 240, height: 140 }"
              :min-width="150"
              :min-height="100"
            >
              <IrisCard style="margin: 0; padding: 0; width: 100%; height: 100%">
                <div data-iris-movable-handle class="handle">≡ Stacked panel</div>
                <div style="padding: 12px; font-size: 12px; color: var(--iris-muted)">
                  Drag the bar to move · drag edges to resize · press Esc to log.
                </div>
              </IrisCard>
            </IrisResizable>
          </IrisHotkey>
        </IrisMovable>
      </div>
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: var(--iris-gap-md);
  flex-wrap: wrap;
}
.row + .row {
  margin-top: var(--iris-gap-lg);
}
.row.col {
  flex-direction: column;
  align-items: stretch;
}
.row-label {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.hint {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--iris-muted);
}
.stage {
  position: relative;
  border: 1px dashed var(--iris-border);
  border-radius: 8px;
  background: var(--iris-background);
}
.handle {
  padding: 8px 12px;
  background: var(--iris-surface-hover);
  border-bottom: 1px solid var(--iris-border);
  cursor: grab;
  font-size: 13px;
  font-weight: 600;
  user-select: none;
}
.warning {
  border-color: var(--iris-warning);
  background: color-mix(in srgb, var(--iris-warning) 12%, var(--iris-background));
}
</style>
