import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCalendar } from './Calendar'
import { isSameDay } from './dateUtils'

beforeEach(() => {})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function days(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-calendar-day]'))
}
function day(iso: string): HTMLButtonElement {
  return document.querySelector(`[data-iris-calendar-day-iso="${iso}"]`) as HTMLButtonElement
}

describe('@iris-ui/react IrisCalendar', () => {
  it('renders header + weekday row + 42-cell grid', () => {
    render(<IrisCalendar defaultMonth={new Date(2024, 2, 15)} />)
    expect(document.querySelector('[data-iris-calendar-header]')).not.toBeNull()
    expect(document.querySelectorAll('[role=columnheader]').length).toBe(7)
    expect(days().length).toBe(42)
  })

  it('header reflects visible month', () => {
    render(<IrisCalendar defaultMonth={new Date(2024, 5, 15)} locale="en-US" />)
    expect(document.querySelector('[data-iris-calendar-title]')?.textContent).toMatch(
      /June.*2024/,
    )
  })

  it('prev/next buttons advance month', () => {
    render(<IrisCalendar defaultMonth={new Date(2024, 5, 15)} locale="en-US" />)
    const next = document.querySelector('[data-iris-calendar-next]') as HTMLButtonElement
    act(() => {
      fireEvent.click(next)
    })
    expect(document.querySelector('[data-iris-calendar-title]')?.textContent).toMatch(
      /July.*2024/,
    )
  })

  it('clicking a day fires onValueChange', () => {
    const onChange = vi.fn()
    render(<IrisCalendar defaultMonth={new Date(2024, 5, 1)} onValueChange={onChange} />)
    act(() => {
      fireEvent.click(day('2024-06-10'))
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(isSameDay(onChange.mock.calls[0]![0] as Date, new Date(2024, 5, 10))).toBe(true)
  })

  it('selected day has aria-selected=true', () => {
    render(
      <IrisCalendar value={new Date(2024, 5, 10)} defaultMonth={new Date(2024, 5, 1)} />,
    )
    expect(day('2024-06-10').getAttribute('aria-selected')).toBe('true')
  })

  it('out-of-range days are disabled', () => {
    render(
      <IrisCalendar
        defaultMonth={new Date(2024, 5, 1)}
        min={new Date(2024, 5, 5)}
        max={new Date(2024, 5, 20)}
      />,
    )
    expect(day('2024-06-03').disabled).toBe(true)
    expect(day('2024-06-25').disabled).toBe(true)
    expect(day('2024-06-10').disabled).toBe(false)
  })

  it('today gets aria-current=date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 15))
    render(<IrisCalendar defaultMonth={new Date(2024, 5, 1)} />)
    expect(day('2024-06-15').getAttribute('aria-current')).toBe('date')
  })

  it('ArrowRight moves focus by 1 day', () => {
    render(
      <IrisCalendar value={new Date(2024, 5, 10)} defaultMonth={new Date(2024, 5, 1)} />,
    )
    act(() => {
      fireEvent.keyDown(document.querySelector('[data-iris-calendar-grid]')!, {
        key: 'ArrowRight',
      })
    })
    expect(
      document.querySelector('[data-state=focused]')?.getAttribute('data-iris-calendar-day-iso'),
    ).toBe('2024-06-11')
  })

  it('ArrowDown moves focus by 7 days', () => {
    render(
      <IrisCalendar value={new Date(2024, 5, 10)} defaultMonth={new Date(2024, 5, 1)} />,
    )
    act(() => {
      fireEvent.keyDown(document.querySelector('[data-iris-calendar-grid]')!, {
        key: 'ArrowDown',
      })
    })
    expect(
      document.querySelector('[data-state=focused]')?.getAttribute('data-iris-calendar-day-iso'),
    ).toBe('2024-06-17')
  })

  it('PageDown advances visible month', () => {
    render(<IrisCalendar defaultMonth={new Date(2024, 5, 15)} locale="en-US" />)
    act(() => {
      fireEvent.keyDown(document.querySelector('[data-iris-calendar-grid]')!, {
        key: 'PageDown',
      })
    })
    expect(document.querySelector('[data-iris-calendar-title]')?.textContent).toMatch(
      /July.*2024/,
    )
  })

  it('Enter on grid selects focused date', () => {
    const onChange = vi.fn()
    render(
      <IrisCalendar
        value={new Date(2024, 5, 10)}
        defaultMonth={new Date(2024, 5, 1)}
        onValueChange={onChange}
      />,
    )
    act(() => {
      fireEvent.keyDown(document.querySelector('[data-iris-calendar-grid]')!, {
        key: 'Enter',
      })
    })
    expect(onChange).toHaveBeenCalled()
    expect(isSameDay(onChange.mock.calls[0]![0] as Date, new Date(2024, 5, 10))).toBe(true)
  })

  it('prev disabled when visible month <= min', () => {
    render(
      <IrisCalendar defaultMonth={new Date(2024, 5, 1)} min={new Date(2024, 5, 5)} />,
    )
    expect(
      (document.querySelector('[data-iris-calendar-prev]') as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('disabled disables all day cells', () => {
    render(<IrisCalendar defaultMonth={new Date(2024, 5, 1)} disabled />)
    expect(days().every((d) => (d as HTMLButtonElement).disabled)).toBe(true)
  })

  it('controlled value flips the selected highlight', () => {
    const { rerender } = render(
      <IrisCalendar value={new Date(2024, 5, 5)} defaultMonth={new Date(2024, 5, 1)} />,
    )
    expect(day('2024-06-05').getAttribute('aria-selected')).toBe('true')
    rerender(
      <IrisCalendar value={new Date(2024, 5, 20)} defaultMonth={new Date(2024, 5, 1)} />,
    )
    expect(day('2024-06-20').getAttribute('aria-selected')).toBe('true')
  })

  it('uncontrolled click updates internal selection', () => {
    render(<IrisCalendar defaultMonth={new Date(2024, 5, 1)} />)
    act(() => {
      fireEvent.click(day('2024-06-12'))
    })
    expect(day('2024-06-12').getAttribute('aria-selected')).toBe('true')
  })
})
