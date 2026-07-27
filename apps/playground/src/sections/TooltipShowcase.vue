<script setup lang="ts">
import { IrisButton, IrisTooltip, type Placement } from '@iris-ui-kit/vue'

const placements: Placement[] = ['top', 'right', 'bottom', 'left']
</script>

<template>
  <section class="section">
    <h2 class="section-title">Tooltip</h2>

    <div class="row">
      <span class="row-label">placement</span>
      <IrisTooltip
        v-for="p in placements"
        :key="p"
        :placement="p"
        :open-delay="200"
        :content="`Tooltip on ${p}`"
      >
        <IrisButton variant="outline" size="sm">{{ p }}</IrisButton>
      </IrisTooltip>
    </div>

    <div class="row">
      <span class="row-label">delay</span>
      <IrisTooltip content="No delay" :open-delay="0">
        <IrisButton variant="ghost" size="sm">instant</IrisButton>
      </IrisTooltip>
      <IrisTooltip content="Hover for 1 second" :open-delay="1000">
        <IrisButton variant="ghost" size="sm">1s delay</IrisButton>
      </IrisTooltip>
    </div>

    <div class="row">
      <span class="row-label">rich</span>
      <IrisTooltip :open-delay="100">
        <IrisButton variant="solid" size="sm">rich content</IrisButton>
        <template #content>
          <div style="display: flex; flex-direction: column; gap: 4px">
            <strong>Keyboard shortcut</strong>
            <span style="opacity: 0.7">⌘ + S</span>
          </div>
        </template>
      </IrisTooltip>
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
.row-label {
  width: 72px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
