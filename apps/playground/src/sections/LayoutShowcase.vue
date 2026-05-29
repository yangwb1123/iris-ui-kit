<script setup lang="ts">
import { ref } from 'vue'
import { IrisDragger, IrisResizer, IrisSplitter } from '@iris-ui/vue'

const split = ref(0.4)
const size = ref({ width: 220, height: 140 })
const draggerPos = ref({ x: 16, y: 16 })
</script>

<template>
  <section class="section">
    <h2 class="section-title">Layout — Splitter / Resizer / Dragger</h2>

    <div class="row">
      <span class="row-label">splitter</span>
      <div
        style="
          width: 100%;
          height: 140px;
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md);
          overflow: hidden;
        "
      >
        <IrisSplitter v-model="split">
          <template #start>
            <div
              style="padding: var(--iris-padding-md); background: var(--iris-surface); height: 100%"
            >
              Left ({{ Math.round(split * 100) }}%)
            </div>
          </template>
          <template #end>
            <div style="padding: var(--iris-padding-md); height: 100%">
              Right ({{ Math.round((1 - split) * 100) }}%)
            </div>
          </template>
        </IrisSplitter>
      </div>
    </div>

    <div class="row">
      <span class="row-label">resizer</span>
      <IrisResizer v-model="size" :min-width="80" :min-height="60">
        <div
          style="
            width: 100%;
            height: 100%;
            background: var(--iris-surface);
            border: 1px solid var(--iris-border);
            border-radius: var(--iris-radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: ui-monospace, monospace;
            font-size: 12px;
          "
        >
          {{ Math.round(size.width) }}×{{ Math.round(size.height) }}
        </div>
      </IrisResizer>
    </div>

    <div class="row">
      <span class="row-label">dragger</span>
      <div
        style="
          position: relative;
          width: 100%;
          height: 140px;
          border: 1px dashed var(--iris-border);
          border-radius: var(--iris-radius-md);
          overflow: hidden;
        "
      >
        <IrisDragger v-model="draggerPos" :bounds="{ minX: 0, minY: 0, maxX: 800, maxY: 100 }">
          <template #handle>
            <div
              style="
                background: var(--iris-primary);
                color: var(--iris-primary-foreground);
                padding: 4px 12px;
                border-top-left-radius: var(--iris-radius-md);
                border-top-right-radius: var(--iris-radius-md);
                font-size: 12px;
                font-family: ui-monospace, monospace;
              "
            >
              ☰ drag me
            </div>
          </template>
          <div
            style="
              background: var(--iris-surface);
              border: 1px solid var(--iris-primary);
              border-top: none;
              padding: var(--iris-padding-md);
              width: 160px;
              font-size: 12px;
              font-family: ui-monospace, monospace;
              border-bottom-left-radius: var(--iris-radius-md);
              border-bottom-right-radius: var(--iris-radius-md);
            "
          >
            x: {{ Math.round(draggerPos.x) }}, y: {{ Math.round(draggerPos.y) }}
          </div>
        </IrisDragger>
      </div>
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: stretch;
  gap: var(--iris-gap-md);
  flex-wrap: wrap;
}
.row-label {
  width: 72px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
</style>
