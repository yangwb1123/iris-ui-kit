import { createSignal, onCleanup, For, type JSX } from 'solid-js'
import {
  createCalendar,
  buildMonthMatrix,
  formatMonthYear,
  getWeekdayNames,
  formatLocalISO,
  type CalendarConfig,
  type CalendarEvent,
} from '../core'

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

  return (
    <div
      data-iris-event-calendar=""
      class={props.class}
      style={{ 'font-family': 'inherit', ...(props.style as Record<string, string>) }}
    >
      {/* Header */}
      <div
        data-iris-event-cal-header=""
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          'margin-bottom': '8px',
        }}
      >
        <button
          data-iris-event-cal-prev=""
          aria-label="Previous month"
          onClick={() => store.prevMonth()}
          style={{ cursor: 'pointer', background: 'none', border: 'none', 'font-size': '1.2em' }}
        >
          ‹
        </button>
        <span data-iris-event-cal-title="" style={{ 'font-weight': '600' }}>
          {formatMonthYear(new Date(calendarState().year, calendarState().month, 1))}
        </span>
        <button
          data-iris-event-cal-next=""
          aria-label="Next month"
          onClick={() => store.nextMonth()}
          style={{ cursor: 'pointer', background: 'none', border: 'none', 'font-size': '1.2em' }}
        >
          ›
        </button>
      </div>

      {/* 7-column grid */}
      <div
        data-iris-event-cal-grid=""
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(7, 1fr)',
          gap: 'var(--iris-cal-grid-gap, 1px)',
        }}
      >
        {/* Weekday headers */}
        <For each={getWeekdayNames(0)}>
          {(name) => (
            <div
              data-iris-event-cal-weekday=""
              style={{
                'text-align': 'center',
                'font-weight': '600',
                'font-size': '0.75em',
                padding: '4px 0',
                color: 'var(--iris-color-muted, #6b7280)',
              }}
            >
              {name}
            </div>
          )}
        </For>

        {/* Day cells */}
        <For
          each={buildMonthMatrix(
            new Date(calendarState().year, calendarState().month, 1),
            0,
          ).flat()}
        >
          {(date) => {
            const iso = formatLocalISO(date)
            const isCurrentMonth = date.getMonth() === calendarState().month
            const isToday = iso === today
            const dayEvents = () =>
              calendarState().events.filter((e: CalendarEvent) => e.date === iso)

            return (
              <div
                data-iris-event-cal-day={iso}
                style={{
                  'min-height': '64px',
                  padding: '4px',
                  border: '1px solid var(--iris-color-border, #e5e7eb)',
                  'border-radius': '4px',
                  cursor: isCurrentMonth ? 'pointer' : 'default',
                  opacity: isCurrentMonth ? '1' : '0.4',
                  background: 'transparent',
                  display: 'flex',
                  'flex-direction': 'column',
                  gap: '2px',
                }}
                onClick={() => {
                  if (isCurrentMonth) props.config.onDateClick?.(iso)
                }}
              >
                {/* Day number */}
                <span
                  data-iris-event-cal-day-num=""
                  style={{
                    'align-self': 'flex-start',
                    'font-size': '0.8em',
                    'font-weight': isToday ? '700' : '400',
                    background: isToday ? 'var(--iris-cal-today-bg, #6366f1)' : 'transparent',
                    color: isToday ? '#fff' : 'inherit',
                    'border-radius': isToday ? '50%' : '0',
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                  }}
                >
                  {date.getDate()}
                </span>

                {/* Event chips */}
                <For each={dayEvents()}>
                  {(event) => (
                    <span
                      data-iris-event-cal-chip={event.id}
                      title={event.title}
                      style={{
                        'font-size': '0.7em',
                        background: event.color
                          ? event.color
                          : 'var(--iris-cal-event-bg, rgba(99,102,241,0.15))',
                        color: event.color ? '#fff' : 'var(--iris-color-primary, #6366f1)',
                        'border-radius': '3px',
                        padding: '1px 4px',
                        overflow: 'hidden',
                        'white-space': 'nowrap',
                        'text-overflow': 'ellipsis',
                        cursor: 'pointer',
                        display: 'block',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        props.config.onEventClick?.(event)
                      }}
                    >
                      {event.title}
                    </span>
                  )}
                </For>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
