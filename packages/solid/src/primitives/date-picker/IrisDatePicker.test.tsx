import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisDatePicker } from './IrisDatePicker'

afterEach(cleanup)

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-date-picker-trigger]') as HTMLButtonElement
}

function openPicker(container: HTMLElement): void {
  fireEvent.click(trigger(container))
}

function day(container: HTMLElement, iso: string): HTMLButtonElement {
  return container.querySelector(`[data-iris-calendar-day-iso="${iso}"]`) as HTMLButtonElement
}

describe('IrisDatePicker', () => {
  it('renders a closed dialog trigger', () => {
    const { container } = render(() => <IrisDatePicker />)
    expect(container.querySelector('[data-iris-date-picker]')).not.toBeNull()
    expect(trigger(container).getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger(container).getAttribute('aria-expanded')).toBe('false')
    expect(trigger(container).getAttribute('data-state')).toBe('closed')
  })

  it('shows a custom placeholder when the value is null', () => {
    const { container } = render(() => <IrisDatePicker value={null} placeholder="Pick a date" />)
    expect(trigger(container).textContent).toContain('Pick a date')
    expect(trigger(container).hasAttribute('data-iris-date-picker-iso')).toBe(false)
  })

  it('formats a value and exposes a timezone-safe local ISO date', () => {
    const { container } = render(() => (
      <IrisDatePicker value={new Date(2024, 5, 15)} locale="en-US" />
    ))
    expect(trigger(container).textContent).toMatch(/Jun 15, 2024/)
    expect(trigger(container).getAttribute('data-iris-date-picker-iso')).toBe('2024-06-15')
  })

  it('reacts to a controlled value update', () => {
    const [value, setValue] = createSignal<Date | null>(new Date(2024, 5, 15))
    const { container } = render(() => <IrisDatePicker value={value()} locale="en-US" />)

    setValue(new Date(2024, 6, 4))

    expect(trigger(container).getAttribute('data-iris-date-picker-iso')).toBe('2024-07-04')
    expect(trigger(container).textContent).toMatch(/Jul 4, 2024/)
  })

  it('falls back safely when locale is malformed', () => {
    expect(() =>
      render(() => <IrisDatePicker value={new Date(2024, 5, 15)} locale="bad locale!" />),
    ).not.toThrow()
  })

  it('forwards id and invalid state to the trigger', () => {
    const { container } = render(() => <IrisDatePicker id="billing-date" invalid />)
    expect(trigger(container).id).toBe('billing-date')
    expect(trigger(container).getAttribute('aria-invalid')).toBe('true')
    expect(trigger(container).style.border).toContain('var(--iris-danger)')
  })

  it('opens and closes the calendar by toggling the trigger', () => {
    const { container } = render(() => <IrisDatePicker />)
    expect(container.querySelector('[data-iris-date-picker-panel]')).toBeNull()

    openPicker(container)
    expect(trigger(container).getAttribute('aria-expanded')).toBe('true')
    expect(trigger(container).getAttribute('data-state')).toBe('open')
    expect(container.querySelector('[data-iris-date-picker-panel]')?.getAttribute('role')).toBe(
      'dialog',
    )

    openPicker(container)
    expect(container.querySelector('[data-iris-date-picker-panel]')).toBeNull()
    expect(trigger(container).getAttribute('aria-expanded')).toBe('false')
  })

  it('renders calendar navigation and forwards weekStartsOn', () => {
    const { container } = render(() => (
      <IrisDatePicker defaultValue={new Date(2024, 5, 15)} locale="en-US" weekStartsOn={1} />
    ))
    openPicker(container)

    expect(container.querySelector('[data-iris-calendar-prev]')).not.toBeNull()
    expect(container.querySelector('[data-iris-calendar-next]')).not.toBeNull()
    const weekday = container.querySelector('[data-iris-calendar-weekdays] [role=columnheader]')
    expect(weekday?.textContent).toMatch(/^Mon/)
  })

  it('selecting a day updates uncontrolled display, emits, and closes', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisDatePicker defaultValue={new Date(2024, 5, 15)} locale="en-US" onChange={onChange} />
    ))
    openPicker(container)
    fireEvent.click(day(container, '2024-06-20'))

    expect(onChange).toHaveBeenCalledOnce()
    const selected = onChange.mock.calls[0]![0] as Date
    expect([selected.getFullYear(), selected.getMonth(), selected.getDate()]).toEqual([2024, 5, 20])
    expect(trigger(container).getAttribute('data-iris-date-picker-iso')).toBe('2024-06-20')
    expect(container.querySelector('[data-iris-date-picker-panel]')).toBeNull()
  })

  it('controlled selection emits without mutating the supplied value', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisDatePicker value={new Date(2024, 5, 15)} locale="en-US" onChange={onChange} />
    ))
    openPicker(container)
    fireEvent.click(day(container, '2024-06-20'))

    expect(onChange).toHaveBeenCalledOnce()
    expect(trigger(container).getAttribute('data-iris-date-picker-iso')).toBe('2024-06-15')
    expect(container.querySelector('[data-iris-date-picker-panel]')).toBeNull()
  })

  it('forwards min and max bounds to calendar days', () => {
    const { container } = render(() => (
      <IrisDatePicker
        defaultValue={new Date(2024, 5, 15)}
        min={new Date(2024, 5, 10)}
        max={new Date(2024, 5, 20)}
      />
    ))
    openPicker(container)

    expect(day(container, '2024-06-09').disabled).toBe(true)
    expect(day(container, '2024-06-10').disabled).toBe(false)
    expect(day(container, '2024-06-20').disabled).toBe(false)
    expect(day(container, '2024-06-21').disabled).toBe(true)
  })

  it('prevents panel mousedown from stealing focus', () => {
    const { container } = render(() => <IrisDatePicker />)
    openPicker(container)
    const panel = container.querySelector('[data-iris-date-picker-panel]')!
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

    panel.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('disabled state blocks opening the calendar', () => {
    const { container } = render(() => <IrisDatePicker disabled />)
    expect(trigger(container).disabled).toBe(true)

    fireEvent.click(trigger(container))

    expect(container.querySelector('[data-iris-date-picker-panel]')).toBeNull()
  })
})
