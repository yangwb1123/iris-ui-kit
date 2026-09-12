<script setup lang="ts">
import { computed, ref } from 'vue'
import { IrisTransfer, type IrisTransferItem } from '@iris-ui-kit/vue'

const permissionOptions: IrisTransferItem[] = [
  { label: 'Read users', value: 'users.read' },
  { label: 'Ops', value: 'ops' },
  { label: 'Export reports', value: 'reports.export' },
  { label: 'Manage billing', value: 'billing.manage', disabled: true },
]

const selectedValues = ref<string[]>(['users.read'])
const selectionReadout = computed(() =>
  selectedValues.value.length ? selectedValues.value.join(', ') : '(none)',
)
</script>

<template>
  <section class="section transfer-showcase" data-testid="transfer-showcase">
    <div class="transfer-heading">
      <div>
        <h2 class="section-title">Transfer — Permission assignment</h2>
        <p class="transfer-description">
          Move permissions between the available and assigned panes. Search is enabled in both
          panes, and the readout below is updated by the controlled selection.
        </p>
      </div>
      <div
        class="selection-readout"
        data-testid="transfer-selection-readout"
        role="status"
        aria-live="polite"
      >
        Selected values: {{ selectionReadout }}
      </div>
    </div>

    <div class="transfer-scenario">
      <h3 class="scenario-title">Controlled selection with a disabled permission</h3>
      <p class="scenario-description">
        Start with <code>users.read</code> assigned. Select and move <code>ops</code> to the target,
        then move it back. <strong>Manage billing</strong> stays disabled, unchecked, and out of the
        selection even when source select-all is used.
      </p>
      <IrisTransfer
        v-model="selectedValues"
        :options="permissionOptions"
        :titles="['Available permissions', 'Assigned permissions']"
        searchable
      />
    </div>
  </section>
</template>

<style scoped>
.transfer-showcase {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-lg, 20px);
}

.transfer-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--iris-gap-lg, 20px);
  flex-wrap: wrap;
}

.transfer-description,
.scenario-description {
  margin: 0;
  color: var(--iris-muted);
  font-size: var(--iris-font-size-sm, 13px);
  line-height: 1.5;
}

.transfer-description {
  max-width: 620px;
}

.selection-readout {
  flex: 0 1 auto;
  padding: var(--iris-space-sm, 12px) var(--iris-space-md, 16px);
  border: 1px solid var(--iris-border);
  border-radius: var(--iris-radius-md, 8px);
  background: var(--iris-background);
  color: var(--iris-foreground);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: var(--iris-font-size-sm, 13px);
  font-weight: 600;
}

.transfer-scenario {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--iris-gap-sm, 12px);
  overflow-x: auto;
}

.scenario-title {
  margin: 0;
  font-size: var(--iris-font-size-md, 14px);
  font-weight: 600;
}

code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  color: var(--iris-foreground);
}

@media (max-width: 680px) {
  .transfer-scenario :deep([data-iris-transfer]) {
    align-items: center;
    flex-direction: column;
  }
}
</style>
