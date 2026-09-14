import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisMonthPicker } from './IrisMonthPicker'

afterEach(cleanup)

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-month-picker-trigger]') as HTMLButtonElement
}

function month(container: HTMLElement, value: string): HTMLButtonElement {
  return container.querySelector(`[data-iris-month-picker-month="${value}"]`) as HTMLButtonElement
}

describe('IrisMonthPicker', () => {
  it('renders a closed trigger and opens a twelve-month grid', () => {
    const { container } = render(() => <IrisMonthPicker value={new Date(2026, 8, 15)} />)
    expect(trigger(container).getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger(container))

    expect(container.querySelectorAll('[data-iris-month-picker-month]')).toHaveLength(12)
    expect(container.querySelector('input[type="month"]')).toBeNull()
    expect(container.querySelector('select')).toBeNull()
  })

  it('emits a normalized first day and closes', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisMonthPicker value={new Date(2026, 8, 15)} onChange={onChange} />
    ))
    fireEvent.click(trigger(container))
    fireEvent.click(month(container, '2026-08'))

    expect(onChange).toHaveBeenCalledOnce()
    const value = onChange.mock.calls[0]![0] as Date
    expect([value.getFullYear(), value.getMonth(), value.getDate()]).toEqual([2026, 7, 1])
    expect(container.querySelector('[data-iris-month-picker-content]')).toBeNull()
  })

  it('supports uncontrolled selection and controlled updates', () => {
    const { container } = render(() => (
      <IrisMonthPicker defaultValue={new Date(2026, 8, 15)} locale="en-US" />
    ))
    fireEvent.click(trigger(container))
    fireEvent.click(month(container, '2026-10'))
    expect(trigger(container).getAttribute('data-iris-month-picker-value')).toBe('2026-10')

    const [value, setValue] = createSignal<Date | null>(new Date(2024, 0, 2))
    const controlled = render(() => <IrisMonthPicker value={value()} locale="en-US" />)
    expect(trigger(controlled.container).getAttribute('data-iris-month-picker-value')).toBe(
      '2024-01',
    )
    setValue(new Date(2025, 3, 2))
    expect(trigger(controlled.container).getAttribute('data-iris-month-picker-value')).toBe(
      '2025-04',
    )
  })

  it('compares bounds at month precision and forwards invalid state', () => {
    const { container } = render(() => (
      <IrisMonthPicker
        min={new Date(2024, 5, 20)}
        max={new Date(2024, 7, 2)}
        defaultMonth={new Date(2024, 5, 1)}
        invalid
        id="month-field"
        ariaDescribedby="month-error"
      />
    ))
    expect(trigger(container).id).toBe('month-field')
    expect(trigger(container).getAttribute('aria-invalid')).toBe('true')
    expect(trigger(container).getAttribute('aria-describedby')).toBe('month-error')
    fireEvent.click(trigger(container))
    expect(month(container, '2024-06').disabled).toBe(false)
    expect(month(container, '2024-08').disabled).toBe(false)
    expect(month(container, '2024-05').disabled).toBe(true)
    expect(month(container, '2024-09').disabled).toBe(true)
  })

  it('blocks opening when disabled and handles malformed locales', () => {
    const { container } = render(() => (
      <IrisMonthPicker disabled value={new Date(2026, 8, 1)} locale="bad locale!" />
    ))
    expect(() => fireEvent.click(trigger(container))).not.toThrow()
    expect(container.querySelector('[data-iris-month-picker-content]')).toBeNull()
    expect(trigger(container).disabled).toBe(true)
  })
})
