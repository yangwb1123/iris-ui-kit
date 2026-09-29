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

/** A serializable epoch timestamp or a Date snapshot supplied by the host. */
export type CalendarNow = Date | number

export interface CalendarConfig {
  events?: CalendarEvent[]
  /** Defaults to the injected snapshot, or a stable neutral month until mount. */
  initialYear?: number
  /** 0-indexed; defaults to the injected snapshot, or January until mount. */
  initialMonth?: number
  /**
   * Current-time snapshot used for default month and today marking. Supplying it
   * makes SSR deterministic; without it, the adapters resolve the runtime clock
   * only after mounting.
   */
  now?: CalendarNow
  /**
   * IANA time zone used to interpret `now` (for example, `America/New_York`).
   * Defaults to the runtime environment's local time zone.
   */
  timeZone?: string
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: string) => void
}

export interface CalendarState {
  year: number
  /** 0-indexed */
  month: number
  events: CalendarEvent[]
  /** Current day in the configured time zone; null before the client clock starts. */
  today?: string | null
}

export interface CalendarStore {
  getState(): CalendarState
  subscribe(cb: (s: CalendarState) => void): () => void
  prevMonth(): void
  nextMonth(): void
  goToMonth(year: number, month: number): void
  /** Apply an explicit current-time snapshot without reading the wall clock. */
  setNow(now: CalendarNow): void
  /** Resolve the runtime clock; adapters call this after mount, never during SSR. */
  refreshNow(): void
  /** Start post-mount clock updates. Returns a cleanup function. */
  startNow(intervalMs?: number): () => void
  addEvent(event: CalendarEvent): void
  removeEvent(id: string): void
  eventsForDate(date: string): CalendarEvent[]
}

const DEFAULT_INITIAL_YEAR = 1970
const DEFAULT_INITIAL_MONTH = 0
const DEFAULT_CLOCK_INTERVAL = 60_000

type CalendarDateParts = { year: number; month: number; day: number }

function toDate(snapshot: CalendarNow): Date {
  return snapshot instanceof Date ? snapshot : new Date(snapshot)
}

function readDateParts(snapshot: CalendarNow, timeZone?: string): CalendarDateParts | null {
  const date = toDate(snapshot)
  if (!Number.isFinite(date.getTime())) return null

  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date)
      const year = Number(parts.find((part) => part.type === 'year')?.value)
      const month = Number(parts.find((part) => part.type === 'month')?.value)
      const day = Number(parts.find((part) => part.type === 'day')?.value)
      if ([year, month, day].every(Number.isFinite)) {
        return { year, month: month - 1, day }
      }
    } catch {
      // Invalid IANA zones fall back to the runtime environment below.
    }
  }

  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

function formatDateParts(parts: CalendarDateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function createCalendarApi(
  store: Store<CalendarState>,
  prevMonth: () => void,
  nextMonth: () => void,
  goToMonth: (year: number, month: number) => void,
  setNow: (now: CalendarNow) => void,
  refreshNow: () => void,
  startNow: (intervalMs?: number) => () => void,
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
    setNow,
    refreshNow,
    startNow,
    addEvent,
    removeEvent,
    eventsForDate,
  }
}

/** Create a live CalendarStore from a config. */
class CalendarStoreEngine {
  readonly store: CalendarStore

  constructor(config: CalendarConfig) {
    const initialParts =
      config.now === undefined ? null : readDateParts(config.now, config.timeZone)
    const initialYear = config.initialYear ?? initialParts?.year ?? DEFAULT_INITIAL_YEAR
    const initialMonth = config.initialMonth ?? initialParts?.month ?? DEFAULT_INITIAL_MONTH

    const store = createStore<CalendarState>({
      year: initialYear,
      month: initialMonth,
      events: (config.events ?? []).map((e) => ({ ...e })),
      today: initialParts ? formatDateParts(initialParts) : null,
    })

    // A default calendar follows the current month until the user navigates.
    // Explicit initial values retain their existing controlled starting point.
    let followsCurrentMonth = config.initialYear === undefined || config.initialMonth === undefined
    let clockTimer: ReturnType<typeof setTimeout> | undefined
    let clockGeneration = 0

    const prevMonth = (): void => {
      followsCurrentMonth = false
      const { year, month } = store.getState()
      if (month === 0) {
        store.setState({ ...store.getState(), year: year - 1, month: 11 })
      } else {
        store.setState({ ...store.getState(), month: month - 1 })
      }
    }

    const nextMonth = (): void => {
      followsCurrentMonth = false
      const { year, month } = store.getState()
      if (month === 11) {
        store.setState({ ...store.getState(), year: year + 1, month: 0 })
      } else {
        store.setState({ ...store.getState(), month: month + 1 })
      }
    }

    const goToMonth = (year: number, month: number): void => {
      followsCurrentMonth = false
      store.setState({ ...store.getState(), year, month })
    }

    const setNow = (snapshot: CalendarNow): void => {
      const parts = readDateParts(snapshot, config.timeZone)
      if (!parts) return
      const current = store.getState()
      const year =
        followsCurrentMonth && config.initialYear === undefined ? parts.year : current.year
      const month =
        followsCurrentMonth && config.initialMonth === undefined ? parts.month : current.month
      const today = formatDateParts(parts)
      if (current.year === year && current.month === month && current.today === today) return
      store.setState({ ...current, year, month, today })
    }

    const refreshNow = (): void => {
      // This is intentionally called only by a post-mount adapter effect.
      setNow(new Date())
    }

    const stopNow = (): void => {
      if (clockTimer !== undefined) {
        clearTimeout(clockTimer)
        clockTimer = undefined
      }
    }

    const startNow = (intervalMs?: number): (() => void) => {
      stopNow()
      const generation = ++clockGeneration
      refreshNow()
      const customDelay =
        intervalMs !== undefined && Number.isFinite(intervalMs) && intervalMs > 0
          ? intervalMs
          : undefined

      const schedule = (): void => {
        // Align the default refresh with a minute boundary so a midnight
        // rollover is observed without polling every second. An explicit
        // delay remains useful for hosts/tests that want a tighter cadence.
        const current = new Date()
        const nextMinute =
          customDelay ??
          Math.max(1, DEFAULT_CLOCK_INTERVAL - (current.getTime() % DEFAULT_CLOCK_INTERVAL))
        const timer = setTimeout(() => {
          if (clockGeneration !== generation || clockTimer !== timer) return
          clockTimer = undefined
          refreshNow()
          if (clockGeneration === generation) schedule()
        }, nextMinute)
        clockTimer = timer
      }

      schedule()
      return () => {
        if (clockGeneration !== generation) return
        clockGeneration += 1
        stopNow()
      }
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
      setNow,
      refreshNow,
      startNow,
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
