<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisButton,
  IrisPopover,
  IrisPopoverContent,
  IrisPopoverTrigger,
  type Placement,
} from '@iris-ui/vue'

const placements: Placement[] = ['top', 'right', 'bottom', 'left']
const controlledOpen = ref(false)
</script>

<template>
  <section class="section">
    <h2 class="section-title">Popover</h2>

    <div class="row">
      <span class="row-label">placement</span>
      <IrisPopover v-for="p in placements" :key="p" :placement="p" :offset="8">
        <IrisPopoverTrigger as-child>
          <IrisButton variant="outline" size="sm">{{ p }}</IrisButton>
        </IrisPopoverTrigger>
        <IrisPopoverContent>
          <div style="display: flex; flex-direction: column; gap: 8px; min-width: 160px">
            <strong>{{ p }}</strong>
            <span style="font-size: 12px; color: var(--iris-muted)">
              Click outside or press Esc to dismiss.
            </span>
          </div>
        </IrisPopoverContent>
      </IrisPopover>
    </div>

    <div class="row">
      <span class="row-label">controlled</span>
      <IrisButton size="sm" @click="controlledOpen = !controlledOpen">
        {{ controlledOpen ? 'Close' : 'Open' }} popover
      </IrisButton>
      <IrisPopover v-model:open="controlledOpen" placement="bottom-start">
        <IrisPopoverTrigger as-child>
          <IrisButton variant="solid" size="sm">anchor</IrisButton>
        </IrisPopoverTrigger>
        <IrisPopoverContent>
          <div style="display: flex; flex-direction: column; gap: 8px; min-width: 200px">
            <strong>Controlled mode</strong>
            <span style="font-size: 12px; color: var(--iris-muted)">
              Open state is owned by the parent. Toggle via either button.
            </span>
            <IrisButton variant="ghost" size="sm" @click="controlledOpen = false">
              Close from inside
            </IrisButton>
          </div>
        </IrisPopoverContent>
      </IrisPopover>
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
