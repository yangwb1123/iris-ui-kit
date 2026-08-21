import { createSignal, onCleanup, type JSX } from 'solid-js'
import { createCalendar, formatMonthYear, formatLocalISO, type CalendarConfig } from '../core'
import { CalendarGrid } from './calendar-grid'
import { CalendarHeader } from './calendar-header'

export type { CalendarEvent, CalendarConfig, CalendarState, CalendarStore } from '../core'

export interface IrisEventCalendarProps {
  config: CalendarConfig
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Render a month-view events calendar from a declarative config (SolidJS).
 * Displays a 7-column grid with event chips per day cell. Clicking a day
 * fires `config.onDateClick`; clicking an event chip fires
 * `config.onEventClick`. Themed via CSS vars.
 */
export function IrisEventCalendar(props: IrisEventCalendarProps) {
  // Create the store ONCE (props are read at construction only).
  const store = createCalendar(props.config)

  const [calendarState, setCalendarState] = createSignal(store.getState())
  onCleanup(store.subscribe(setCalendarState))

  const today = formatLocalISO(new Date())
  const monthLabel = () => formatMonthYear(new Date(calendarState().year, calendarState().month, 1))

  return (
    <div
      data-iris-event-calendar=""
      class={props.class}
      style={{ 'font-family': 'inherit', ...(props.style as Record<string, string>) }}
    >
      <CalendarHeader monthLabel={monthLabel} store={store} />
      <CalendarGrid
        state={calendarState}
        today={today}
        onDateClick={props.config.onDateClick}
        onEventClick={props.config.onEventClick}
      />
    </div>
  )
}
