<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisCalendar,
  IrisDatePicker,
  IrisDateRangePicker,
  IrisTimePicker,
  IrisFormField,
  type IrisDateRange,
  type IrisTimeValue,
} from '@iris-ui/vue'

const inlineDate = ref<Date | null>(new Date())
const popoverDate = ref<Date | null>(null)
const range = ref<IrisDateRange>({ start: null, end: null })
const time24 = ref<IrisTimeValue>({ hours: 14, minutes: 30 })
const time12 = ref<IrisTimeValue>({ hours: 9, minutes: 15 })
</script>

<template>
  <section class="section">
    <h2 class="section-title">Dates &amp; Time</h2>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">inline calendar</span>
      <IrisCalendar v-model="inlineDate" locale="en-US" />
      <span style="font-size: 12px; color: var(--iris-muted)">
        → {{ inlineDate?.toLocaleDateString() ?? '—' }}
      </span>
    </div>

    <div class="row">
      <span class="row-label">date picker</span>
      <IrisFormField label="Pick a date">
        <IrisDatePicker v-model="popoverDate" locale="en-US" />
      </IrisFormField>
    </div>

    <div class="row">
      <span class="row-label">date range</span>
      <IrisFormField label="Pick a range">
        <IrisDateRangePicker v-model="range" locale="en-US" />
      </IrisFormField>
    </div>

    <div class="row">
      <span class="row-label">time (24h)</span>
      <IrisFormField label="Meeting time">
        <IrisTimePicker v-model="time24" format="24h" :minute-step="5" />
      </IrisFormField>
    </div>

    <div class="row">
      <span class="row-label">time (12h)</span>
      <IrisFormField label="Alarm">
        <IrisTimePicker v-model="time12" format="12h" :minute-step="15" />
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
  width: 120px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-top: 8px;
}
</style>
