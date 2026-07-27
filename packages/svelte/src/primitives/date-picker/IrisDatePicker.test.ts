import { fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import IrisDatePicker from './IrisDatePicker.svelte'

const JUNE_15 = new Date(2024, 5, 15, 16, 45)

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-date-picker-trigger]') as HTMLButtonElement
}

async function openCalendar(container: HTMLElement): Promise<HTMLElement> {
  await fireEvent.click(trigger(container))
  flushSync()
  return container.querySelector('[data-iris-calendar]') as HTMLElement
}

describe('IrisDatePicker', () => {
  it('renders a closed combobox with the default localized placeholder', () => {
    const { container } = render(IrisDatePicker)
    const button = trigger(container)

    expect(button.type).toBe('button')
    expect(button.getAttribute('role')).toBe('combobox')
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('data-state')).toBe('closed')
    expect(button.textContent).toBe('Select date…')
    expect(container.querySelector('[data-iris-date-picker-content]')).toBeNull()
  })

  it('uses a caller-provided placeholder while the value is null', () => {
    const { container } = render(IrisDatePicker, {
      props: { placeholder: 'Pick a deployment date' },
    })

    expect(trigger(container).textContent).toBe('Pick a deployment date')
    expect(trigger(container).getAttribute('data-iris-date-picker-iso')).toBeNull()
  })

  it('formats a value for the requested locale and exposes a local ISO date', () => {
    const { container } = render(IrisDatePicker, {
      props: { value: JUNE_15, locale: 'en-US' },
    })
    const button = trigger(container)

    expect(button.textContent).toMatch(/Jun 15, 2024/)
    expect(button.getAttribute('data-iris-date-picker-iso')).toBe('2024-06-15')
  })

  it('falls back safely when Intl receives a malformed locale', () => {
    expect(() =>
      render(IrisDatePicker, {
        props: { value: JUNE_15, locale: 'not a valid locale!' },
      }),
    ).not.toThrow()
  })

  it('toggles the calendar and keeps state attributes in sync', async () => {
    const { container } = render(IrisDatePicker, { props: { value: JUNE_15 } })
    const button = trigger(container)

    expect(await openCalendar(container)).not.toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('data-state')).toBe('open')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    await fireEvent.click(button)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('data-state')).toBe('closed')
  })

  it('emits a normalized selected day and closes the calendar', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisDatePicker, {
      props: { value: JUNE_15, locale: 'en-US', onValueChange },
    })
    await openCalendar(container)
    const day = container.querySelector(
      '[data-iris-calendar-day-iso="2024-06-20"]',
    ) as HTMLButtonElement

    await fireEvent.click(day)
    flushSync()

    expect(onValueChange).toHaveBeenCalledTimes(1)
    const selected = onValueChange.mock.calls[0]![0] as Date
    expect([selected.getFullYear(), selected.getMonth(), selected.getDate()]).toEqual([2024, 5, 20])
    expect([selected.getHours(), selected.getMinutes(), selected.getSeconds()]).toEqual([0, 0, 0])
    expect(container.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('closes on an outside mousedown but not on a mousedown inside the picker', async () => {
    const { container } = render(IrisDatePicker, { props: { value: JUNE_15 } })
    const calendar = await openCalendar(container)

    await fireEvent.mouseDown(calendar)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).not.toBeNull()

    await fireEvent.mouseDown(document.body)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('forwards calendar constraints and week ordering', async () => {
    const { container } = render(IrisDatePicker, {
      props: {
        value: JUNE_15,
        min: new Date(2024, 5, 10),
        max: new Date(2024, 5, 20),
        weekStartsOn: 1,
        locale: 'en-US',
      },
    })
    await openCalendar(container)

    const weekdays = container.querySelector('[data-iris-calendar-weekdays]')!
    expect(weekdays.firstElementChild?.textContent).toBe('Mon')
    expect(
      (container.querySelector('[data-iris-calendar-day-iso="2024-06-09"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (container.querySelector('[data-iris-calendar-day-iso="2024-06-10"]') as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    expect(
      (container.querySelector('[data-iris-calendar-day-iso="2024-06-21"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (container.querySelector('[data-iris-calendar-prev]') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (container.querySelector('[data-iris-calendar-next]') as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('blocks opening while disabled and exposes disabled styling', async () => {
    const { container } = render(IrisDatePicker, { props: { disabled: true } })
    const button = trigger(container)

    expect(button.disabled).toBe(true)
    expect(button.style.cursor).toBe('not-allowed')
    expect(button.style.opacity).toBe('0.6')
    await fireEvent.click(button)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('announces invalid state and forwards form-field attributes', () => {
    const { container } = render(IrisDatePicker, {
      props: {
        invalid: true,
        id: 'deployment-date',
        'aria-describedby': 'deployment-date-error',
        'data-form-control': 'date',
      },
    })
    const button = trigger(container)

    expect(button.id).toBe('deployment-date')
    expect(button.getAttribute('aria-invalid')).toBe('true')
    expect(button.getAttribute('aria-describedby')).toBe('deployment-date-error')
    expect(button.getAttribute('data-form-control')).toBe('date')
    expect(button.getAttribute('style')).toContain('var(--iris-danger)')
  })

  it('applies class/style to the root without moving them to the trigger', () => {
    const { container } = render(IrisDatePicker, {
      props: { class: 'schedule-picker', style: 'margin-inline-start: 8px' },
    })
    const root = container.querySelector('[data-iris-date-picker]') as HTMLElement

    expect(root.classList.contains('schedule-picker')).toBe(true)
    expect(root.style.marginInlineStart).toBe('8px')
    expect(trigger(container).classList.contains('schedule-picker')).toBe(false)
  })

  it('reflects controlled value changes after rerender', async () => {
    const { container, rerender } = render(IrisDatePicker, {
      props: { value: new Date(2024, 5, 15), locale: 'en-US' },
    })

    expect(trigger(container).getAttribute('data-iris-date-picker-iso')).toBe('2024-06-15')
    await rerender({ value: new Date(2025, 0, 2), locale: 'en-US' })
    flushSync()
    expect(trigger(container).getAttribute('data-iris-date-picker-iso')).toBe('2025-01-02')
    expect(trigger(container).textContent).toMatch(/Jan 2, 2025/)
  })
})
