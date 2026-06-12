import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui/core'
import {
  createCalendar,
  calendarPlugin,
  calendarTokens,
  type CalendarConfig,
  type CalendarEvent,
} from './index'

const event1: CalendarEvent = {
  id: 'e1',
  title: 'Sprint Review',
  date: '2025-06-15',
  color: '#6366f1',
}
const event2: CalendarEvent = { id: 'e2', title: 'Team Lunch', date: '2025-06-15' }
const event3: CalendarEvent = { id: 'e3', title: 'Deploy', date: '2025-06-20' }

const baseConfig = (): CalendarConfig => ({
  initialYear: 2025,
  initialMonth: 5, // June (0-indexed)
  events: [event1, event2, event3],
})

describe('createCalendar core', () => {
  it('returns initial state matching config', () => {
    const store = createCalendar(baseConfig())
    const { year, month, events } = store.getState()
    expect(year).toBe(2025)
    expect(month).toBe(5)
    expect(events).toHaveLength(3)
  })

  it('eventsForDate returns events matching the date', () => {
    const store = createCalendar(baseConfig())
    const june15 = store.eventsForDate('2025-06-15')
    expect(june15).toHaveLength(2)
    expect(june15.map((e) => e.id)).toEqual(expect.arrayContaining(['e1', 'e2']))
  })

  it('eventsForDate returns empty array for a date with no events', () => {
    const store = createCalendar(baseConfig())
    expect(store.eventsForDate('2025-06-01')).toHaveLength(0)
  })

  it('prevMonth decrements month and notifies subscribers', () => {
    const store = createCalendar(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.prevMonth()

    const { year, month } = store.getState()
    expect(year).toBe(2025)
    expect(month).toBe(4) // May
    expect(listener).toHaveBeenCalledOnce()
  })

  it('prevMonth wraps December→January across year boundary', () => {
    const store = createCalendar({ initialYear: 2025, initialMonth: 0 }) // January
    store.prevMonth()
    const { year, month } = store.getState()
    expect(year).toBe(2024)
    expect(month).toBe(11) // December
  })

  it('nextMonth increments month and notifies subscribers', () => {
    const store = createCalendar(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.nextMonth()

    const { year, month } = store.getState()
    expect(year).toBe(2025)
    expect(month).toBe(6) // July
    expect(listener).toHaveBeenCalledOnce()
  })

  it('nextMonth wraps December→January across year boundary', () => {
    const store = createCalendar({ initialYear: 2025, initialMonth: 11 }) // December
    store.nextMonth()
    const { year, month } = store.getState()
    expect(year).toBe(2026)
    expect(month).toBe(0) // January
  })

  it('goToMonth sets year and month directly', () => {
    const store = createCalendar(baseConfig())
    store.goToMonth(2030, 3)
    const { year, month } = store.getState()
    expect(year).toBe(2030)
    expect(month).toBe(3)
  })

  it('addEvent appends an event and notifies subscribers', () => {
    const store = createCalendar(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.addEvent({ id: 'e4', title: 'New Event', date: '2025-06-10' })

    expect(store.getState().events).toHaveLength(4)
    expect(store.eventsForDate('2025-06-10')).toHaveLength(1)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('addEvent is a no-op when an event with the same id exists', () => {
    const store = createCalendar(baseConfig())
    const before = store.getState()
    store.addEvent({ id: 'e1', title: 'Duplicate', date: '2025-06-15' })
    expect(store.getState()).toBe(before)
  })

  it('removeEvent removes an event and notifies subscribers', () => {
    const store = createCalendar(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.removeEvent('e1')

    expect(store.getState().events).toHaveLength(2)
    expect(store.eventsForDate('2025-06-15')).toHaveLength(1)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('removeEvent is a no-op for a non-existent event id', () => {
    const store = createCalendar(baseConfig())
    const before = store.getState()
    store.removeEvent('ghost')
    expect(store.getState()).toBe(before)
  })

  it('subscribe returns an unsubscribe function that stops notifications', () => {
    const store = createCalendar(baseConfig())
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    unsub()
    store.nextMonth()
    expect(listener).not.toHaveBeenCalled()
  })

  it('mutations do not mutate the original config events', () => {
    const cfg = baseConfig()
    const store = createCalendar(cfg)
    store.addEvent({ id: 'e4', title: 'Added', date: '2025-06-01' })
    // Original config.events should still have only 3 items
    expect(cfg.events).toHaveLength(3)
  })

  it('defaults to current year/month when initialYear/initialMonth omitted', () => {
    const now = new Date()
    const store = createCalendar({})
    const { year, month } = store.getState()
    expect(year).toBe(now.getFullYear())
    expect(month).toBe(now.getMonth())
  })
})

describe('calendarPlugin', () => {
  it('registers calendar tokens', () => {
    const { tokens } = runPlugins([calendarPlugin])
    expect(tokens['--iris-cal-today-bg']).toBe(calendarTokens['--iris-cal-today-bg'])
    expect(tokens['--iris-cal-event-bg']).toBe(calendarTokens['--iris-cal-event-bg'])
    expect(tokens['--iris-cal-grid-gap']).toBe(calendarTokens['--iris-cal-grid-gap'])
  })
})
