<template>
  <div style="display: flex; flex-direction: column; gap: 24px">
    <section class="section">
      <h2 class="section-title">Event Calendar</h2>
      <p style="color: var(--iris-muted); font-size: 14px; margin: 0 0 16px">
        Google Calendar-lite widget from <code>@iris-ui/plugin-calendar</code>.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 240px; gap: 24px">
        <IrisEventCalendar :config="config" />

        <div style="display: flex; flex-direction: column; gap: 8px">
          <div style="font-weight: 600; font-size: 14px">Interactions</div>
          <div v-if="lastEvent" class="interaction-card">
            <div style="color: var(--iris-muted); font-size: 11px">Last event</div>
            <div>{{ lastEvent }}</div>
          </div>
          <div v-if="lastDate" class="interaction-card">
            <div style="color: var(--iris-muted); font-size: 11px">Last date</div>
            <div>{{ lastDate }}</div>
          </div>
          <div v-if="!lastEvent && !lastDate" style="font-size: 13px; color: var(--iris-muted)">
            Click an event or date above
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { IrisEventCalendar, type CalendarEvent } from '@iris-ui/plugin-calendar/vue'

const lastEvent = ref<string | null>(null)
const lastDate = ref<string | null>(null)

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const day2 = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

const events: CalendarEvent[] = [
  { id: '1', title: 'Standup', date: today, color: '#6366f1' },
  { id: '2', title: 'Lunch', date: tomorrow, color: '#10b981' },
  { id: '3', title: 'Review', date: day2, color: '#f59e0b' },
  { id: '4', title: '1:1', date: yesterday, color: '#8b5cf6' },
]

const config = reactive({
  events,
  onEventClick: (event: CalendarEvent) => {
    lastEvent.value = event.title
  },
  onDateClick: (date: string) => {
    lastDate.value = date
  },
})
</script>

<style scoped>
.interaction-card {
  font-size: 13px;
  padding: 8px;
  background: var(--iris-surface);
  border-radius: 6px;
  border: 1px solid var(--iris-border);
}
</style>
