import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisDateRangePicker } from './IrisDateRangePicker'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function startTrigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-date-range-picker-start]') as HTMLButtonElement
}

function endTrigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-date-range-picker-end]') as HTMLButtonElement
}

function day(container: HTMLElement, iso: string): HTMLButtonElement {
  return container.querySelector(`[data-iris-calendar-day-iso="${iso}"]`) as HTMLButtonElement
}

function dateParts(date: Date | null): number[] | null {
  return date ? [date.getFullYear(), date.getMonth(), date.getDate()] : null
}

describe('IrisDateRangePicker', () => {
  it('renders two closed dialog triggers', () => {
    const { container } = render(() => <IrisDateRangePicker />)
    expect(container.querySelector('[data-iris-date-range-picker]')).not.toBeNull()
    expect(startTrigger(container).getAttribute('aria-haspopup')).toBe('dialog')
    expect(endTrigger(container).getAttribute('aria-haspopup')).toBe('dialog')
    expect(startTrigger(container).getAttribute('aria-expanded')).toBe('false')
    expect(endTrigger(container).getAttribute('aria-expanded')).toBe('false')
  })

  it('uses distinct translated placeholders by default', () => {
    const { container } = render(() => <IrisDateRangePicker />)
    expect(startTrigger(container).textContent).toBe('Start date')
    expect(endTrigger(container).textContent).toBe('End date')
  })

  it('applies a custom placeholder to both empty endpoints', () => {
    const { container } = render(() => <IrisDateRangePicker placeholder="Choose date" />)
    expect(startTrigger(container).textContent).toBe('Choose date')
    expect(endTrigger(container).textContent).toBe('Choose date')
  })

  it('formats both endpoints with the requested locale', () => {
    const { container } = render(() => (
      <IrisDateRangePicker
        value={{ start: new Date(2024, 5, 10), end: new Date(2024, 5, 20) }}
        locale="en-US"
      />
    ))
    expect(startTrigger(container).textContent).toMatch(/Jun 10, 2024/)
    expect(endTrigger(container).textContent).toMatch(/Jun 20, 2024/)
  })

  it('reacts to controlled endpoint changes', () => {
    const [range, setRange] = createSignal({
      start: new Date(2024, 5, 10),
      end: null as Date | null,
    })
    const { container } = render(() => <IrisDateRangePicker value={range()} locale="en-US" />)
    setRange({ start: new Date(2024, 6, 4), end: new Date(2024, 6, 8) })

    expect(startTrigger(container).textContent).toMatch(/Jul 4, 2024/)
    expect(endTrigger(container).textContent).toMatch(/Jul 8, 2024/)
  })

  it('falls back safely for malformed locales', () => {
    expect(() =>
      render(() => (
        <IrisDateRangePicker
          value={{ start: new Date(2024, 5, 10), end: null }}
          locale="bad locale!"
        />
      )),
    ).not.toThrow()
  })

  it('opens the panel in start-selection mode', () => {
    const { container } = render(() => <IrisDateRangePicker />)
    fireEvent.click(startTrigger(container))

    expect(
      container.querySelector('[data-iris-date-range-picker-panel]')?.getAttribute('role'),
    ).toBe('dialog')
    expect(startTrigger(container).getAttribute('data-state')).toBe('selecting')
    expect(endTrigger(container).getAttribute('data-state')).toBe('idle')
    expect(startTrigger(container).getAttribute('aria-expanded')).toBe('true')
    expect(endTrigger(container).getAttribute('aria-expanded')).toBe('true')
  })

  it('switches an open panel to end-selection mode', () => {
    const { container } = render(() => (
      <IrisDateRangePicker defaultValue={{ start: new Date(2024, 5, 15), end: null }} />
    ))
    fireEvent.click(startTrigger(container))
    fireEvent.click(endTrigger(container))

    expect(startTrigger(container).getAttribute('data-state')).toBe('idle')
    expect(endTrigger(container).getAttribute('data-state')).toBe('selecting')
    expect(day(container, '2024-06-15').getAttribute('aria-selected')).toBe('false')
  })

  it('selects start then end in uncontrolled mode and closes', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisDateRangePicker
        defaultValue={{ start: new Date(2024, 5, 15), end: null }}
        locale="en-US"
        onChange={onChange}
      />
    ))
    fireEvent.click(startTrigger(container))
    fireEvent.click(day(container, '2024-06-10'))

    expect(dateParts(onChange.mock.calls[0]![0].start)).toEqual([2024, 5, 10])
    expect(onChange.mock.calls[0]![0].end).toBeNull()
    expect(endTrigger(container).getAttribute('data-state')).toBe('selecting')

    fireEvent.click(day(container, '2024-06-20'))
    const completed = onChange.mock.calls[1]![0]
    expect(dateParts(completed.start)).toEqual([2024, 5, 10])
    expect(dateParts(completed.end)).toEqual([2024, 5, 20])
    expect(container.querySelector('[data-iris-date-range-picker-panel]')).toBeNull()
    expect(startTrigger(container).textContent).toMatch(/Jun 10, 2024/)
    expect(endTrigger(container).textContent).toMatch(/Jun 20, 2024/)
  })

  it('selects without creating ownerless reactive computations', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(() => (
      <IrisDateRangePicker defaultValue={{ start: new Date(2024, 5, 15), end: null }} />
    ))
    fireEvent.click(startTrigger(container))
    fireEvent.click(day(container, '2024-06-20'))

    const messages = warning.mock.calls.flat().map(String).join('\n')
    expect(messages).not.toContain('computations created outside')
  })

  it('clears an existing end when a later start is selected', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisDateRangePicker
        defaultValue={{ start: new Date(2024, 5, 15), end: new Date(2024, 5, 18) }}
        onChange={onChange}
      />
    ))
    fireEvent.click(startTrigger(container))
    fireEvent.click(day(container, '2024-06-20'))

    expect(dateParts(onChange.mock.calls[0]![0].start)).toEqual([2024, 5, 20])
    expect(onChange.mock.calls[0]![0].end).toBeNull()
  })

  it('preserves an existing end when the new start remains before it', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisDateRangePicker
        defaultValue={{ start: new Date(2024, 5, 15), end: new Date(2024, 5, 25) }}
        onChange={onChange}
      />
    ))
    fireEvent.click(startTrigger(container))
    fireEvent.click(day(container, '2024-06-20'))

    expect(dateParts(onChange.mock.calls[0]![0].start)).toEqual([2024, 5, 20])
    expect(dateParts(onChange.mock.calls[0]![0].end)).toEqual([2024, 5, 25])
  })

  it('normalizes a reversed end choice into an ascending range', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisDateRangePicker
        defaultValue={{ start: new Date(2024, 5, 15), end: null }}
        onChange={onChange}
      />
    ))
    fireEvent.click(startTrigger(container))
    fireEvent.click(endTrigger(container))
    fireEvent.click(day(container, '2024-06-10'))

    const range = onChange.mock.calls[0]![0]
    expect(dateParts(range.start)).toEqual([2024, 5, 10])
    expect(dateParts(range.end)).toEqual([2024, 5, 15])
    expect(container.querySelector('[data-iris-date-range-picker-panel]')).toBeNull()
  })

  it('forwards calendar bounds and week start', () => {
    const { container } = render(() => (
      <IrisDateRangePicker
        defaultValue={{ start: new Date(2024, 5, 15), end: null }}
        min={new Date(2024, 5, 10)}
        max={new Date(2024, 5, 20)}
        locale="en-US"
        weekStartsOn={1}
      />
    ))
    fireEvent.click(startTrigger(container))

    expect(day(container, '2024-06-09').disabled).toBe(true)
    expect(day(container, '2024-06-10').disabled).toBe(false)
    expect(day(container, '2024-06-21').disabled).toBe(true)
    expect(
      container.querySelector('[data-iris-calendar-weekdays] [role=columnheader]')?.textContent,
    ).toMatch(/^Mon/)
  })

  it('prevents panel mousedown from stealing focus', () => {
    const { container } = render(() => <IrisDateRangePicker />)
    fireEvent.click(startTrigger(container))
    const panel = container.querySelector('[data-iris-date-range-picker-panel]')!
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    panel.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('disabled state blocks both entry points', () => {
    const { container } = render(() => <IrisDateRangePicker disabled />)
    expect(startTrigger(container).disabled).toBe(true)
    expect(endTrigger(container).disabled).toBe(true)

    fireEvent.click(startTrigger(container))
    fireEvent.click(endTrigger(container))

    expect(container.querySelector('[data-iris-date-range-picker-panel]')).toBeNull()
  })
})
