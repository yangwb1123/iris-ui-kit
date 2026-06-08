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
