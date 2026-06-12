import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { IrisEventCalendar } from './index'
import type { CalendarConfig } from '../core'

afterEach(cleanup)

const config = (): CalendarConfig => ({
  initialYear: 2025,
  initialMonth: 5, // June
  events: [
    { id: 'e1', title: 'Sprint Review', date: '2025-06-15', color: '#6366f1' },
    { id: 'e2', title: 'Team Lunch', date: '2025-06-15' },
    { id: 'e3', title: 'Deploy', date: '2025-06-20' },
  ],
})

describe('IrisEventCalendar (react)', () => {
  it('renders the month grid', () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    expect(container.querySelector('[data-iris-event-calendar]')).toBeTruthy()
    expect(container.querySelector('[data-iris-event-cal-grid]')).toBeTruthy()
  })

  it('renders the month title header containing the year', () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    const title = container.querySelector('[data-iris-event-cal-title]')!
    expect(title.textContent).toContain('2025')
  })

  it('renders 7 weekday header cells', () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    const headers = container.querySelectorAll('[data-iris-event-cal-weekday]')
    expect(headers).toHaveLength(7)
  })

  it('renders day cells for the month grid (6 rows × 7 = 42)', () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    const days = container.querySelectorAll('[data-iris-event-cal-day]')
    expect(days).toHaveLength(42)
  })

  it('renders event chips on correct day cells', () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    const june15 = container.querySelector('[data-iris-event-cal-day="2025-06-15"]')!
    expect(june15).toBeTruthy()
    const chips = june15.querySelectorAll('[data-iris-event-cal-chip]')
    expect(chips).toHaveLength(2)
    expect(chips[0]!.getAttribute('data-iris-event-cal-chip')).toBe('e1')
    expect(chips[1]!.getAttribute('data-iris-event-cal-chip')).toBe('e2')
  })

  it('renders event chip text as event title', () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    const chip = container.querySelector('[data-iris-event-cal-chip="e1"]')!
    expect(chip.textContent).toBe('Sprint Review')
  })

  it('prev button navigates to previous month', async () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    const title = container.querySelector('[data-iris-event-cal-title]')!
    const before = title.textContent
    const prevBtn = container.querySelector('[data-iris-event-cal-prev]')!
    fireEvent.click(prevBtn)
    // Month display should change (not equal to the June title)
    await vi.waitFor(() => {
      expect(title.textContent).not.toBe(before)
      expect(title.textContent).toContain('2025')
    })
    // Day cells should correspond to May — first of the new grid should be in April/May area
    expect(container.querySelector('[data-iris-event-cal-day="2025-05-01"]')).toBeTruthy()
  })

  it('next button navigates to next month', async () => {
    const { container } = render(<IrisEventCalendar config={config()} />)
    const title = container.querySelector('[data-iris-event-cal-title]')!
    const before = title.textContent
    const nextBtn = container.querySelector('[data-iris-event-cal-next]')!
    fireEvent.click(nextBtn)
    // Month display should change
    await vi.waitFor(() => {
      expect(title.textContent).not.toBe(before)
      expect(title.textContent).toContain('2025')
    })
    // Day cells should correspond to July
    expect(container.querySelector('[data-iris-event-cal-day="2025-07-01"]')).toBeTruthy()
  })

  it('clicking a day cell fires onDateClick with the ISO date', () => {
    const onDateClick = vi.fn()
    const cfg = { ...config(), onDateClick }
    const { container } = render(<IrisEventCalendar config={cfg} />)
    const cell = container.querySelector('[data-iris-event-cal-day="2025-06-10"]')!
    fireEvent.click(cell)
    expect(onDateClick).toHaveBeenCalledWith('2025-06-10')
  })

  it('clicking an event chip fires onEventClick with the event object', () => {
    const onEventClick = vi.fn()
    const cfg = { ...config(), onEventClick }
    const { container } = render(<IrisEventCalendar config={cfg} />)
    const chip = container.querySelector('[data-iris-event-cal-chip="e1"]')!
    fireEvent.click(chip)
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', title: 'Sprint Review' }),
    )
  })

  it('clicking an event chip does NOT also fire onDateClick (stopPropagation)', () => {
    const onDateClick = vi.fn()
    const onEventClick = vi.fn()
    const cfg = { ...config(), onDateClick, onEventClick }
    const { container } = render(<IrisEventCalendar config={cfg} />)
    const chip = container.querySelector('[data-iris-event-cal-chip="e1"]')!
    fireEvent.click(chip)
    expect(onEventClick).toHaveBeenCalledOnce()
    expect(onDateClick).not.toHaveBeenCalled()
  })
})
