import { fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import IrisMonthPicker from './IrisMonthPicker.svelte'

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-month-picker-trigger]') as HTMLButtonElement
}

function month(container: HTMLElement, value: string): HTMLButtonElement {
  return container.querySelector(`[data-iris-month-picker-month="${value}"]`) as HTMLButtonElement
}

describe('IrisMonthPicker', () => {
  it('renders a closed trigger and opens a twelve-month grid', async () => {
    const { container } = render(IrisMonthPicker, {
      props: { value: new Date(2026, 8, 15), locale: 'en-US' },
    })
    expect(trigger(container).getAttribute('aria-expanded')).toBe('false')

    await fireEvent.click(trigger(container))
    flushSync()

    expect(container.querySelectorAll('[data-iris-month-picker-month]')).toHaveLength(12)
    expect(container.querySelector('input[type="month"]')).toBeNull()
    expect(container.querySelector('select')).toBeNull()
  })

  it('emits the first day of the selected month and closes', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisMonthPicker, {
      props: { value: new Date(2026, 8, 15), onValueChange },
    })
    await fireEvent.click(trigger(container))
    flushSync()
    await fireEvent.click(month(container, '2026-08'))
    flushSync()

    expect(onValueChange).toHaveBeenCalledOnce()
    const value = onValueChange.mock.calls[0]![0] as Date
    expect([value.getFullYear(), value.getMonth(), value.getDate()]).toEqual([2026, 7, 1])
    expect(container.querySelector('[data-iris-month-picker-content]')).toBeNull()
  })

  it('navigates years and keeps the selected month value stable', async () => {
    const { container } = render(IrisMonthPicker, {
      props: { value: new Date(2026, 8, 15), locale: 'en-US' },
    })
    await fireEvent.click(trigger(container))
    flushSync()
    await fireEvent.click(container.querySelector('[data-iris-month-picker-next]')!)
    flushSync()

    expect(container.querySelector('[data-iris-month-picker-year]')?.textContent).toBe('2027')
    expect(trigger(container).getAttribute('data-iris-month-picker-value')).toBe('2026-09')
    expect(month(container, '2027-09')).not.toBeNull()
  })

  it('compares bounds at month precision', async () => {
    const { container } = render(IrisMonthPicker, {
      props: {
        min: new Date(2024, 5, 20),
        max: new Date(2024, 7, 2),
        defaultMonth: new Date(2024, 5, 1),
      },
    })
    await fireEvent.click(trigger(container))
    flushSync()

    expect(month(container, '2024-05').disabled).toBe(true)
    expect(month(container, '2024-06').disabled).toBe(false)
    expect(month(container, '2024-08').disabled).toBe(false)
    expect(month(container, '2024-09').disabled).toBe(true)
  })

  it('forwards form state and safely handles a malformed locale', async () => {
    const { container } = render(IrisMonthPicker, {
      props: {
        disabled: true,
        invalid: true,
        id: 'month-field',
        ariaDescribedby: 'month-error',
        value: new Date(2026, 8, 1),
        locale: 'bad locale!',
      },
    })
    const button = trigger(container)
    expect(button.id).toBe('month-field')
    expect(button.getAttribute('aria-describedby')).toBe('month-error')
    expect(button.getAttribute('aria-invalid')).toBe('true')
    expect(button.disabled).toBe(true)
    await fireEvent.click(button)
    flushSync()
    expect(container.querySelector('[data-iris-month-picker-content]')).toBeNull()
  })
})
