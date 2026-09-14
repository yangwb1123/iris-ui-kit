import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisMonthPicker } from './MonthPicker'

afterEach(() => cleanup())

function trigger(): HTMLButtonElement {
  return document.querySelector('[data-iris-month-picker-trigger]') as HTMLButtonElement
}

function month(value: string): HTMLButtonElement {
  return document.querySelector(`[data-iris-month-picker-month="${value}"]`) as HTMLButtonElement
}

describe('@iris-ui-kit/react IrisMonthPicker', () => {
  it('renders a closed trigger and opens a twelve-month grid', () => {
    render(<IrisMonthPicker value={new Date(2026, 8, 15)} />)
    expect(trigger().getAttribute('aria-expanded')).toBe('false')

    act(() => {
      fireEvent.click(trigger())
    })

    expect(document.querySelectorAll('[data-iris-month-picker-month]')).toHaveLength(12)
    expect(document.querySelector('input[type="month"]')).toBeNull()
    expect(document.querySelector('select')).toBeNull()
  })

  it('emits a normalized first day and closes', () => {
    const onValueChange = vi.fn()
    render(<IrisMonthPicker value={new Date(2026, 8, 15)} onValueChange={onValueChange} />)
    act(() => {
      fireEvent.click(trigger())
    })
    act(() => {
      fireEvent.click(month('2026-08'))
    })

    expect(onValueChange).toHaveBeenCalledOnce()
    const value = onValueChange.mock.calls[0]![0] as Date
    expect([value.getFullYear(), value.getMonth(), value.getDate()]).toEqual([2026, 7, 1])
    expect(document.querySelector('[data-iris-month-picker-panel]')).toBeNull()
  })

  it('supports uncontrolled selection and controlled updates', () => {
    function Harness() {
      const [value, setValue] = React.useState<Date | null>(new Date(2024, 0, 2))
      return <IrisMonthPicker value={value} onValueChange={setValue} locale="en-US" />
    }
    render(<Harness />)
    expect(trigger().getAttribute('data-iris-month-picker-value')).toBe('2024-01')
    act(() => {
      fireEvent.click(trigger())
    })
    act(() => {
      fireEvent.click(month('2024-10'))
    })
    expect(trigger().getAttribute('data-iris-month-picker-value')).toBe('2024-10')
  })

  it('compares bounds at month precision and forwards form state', () => {
    render(
      <IrisMonthPicker
        min={new Date(2024, 5, 20)}
        max={new Date(2024, 7, 2)}
        defaultMonth={new Date(2024, 5, 1)}
        invalid
        id="month-field"
        ariaDescribedby="month-error"
      />,
    )
    expect(trigger().id).toBe('month-field')
    expect(trigger().getAttribute('aria-describedby')).toBe('month-error')
    expect(trigger().getAttribute('aria-invalid')).toBe('true')
    act(() => {
      fireEvent.click(trigger())
    })
    expect(month('2024-05').disabled).toBe(true)
    expect(month('2024-06').disabled).toBe(false)
    expect(month('2024-08').disabled).toBe(false)
    expect(month('2024-09').disabled).toBe(true)
  })

  it('blocks opening when disabled and handles malformed locales', () => {
    render(<IrisMonthPicker disabled value={new Date(2026, 8, 1)} locale="bad locale!" />)
    expect(trigger().disabled).toBe(true)
    act(() => {
      fireEvent.click(trigger())
    })
    expect(document.querySelector('[data-iris-month-picker-panel]')).toBeNull()
  })
})
