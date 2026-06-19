<script setup lang="ts">
import { IrisBadge } from '@iris-ui/vue'
</script>

<template>
  <div class="pane">
    <h2 style="margin: 0">Iris Desktop OS — Vue</h2>
    <p style="margin: 0">
      A windowed desktop shell whose entire window logic — open, focus &amp; z-order, minimize,
      maximize/restore, move/resize, edge-snap — lives in the framework-agnostic
      <code>@iris-ui/core/window</code> (<code>createWindowManager</code>). This shell is a thin
      <strong>Vue 3</strong> renderer over the <em>same</em> manager the React demo drives: drag
      uses <code>IrisMovable</code>, resize uses <code>IrisResizable</code>.
    </p>
    <p style="margin: 0">
      <strong>One logic, many looks.</strong> This Vue build ships the
      <strong>Windows 11</strong> skin only — the React demo at <code>apps/desktop-os</code> carries
      all three (Windows 11, macOS, KDE Plasma) switchable at runtime.
    </p>
    <div style="display: flex; gap: 8px; flex-wrap: wrap">
      <IrisBadge tone="primary" variant="subtle">createWindowManager</IrisBadge>
      <IrisBadge tone="success" variant="subtle">IrisMovable</IrisBadge>
      <IrisBadge tone="success" variant="subtle">IrisResizable</IrisBadge>
    </div>
  </div>
</template>

<style scoped>
.pane {
  padding: 20px;
  display: grid;
  gap: 14px;
  line-height: 1.6;
}
</style>
