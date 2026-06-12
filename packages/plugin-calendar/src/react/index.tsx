import * as React from 'react'
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
  style?: React.CSSProperties
}

/**
 * Render a month-view events calendar from a declarative config (React).
 * Displays a 7-column grid (Sun–Sat) with event chips per day cell.
 * Clicking a day fires `config.onDateClick`; clicking an event chip fires
 * `config.onEventClick`. Themed via CSS vars.
 */
export function IrisEventCalendar({ config, class: className, style }: IrisEventCalendarProps) {
  // Create the store ONCE (it owns all state); reads config at construction only.
  const storeRef = React.useRef<ReturnType<typeof createCalendar> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createCalendar(config)
  }
  const store = storeRef.current

  const calendarState = React.useSyncExternalStore(store.subscribe, store.getState, store.getState)

  const currentDate = new Date(calendarState.year, calendarState.month, 1)
  const matrix = buildMonthMatrix(currentDate, 0) // weekStartsOn=0 (Sunday)
  const weekdayNames = getWeekdayNames(0)
  const today = formatLocalISO(new Date())
  const monthLabel = formatMonthYear(currentDate)

  return (
    <div
      data-iris-event-calendar=""
      className={className}
      style={{ fontFamily: 'inherit', ...style }}
    >
      {/* Header: month/year + navigation */}
      <div
        data-iris-event-cal-header=""
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <button
          data-iris-event-cal-prev=""
          aria-label="Previous month"
          onClick={() => store.prevMonth()}
          style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2em' }}
        >
          ‹
        </button>
        <span data-iris-event-cal-title="" style={{ fontWeight: 600 }}>
          {monthLabel}
        </span>
        <button
          data-iris-event-cal-next=""
          aria-label="Next month"
          onClick={() => store.nextMonth()}
          style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2em' }}
        >
          ›
        </button>
      </div>

      {/* 7-column grid */}
      <div
        data-iris-event-cal-grid=""
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 'var(--iris-cal-grid-gap, 1px)',
        }}
      >
        {/* Weekday headers */}
        {weekdayNames.map((name) => (
          <div
            key={name}
            data-iris-event-cal-weekday=""
            style={{
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '0.75em',
              padding: '4px 0',
              color: 'var(--iris-color-muted, #6b7280)',
            }}
          >
            {name}
          </div>
        ))}

        {/* Day cells */}
        {matrix.flat().map((date) => {
          const iso = formatLocalISO(date)
          const isCurrentMonth = date.getMonth() === calendarState.month
          const isToday = iso === today
          const dayEvents = calendarState.events.filter((e) => e.date === iso)

          return (
            <div
              key={iso}
              data-iris-event-cal-day={iso}
              onClick={() => isCurrentMonth && config.onDateClick?.(iso)}
              style={{
                minHeight: 64,
                padding: 4,
                border: '1px solid var(--iris-color-border, #e5e7eb)',
                borderRadius: 4,
                cursor: isCurrentMonth ? 'pointer' : 'default',
                opacity: isCurrentMonth ? 1 : 0.4,
                background: 'transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {/* Day number */}
              <span
                data-iris-event-cal-day-num=""
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.8em',
                  fontWeight: isToday ? 700 : 400,
                  background: isToday ? 'var(--iris-cal-today-bg, #6366f1)' : 'transparent',
                  color: isToday ? '#fff' : 'inherit',
                  borderRadius: isToday ? '50%' : 0,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {date.getDate()}
              </span>

              {/* Event chips */}
              {dayEvents.map((event: CalendarEvent) => (
                <span
                  key={event.id}
                  data-iris-event-cal-chip={event.id}
                  title={event.title}
                  onClick={(e) => {
                    e.stopPropagation()
                    config.onEventClick?.(event)
                  }}
                  style={{
                    fontSize: '0.7em',
                    background: event.color
                      ? event.color
                      : 'var(--iris-cal-event-bg, rgba(99,102,241,0.15))',
                    color: event.color ? '#fff' : 'var(--iris-color-primary, #6366f1)',
                    borderRadius: 3,
                    padding: '1px 4px',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    cursor: 'pointer',
                    display: 'block',
                  }}
                >
                  {event.title}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
