import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisCalendar from './IrisCalendar.svelte'

describe('IrisCalendar', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisCalendar)
    expect(container.querySelector('[data-iris-calendar]')).toBeTruthy()
  })

  it('shows weekday headers', () => {
    const { container } = render(IrisCalendar)
    const weekdays = container.querySelector('[data-iris-calendar-weekdays]')
    expect(weekdays).toBeTruthy()
    expect(weekdays!.children.length).toBe(7)
  })

  it('day cells are wrapped in grid rows (valid grid → row → gridcell) with full-date labels', () => {
    const { container } = render(IrisCalendar, {
      props: { defaultMonth: new Date(2024, 5, 15), locale: 'en-US' },
    })
    // 6 week rows directly inside the grid (the weekday header row is outside it).
    const grid = container.querySelector('[data-iris-calendar-grid]')!
    expect(grid.querySelectorAll(':scope > [role=row]').length).toBe(6)
    // each gridcell announces the full date, not just the day number.
    const june10 = container.querySelector('[data-iris-calendar-day-iso="2024-06-10"]')!
    expect(june10.getAttribute('aria-label')).toMatch(/June 10, 2024/)
  })

  it('calls onValueChange when a day is clicked', async () => {
    let selected: Date | null = null
    const { container } = render(IrisCalendar, {
      props: {
        onValueChange: (d: Date | null) => {
          selected = d
        },
      },
    })
    const days = container.querySelectorAll('[data-iris-calendar-day]')
    await fireEvent.click(days[7]!)
    flushSync()
    expect(selected).toBeTruthy()
  })

  it('navigates to next month', async () => {
    const { container } = render(IrisCalendar)
    const title = container.querySelector('[data-iris-calendar-title]')!
    const before = title.textContent
    const next = container.querySelector('[data-iris-calendar-next]')!
    await fireEvent.click(next)
    flushSync()
    expect(title.textContent).not.toBe(before)
  })
})
