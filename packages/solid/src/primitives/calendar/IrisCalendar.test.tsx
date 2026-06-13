import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCalendar } from './IrisCalendar'
import { IrisI18nProvider } from '../../i18n'

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

  it('reflects selection in aria-selected when uncontrolled (clicking a day)', () => {
    // Regression: the component accepted `defaultValue` and advertised
    // uncontrolled use, but `aria-selected` read only the controlled `value`, so
    // clicking a day fired onChange yet never showed a selection. It now keeps an
    // internal selected signal seeded from `defaultValue`.
    const { container } = render(() => <IrisCalendar defaultMonth={new Date(2024, 5, 1)} />)
    const day = (iso: string) =>
      container.querySelector(`[data-iris-calendar-day-iso="${iso}"]`) as HTMLButtonElement
    expect(day('2024-06-10').getAttribute('aria-selected')).toBe('false')
    fireEvent.click(day('2024-06-10'))
    expect(day('2024-06-10').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(day('2024-06-20'))
    expect(day('2024-06-20').getAttribute('aria-selected')).toBe('true')
    expect(day('2024-06-10').getAttribute('aria-selected')).toBe('false')
  })

  it('honors defaultValue as the initial uncontrolled selection', () => {
    const { container } = render(() => (
      <IrisCalendar defaultValue={new Date(2024, 5, 15)} defaultMonth={new Date(2024, 5, 1)} />
    ))
    const day = container.querySelector(
      '[data-iris-calendar-day-iso="2024-06-15"]',
    ) as HTMLButtonElement
    expect(day.getAttribute('aria-selected')).toBe('true')
  })

  it('shows prev/next navigation buttons', () => {
    const { container } = render(() => <IrisCalendar />)
    expect(container.querySelector('[data-iris-calendar-prev]')).not.toBeNull()
    expect(container.querySelector('[data-iris-calendar-next]')).not.toBeNull()
  })

  it('day cells are wrapped in grid rows (valid grid → row → gridcell) with full-date labels', () => {
    const { container } = render(() => (
      <IrisCalendar defaultMonth={new Date(2024, 5, 15)} locale="en-US" />
    ))
    // 6 week rows inside the grid (plus the weekday header row outside it).
    const grid = container.querySelector('[data-iris-calendar-grid]')!
    expect(grid.querySelectorAll(':scope > [role=row]').length).toBe(6)
    // each gridcell announces the full date, not just the day number.
    const june10 = container.querySelector('[data-iris-calendar-day-iso="2024-06-10"]')!
    expect(june10.getAttribute('aria-label')).toMatch(/June 10, 2024/)
  })

  it('nav button aria-labels default to English and follow an i18n provider override', () => {
    // No provider: English fallback from core defaultMessages.
    const { container } = render(() => <IrisCalendar />)
    expect(container.querySelector('[data-iris-calendar-prev]')!.getAttribute('aria-label')).toBe(
      'Previous month',
    )
    expect(container.querySelector('[data-iris-calendar-next]')!.getAttribute('aria-label')).toBe(
      'Next month',
    )

    // With a provider overriding the messages, the labels follow.
    const { container: c2 } = render(() => (
      <IrisI18nProvider
        messages={{
          'calendar.previousMonth': 'Mois précédent',
          'calendar.nextMonth': 'Mois suivant',
        }}
      >
        <IrisCalendar />
      </IrisI18nProvider>
    ))
    expect(c2.querySelector('[data-iris-calendar-prev]')!.getAttribute('aria-label')).toBe(
      'Mois précédent',
    )
    expect(c2.querySelector('[data-iris-calendar-next]')!.getAttribute('aria-label')).toBe(
      'Mois suivant',
    )
  })
})
