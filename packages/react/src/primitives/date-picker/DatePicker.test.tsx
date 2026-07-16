import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisDatePicker } from './DatePicker'

afterEach(() => cleanup())

function trig(): HTMLButtonElement {
  return document.querySelector('[data-iris-date-picker-trigger]') as HTMLButtonElement
}

describe('@iris-ui/react IrisDatePicker', () => {
  it('shows placeholder when no value', () => {
    render(<IrisDatePicker placeholder="Pick…" />)
    expect(trig().textContent).toBe('Pick…')
  })

  it('shows formatted date + iso on trigger when value set', () => {
    render(<IrisDatePicker value={new Date(2024, 5, 15)} locale="en-US" />)
    expect(trig().textContent).toMatch(/Jun.*15.*2024/)
    expect(trig().getAttribute('data-iris-date-picker-iso')).toBe('2024-06-15')
  })

  it('clicking trigger opens calendar', () => {
    render(<IrisDatePicker />)
    expect(document.querySelector('[data-iris-calendar]')).toBeNull()
    act(() => {
      fireEvent.click(trig())
    })
    expect(document.querySelector('[data-iris-calendar]')).not.toBeNull()
  })

  it('selecting a day emits onValueChange + closes calendar', () => {
    const onChange = vi.fn()
    render(<IrisDatePicker onValueChange={onChange} />)
    act(() => {
      fireEvent.click(trig())
    })
    const todayIso = new Date()
    const isoStr = `${todayIso.getFullYear()}-${String(todayIso.getMonth() + 1).padStart(2, '0')}-${String(todayIso.getDate()).padStart(2, '0')}`
    const day = document.querySelector(
      `[data-iris-calendar-day-iso="${isoStr}"]`,
    ) as HTMLButtonElement
    expect(day).not.toBeNull()
    act(() => {
      fireEvent.click(day)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('disabled trigger blocks click', () => {
    render(<IrisDatePicker disabled />)
    expect(trig().disabled).toBe(true)
  })

  it('invalid sets aria-invalid', () => {
    render(<IrisDatePicker invalid />)
    expect(trig().getAttribute('aria-invalid')).toBe('true')
  })

  it('id + ariaDescribedby propagate for FormField integration', () => {
    render(<IrisDatePicker id="my-date" ariaDescribedby="hint-id" />)
    expect(trig().id).toBe('my-date')
    expect(trig().getAttribute('aria-describedby')).toBe('hint-id')
  })

  it('Escape closes the calendar panel', () => {
    render(<IrisDatePicker />)
    act(() => {
      fireEvent.click(trig())
    })
    expect(document.querySelector('[data-iris-calendar]')).not.toBeNull()
    act(() => {
      fireEvent.keyDown(trig(), { key: 'Escape' })
    })
    expect(document.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('month navigation buttons render in open calendar', () => {
    render(<IrisDatePicker />)
    act(() => {
      fireEvent.click(trig())
    })
    expect(document.querySelector('[data-iris-calendar-prev]')).not.toBeNull()
    expect(document.querySelector('[data-iris-calendar-next]')).not.toBeNull()
  })

  it('does not throw on a malformed locale', () => {
    expect(() =>
      render(
        <IrisDatePicker
          value={new Date(2026, 4, 29)}
          locale="bad locale!"
          onValueChange={() => {}}
        />,
      ),
    ).not.toThrow()
  })

  it('prev month changes visible month', () => {
    render(<IrisDatePicker defaultValue={new Date(2024, 5, 15)} locale="en-US" />)
    act(() => {
      fireEvent.click(trig())
    })
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-calendar-prev]')!)
    })
    expect(trig().getAttribute('data-iris-date-picker-iso')).toBe('2024-06-15')
  })
})
