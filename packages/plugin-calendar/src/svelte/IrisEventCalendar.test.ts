import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import IrisEventCalendar from './IrisEventCalendar.svelte'
import type { CalendarConfig } from '../core'

const config = (): CalendarConfig => ({
  initialYear: 2025,
  initialMonth: 5, // June
  events: [
    { id: 'e1', title: 'Sprint Review', date: '2025-06-15', color: '#6366f1' },
    { id: 'e2', title: 'Team Lunch', date: '2025-06-15' },
    { id: 'e3', title: 'Deploy', date: '2025-06-20' },
  ],
})

describe('IrisEventCalendar (svelte)', () => {
  it('renders the calendar root', () => {
    const { container } = render(IrisEventCalendar, { props: { config: config() } })
    expect(container.querySelector('[data-iris-event-calendar]')).toBeTruthy()
  })

  it('renders month title containing the year', () => {
    const { container } = render(IrisEventCalendar, { props: { config: config() } })
    const title = container.querySelector('[data-iris-event-cal-title]')!
    expect(title.textContent).toContain('2025')
  })

  it('renders 7 weekday headers', () => {
    const { container } = render(IrisEventCalendar, { props: { config: config() } })
    expect(container.querySelectorAll('[data-iris-event-cal-weekday]')).toHaveLength(7)
  })

  it('renders 42 day cells (6 × 7 grid)', () => {
    const { container } = render(IrisEventCalendar, { props: { config: config() } })
    expect(container.querySelectorAll('[data-iris-event-cal-day]')).toHaveLength(42)
  })

  it('renders event chips on the correct day cell', () => {
    const { container } = render(IrisEventCalendar, { props: { config: config() } })
    const cell = container.querySelector('[data-iris-event-cal-day="2025-06-15"]')!
    expect(cell.querySelectorAll('[data-iris-event-cal-chip]')).toHaveLength(2)
  })

  it('prev button navigates to previous month', async () => {
    const { container } = render(IrisEventCalendar, { props: { config: config() } })
    const before = container.querySelector('[data-iris-event-cal-title]')!.textContent
    await fireEvent.click(container.querySelector('[data-iris-event-cal-prev]')!)
    const after = container.querySelector('[data-iris-event-cal-title]')!.textContent
    expect(after).not.toBe(before)
    expect(after).toContain('2025')
    expect(container.querySelector('[data-iris-event-cal-day="2025-05-01"]')).toBeTruthy()
  })

  it('next button navigates to next month', async () => {
    const { container } = render(IrisEventCalendar, { props: { config: config() } })
    const before = container.querySelector('[data-iris-event-cal-title]')!.textContent
    await fireEvent.click(container.querySelector('[data-iris-event-cal-next]')!)
    const after = container.querySelector('[data-iris-event-cal-title]')!.textContent
    expect(after).not.toBe(before)
    expect(after).toContain('2025')
    expect(container.querySelector('[data-iris-event-cal-day="2025-07-01"]')).toBeTruthy()
  })

  it('clicking a day fires onDateClick', async () => {
    const onDateClick = vi.fn()
    const cfg = { ...config(), onDateClick }
    const { container } = render(IrisEventCalendar, { props: { config: cfg } })
    await fireEvent.click(container.querySelector('[data-iris-event-cal-day="2025-06-10"]')!)
    expect(onDateClick).toHaveBeenCalledWith('2025-06-10')
  })

  it('clicking an event chip fires onEventClick', async () => {
    const onEventClick = vi.fn()
    const cfg = { ...config(), onEventClick }
    const { container } = render(IrisEventCalendar, { props: { config: cfg } })
    await fireEvent.click(container.querySelector('[data-iris-event-cal-chip="e1"]')!)
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', title: 'Sprint Review' }),
    )
  })
})
