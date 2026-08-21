import {
  createStore,
  createPlugin,
  buildMonthMatrix,
  formatMonthYear,
  getWeekdayNames,
  formatLocalISO,
  type Store,
} from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-calendar` — render an events calendar (Google Calendar
 * lite) from a declarative config. This `core` entry is framework-agnostic:
 * it owns all state and mutations (prevMonth, nextMonth, goToMonth,
 * addEvent, removeEvent) via a subscribable store. The four thin renderers
 * draw from it.
 */

export interface CalendarEvent {
  id: string
  title: string
  /** ISO date "YYYY-MM-DD" */
  date: string
  /** Optional event color (CSS colour string) */
  color?: string
  allDay?: boolean
}

export interface CalendarConfig {
  events?: CalendarEvent[]
  /** Defaults to current year */
  initialYear?: number
  /** 0-indexed; defaults to current month */
  initialMonth?: number
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: string) => void
}

export interface CalendarState {
  year: number
  /** 0-indexed */
  month: number
  events: CalendarEvent[]
}

export interface CalendarStore {
  getState(): CalendarState
  subscribe(cb: (s: CalendarState) => void): () => void
  prevMonth(): void
  nextMonth(): void
  goToMonth(year: number, month: number): void
  addEvent(event: CalendarEvent): void
  removeEvent(id: string): void
  eventsForDate(date: string): CalendarEvent[]
}

function createCalendarApi(
  store: Store<CalendarState>,
  prevMonth: () => void,
  nextMonth: () => void,
  goToMonth: (year: number, month: number) => void,
  addEvent: (event: CalendarEvent) => void,
  removeEvent: (id: string) => void,
  eventsForDate: (date: string) => CalendarEvent[],
): CalendarStore {
  return {
    getState: store.getState.bind(store),
    subscribe: store.subscribe.bind(store),
    prevMonth,
    nextMonth,
    goToMonth,
    addEvent,
    removeEvent,
    eventsForDate,
  }
}

/** Create a live CalendarStore from a config. */
class CalendarStoreEngine {
  readonly store: CalendarStore

  constructor(config: CalendarConfig) {
    const now = new Date()
    const initialYear = config.initialYear ?? now.getFullYear()
    const initialMonth = config.initialMonth ?? now.getMonth()

    const store = createStore<CalendarState>({
      year: initialYear,
      month: initialMonth,
      events: (config.events ?? []).map((e) => ({ ...e })),
    })

    const prevMonth = (): void => {
      const { year, month } = store.getState()
      if (month === 0) {
        store.setState({ ...store.getState(), year: year - 1, month: 11 })
      } else {
        store.setState({ ...store.getState(), month: month - 1 })
      }
    }

    const nextMonth = (): void => {
      const { year, month } = store.getState()
      if (month === 11) {
        store.setState({ ...store.getState(), year: year + 1, month: 0 })
      } else {
        store.setState({ ...store.getState(), month: month + 1 })
      }
    }

    const goToMonth = (year: number, month: number): void => {
      store.setState({ ...store.getState(), year, month })
    }

    const addEvent = (event: CalendarEvent): void => {
      const { events } = store.getState()
      if (events.some((e) => e.id === event.id)) return // duplicate id
      store.setState({ ...store.getState(), events: [...events, { ...event }] })
    }

    const removeEvent = (id: string): void => {
      const { events } = store.getState()
      const next = events.filter((e) => e.id !== id)
      if (next.length === events.length) return // not found — no-op
      store.setState({ ...store.getState(), events: next })
    }

    const eventsForDate = (date: string): CalendarEvent[] => {
      return store.getState().events.filter((e) => e.date === date)
    }

    this.store = createCalendarApi(
      store,
      prevMonth,
      nextMonth,
      goToMonth,
      addEvent,
      removeEvent,
      eventsForDate,
    )
  }
}

export function createCalendar(config: CalendarConfig): CalendarStore {
  return new CalendarStoreEngine(config).store
}

/** CSS custom properties the event calendar reads; overridable by the host theme. */
export const calendarTokens: Record<string, string> = {
  '--iris-cal-today-bg': 'var(--iris-primary)',
  '--iris-cal-event-bg': 'var(--iris-primary-subtle)',
  '--iris-cal-grid-gap': 'var(--iris-space-xxs, 4px)',
}

/**
 * The event-calendar plugin. Pass to `<IrisProvider plugins={[calendarPlugin]}>`.
 * Registers the calendar theme tokens.
 */
export const calendarPlugin = createPlugin({
  name: 'event-calendar',
  install(registry) {
    registry.registerTokens(calendarTokens)
  },
})

// Re-export core date helpers used by the renderers.
export { buildMonthMatrix, formatMonthYear, getWeekdayNames, formatLocalISO }
