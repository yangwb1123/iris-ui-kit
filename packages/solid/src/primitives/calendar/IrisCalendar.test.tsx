import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCalendar } from './IrisCalendar'

afterEach(cleanup)

describe('IrisCalendar', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisCalendar />)
    expect(container.querySelector('[data-iris-calendar]')).not.toBeNull()
  })

  it('renders day buttons', () => {
    const { container } = render(() => <IrisCalendar />)
    const days = container.querySelectorAll('[data-iris-calendar-day]')
    expect(days.length).toBe(42) // 6 rows × 7 cols
  })

  it('calls onChange when a day is clicked', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisCalendar onChange={onChange} />)
    const enabledDay = container.querySelector(
      '[data-iris-calendar-day]:not([disabled])',
    ) as HTMLButtonElement
    fireEvent.click(enabledDay)
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0]).toBeInstanceOf(Date)
  })

  it('shows prev/next navigation buttons', () => {
    const { container } = render(() => <IrisCalendar />)
    expect(container.querySelector('[data-iris-calendar-prev]')).not.toBeNull()
    expect(container.querySelector('[data-iris-calendar-next]')).not.toBeNull()
  })
})
