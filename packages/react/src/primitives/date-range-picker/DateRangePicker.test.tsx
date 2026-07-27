import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisDateRangePicker } from './DateRangePicker'

afterEach(() => cleanup())

function trig(): HTMLButtonElement {
  return document.querySelector('[data-iris-date-range-picker-trigger]') as HTMLButtonElement
}

describe('@iris-ui-kit/react IrisDateRangePicker', () => {
  it('shows placeholder when empty', () => {
    render(<IrisDateRangePicker placeholder="Pick range…" />)
    expect(trig().textContent).toBe('Pick range…')
  })

  it('shows start → … when only start set', () => {
    render(
      <IrisDateRangePicker value={{ start: new Date(2024, 5, 10), end: null }} locale="en-US" />,
    )
    const txt = trig().textContent!
    expect(txt).toContain('→')
    expect(txt).toContain('…')
  })

  it('shows start → end when both set', () => {
    render(
      <IrisDateRangePicker
        value={{ start: new Date(2024, 5, 10), end: new Date(2024, 5, 20) }}
        locale="en-US"
      />,
    )
    const txt = trig().textContent!
    expect(txt).toContain('Jun 10')
    expect(txt).toContain('Jun 20')
    expect(txt).toContain('→')
  })

  it('clicking trigger opens two calendars', () => {
    render(<IrisDateRangePicker />)
    act(() => {
      fireEvent.click(trig())
    })
    expect(document.querySelectorAll('[data-iris-calendar]').length).toBe(2)
  })

  it('first day click emits update with start set + end null', () => {
    const onChange = vi.fn()
    render(<IrisDateRangePicker onValueChange={onChange} />)
    act(() => {
      fireEvent.click(trig())
    })
    const day = document.querySelectorAll('[data-iris-calendar-day]')[10] as HTMLButtonElement
    act(() => {
      fireEvent.click(day)
    })
    const call = onChange.mock.calls.at(-1)![0] as { start: Date | null; end: Date | null }
    expect(call.start).toBeInstanceOf(Date)
    expect(call.end).toBeNull()
  })

  it('second day click completes range, swaps if before start', () => {
    const onChange = vi.fn()
    render(
      <IrisDateRangePicker
        defaultValue={{ start: new Date(2024, 5, 15), end: null }}
        onValueChange={onChange}
      />,
    )
    act(() => {
      fireEvent.click(trig())
    })
    const second = document.querySelector(
      '[data-iris-calendar-day-iso="2024-06-10"]',
    ) as HTMLButtonElement
    expect(second).not.toBeNull()
    act(() => {
      fireEvent.click(second)
    })
    const call = onChange.mock.calls.at(-1)![0] as { start: Date; end: Date }
    expect(call.start.getDate()).toBe(10)
    expect(call.end.getDate()).toBe(15)
  })

  it('disabled blocks interaction', () => {
    render(<IrisDateRangePicker disabled />)
    expect(trig().disabled).toBe(true)
  })

  it('invalid sets aria-invalid', () => {
    render(<IrisDateRangePicker invalid />)
    expect(trig().getAttribute('aria-invalid')).toBe('true')
  })

  it('id + ariaDescribedby propagate (FormField integration)', () => {
    render(<IrisDateRangePicker id="dr-1" ariaDescribedby="hint" />)
    expect(trig().id).toBe('dr-1')
    expect(trig().getAttribute('aria-describedby')).toBe('hint')
  })
})
