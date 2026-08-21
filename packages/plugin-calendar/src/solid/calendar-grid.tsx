import { For, type Accessor, type JSX } from 'solid-js'
import {
  buildMonthMatrix,
  formatLocalISO,
  getWeekdayNames,
  type CalendarEvent,
  type CalendarState,
} from '../core'

export interface CalendarGridProps {
  state: Accessor<CalendarState>
  today: string
  onDateClick?: (date: string) => void
  onEventClick?: (event: CalendarEvent) => void
}

const gridStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(7, 1fr)',
  gap: 'var(--iris-cal-grid-gap, var(--iris-space-xxs, 4px))',
}

const weekdayStyle: JSX.CSSProperties = {
  'text-align': 'center',
  'font-weight': '600',
  'font-size': '0.75em',
  padding: '4px 0',
  color: 'var(--iris-muted, #64748b)',
}

const dayStyle: JSX.CSSProperties = {
  'min-height': '64px',
  padding: '4px',
  border: '1px solid var(--iris-border, #e2e8f0)',
  'border-radius': '4px',
  background: 'transparent',
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--iris-space-xxs, 4px)',
}

const chipStyle: JSX.CSSProperties = {
  'font-size': '0.7em',
  'border-radius': '4px',
  padding: 'var(--iris-space-xxs, 4px) 4px',
  overflow: 'hidden',
  'white-space': 'nowrap',
  'text-overflow': 'ellipsis',
  cursor: 'pointer',
  display: 'block',
}

function DayNumber(props: { date: Date; today: boolean }): JSX.Element {
  return (
    <span
      data-iris-event-cal-day-num=""
      style={{
        'align-self': 'flex-start',
        'font-size': '0.8em',
        'font-weight': props.today ? '700' : '400',
        background: props.today
          ? 'var(--iris-cal-today-bg, var(--iris-primary, #6366f1))'
          : 'transparent',
        color: props.today ? 'var(--iris-primary-foreground, #fff)' : 'inherit',
        'border-radius': props.today ? '50%' : '0',
        width: '22px',
        height: '22px',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
      }}
    >
      {props.date.getDate()}
    </span>
  )
}

function EventChip(props: {
  event: CalendarEvent
  onEventClick?: (event: CalendarEvent) => void
}): JSX.Element {
  const event = props.event
  return (
    <span
      data-iris-event-cal-chip={event.id}
      title={event.title}
      style={{
        ...chipStyle,
        background: event.color ? event.color : 'var(--iris-cal-event-bg, rgba(99,102,241,0.15))',
        color: event.color ? 'var(--iris-on-color, #ffffff)' : 'var(--iris-primary, #6366f1)',
      }}
      onClick={(e) => {
        e.stopPropagation()
        props.onEventClick?.(event)
      }}
    >
      {event.title}
    </span>
  )
}

function CalendarDay(props: {
  date: Date
  currentMonth: number
  today: string
  events: Accessor<CalendarEvent[]>
  onDateClick?: (date: string) => void
  onEventClick?: (event: CalendarEvent) => void
}): JSX.Element {
  const iso = formatLocalISO(props.date)
  const isCurrentMonth = props.date.getMonth() === props.currentMonth
  const isToday = iso === props.today
  return (
    <div
      data-iris-event-cal-day={iso}
      style={{
        ...dayStyle,
        cursor: isCurrentMonth ? 'pointer' : 'default',
        opacity: isCurrentMonth ? '1' : '0.4',
      }}
      onClick={() => {
        if (isCurrentMonth) props.onDateClick?.(iso)
      }}
    >
      <DayNumber date={props.date} today={isToday} />
      <For each={props.events().filter((event) => event.date === iso)}>
        {(event) => <EventChip event={event} onEventClick={props.onEventClick} />}
      </For>
    </div>
  )
}

/** Seven-column month grid with reactive day cells and event chips. */
export function CalendarGrid(props: CalendarGridProps): JSX.Element {
  return (
    <div data-iris-event-cal-grid="" style={gridStyle}>
      <For each={getWeekdayNames(0)}>
        {(name) => (
          <div data-iris-event-cal-weekday="" style={weekdayStyle}>
            {name}
          </div>
        )}
      </For>
      <For each={buildMonthMatrix(new Date(props.state().year, props.state().month, 1), 0).flat()}>
        {(date) => (
          <CalendarDay
            date={date}
            currentMonth={props.state().month}
            today={props.today}
            events={() => props.state().events}
            onDateClick={props.onDateClick}
            onEventClick={props.onEventClick}
          />
        )}
      </For>
    </div>
  )
}
