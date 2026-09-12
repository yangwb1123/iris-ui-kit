<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IrisSlider,
  IrisRangeSlider,
  IrisColorPicker,
  IrisFileUpload,
  IrisSelect,
  IrisFormField,
  IrisTransfer,
  type IrisFileUploadFile,
  type IrisTransferItem,
  type IrisRangeSliderValue,
} from '@iris-ui-kit/vue'

const volume = ref(40)
const range = ref<IrisRangeSliderValue>([20, 80])
const color = ref('#3366cc')
const files = ref<IrisFileUploadFile[]>([])
const fruit = ref<string>('apple')
const fruitItems = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
]
const permissions: IrisTransferItem[] = [
  { label: 'Read articles', value: 'read-articles' },
  { label: 'Edit articles', value: 'edit-articles' },
  { label: 'Publish articles', value: 'publish-articles' },
  { label: 'Delete users', value: 'delete-users', disabled: true },
]
const assignedValues = ref<string[]>(['read-articles'])
const assignedLabels = computed(() =>
  permissions
    .filter((permission) => assignedValues.value.includes(permission.value))
    .map((permission) => permission.label),
)
</script>

<template>
  <section class="section">
    <h2 class="section-title">Advanced Form Inputs</h2>

    <div class="row">
      <span class="row-label">slider</span>
      <div style="flex: 1; min-width: 240px">
        <IrisSlider v-model="volume" :min="0" :max="100" :step="1" />
      </div>
      <span style="font-size: 12px; color: var(--iris-muted)">{{ volume }}</span>
    </div>

    <div class="row">
      <span class="row-label">range</span>
      <div style="flex: 1; min-width: 240px">
        <IrisRangeSlider v-model="range" :min="0" :max="100" :step="5" />
      </div>
      <span style="font-size: 12px; color: var(--iris-muted)"
        >[{{ range[0] }} → {{ range[1] }}]</span
      >
    </div>

    <div class="row">
      <span class="row-label">select</span>
      <IrisFormField label="Pick a fruit">
        <IrisSelect v-model="fruit" :items="fruitItems" />
      </IrisFormField>
      <span style="font-size: 12px; color: var(--iris-muted)">→ {{ fruit }}</span>
    </div>

    <div class="row">
      <span class="row-label">color</span>
      <div>
        <IrisColorPicker v-model="color" show-alpha />
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px">
        <span style="font-size: 12px; color: var(--iris-muted)">hex</span>
        <code
          style="
            font-size: 14px;
            padding: 4px 8px;
            background: var(--iris-surface);
            border-radius: 4px;
          "
        >
          {{ color }}
        </code>
        <div
          aria-label="color preview"
          :style="{
            width: '60px',
            height: '40px',
            borderRadius: '6px',
            border: '1px solid var(--iris-border)',
            background: color,
          }"
        />
      </div>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">upload</span>
      <IrisFormField label="Attach files" hint="JPG, PNG up to 5MB each. Max 3 files.">
        <IrisFileUpload
          v-model="files"
          accept=".jpg,.png,image/jpeg,image/png"
          multiple
          :max-files="3"
          :max-size="5 * 1024 * 1024"
        />
      </IrisFormField>
    </div>

    <div class="transfer-scenario">
      <h3 class="scenario-title">Permission assignment</h3>
      <p class="scenario-description">
        Search, select, and move permissions between available and assigned access. The assignment
        summary is derived from the controlled selection. Delete users is intentionally disabled.
      </p>
      <IrisTransfer
        v-model="assignedValues"
        :options="permissions"
        :titles="['Available permissions', 'Assigned permissions']"
        searchable
        aria-label="Permission assignment"
      />
      <p
        class="transfer-summary"
        data-testid="transfer-assignment-summary"
        role="status"
        aria-live="polite"
      >
        <span class="summary-label">Assigned:</span>
        {{ assignedLabels.length > 0 ? assignedLabels.join(', ') : 'None' }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: flex-start;
  gap: var(--iris-gap-md);
  flex-wrap: wrap;
}
.row + .row {
  margin-top: var(--iris-gap-lg);
}
.row-label {
  width: 80px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-top: 8px;
}
.transfer-scenario {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-sm);
  margin-top: var(--iris-space-xl);
  padding-top: var(--iris-gap-lg);
  border-block-start: 1px solid var(--iris-border);
  overflow-x: auto;
}
.scenario-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.scenario-description {
  margin: 0;
  color: var(--iris-muted);
  font-size: 13px;
  max-width: 720px;
}
.transfer-summary {
  margin: 0;
  font-size: 14px;
}
.summary-label {
  font-weight: 600;
}
</style>
