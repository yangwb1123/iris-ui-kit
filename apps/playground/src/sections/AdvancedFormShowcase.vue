<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisSlider,
  IrisRangeSlider,
  IrisColorPicker,
  IrisFileUpload,
  IrisSelect,
  IrisFormField,
  type IrisFileUploadFile,
  type IrisRangeSliderValue,
} from '@iris-ui/vue'

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
      <span style="font-size: 12px; color: var(--iris-muted)">[{{ range[0] }} → {{ range[1] }}]</span>
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
        <code style="font-size: 14px; padding: 4px 8px; background: var(--iris-surface); border-radius: 4px">
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
</style>
