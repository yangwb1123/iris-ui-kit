import { fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import IrisDateRangePicker from './IrisDateRangePicker.svelte'

const START = new Date(2024, 5, 10, 18, 20)
const END = new Date(2024, 5, 20, 9, 30)

function startTrigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-date-range-picker-start]') as HTMLButtonElement
}

function endTrigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-date-range-picker-end]') as HTMLButtonElement
}

async function open(container: HTMLElement, side: 'start' | 'end' = 'start'): Promise<HTMLElement> {
  await fireEvent.click(side === 'start' ? startTrigger(container) : endTrigger(container))
  flushSync()
  return container.querySelector('[data-iris-calendar]') as HTMLElement
}

function day(container: HTMLElement, iso: string): HTMLButtonElement {
  return container.querySelector(`[data-iris-calendar-day-iso="${iso}"]`) as HTMLButtonElement
}

describe('IrisDateRangePicker', () => {
  it('renders two labelled triggers with localized default placeholders', () => {
    const { container } = render(IrisDateRangePicker)

    expect(startTrigger(container).type).toBe('button')
    expect(endTrigger(container).type).toBe('button')
    expect(startTrigger(container).getAttribute('aria-label')).toBe('Start date')
    expect(endTrigger(container).getAttribute('aria-label')).toBe('End date')
    expect(startTrigger(container).textContent).toBe('Start date')
    expect(endTrigger(container).textContent).toBe('End date')
    expect(container.querySelector('[data-iris-date-range-picker-content]')).toBeNull()
  })

  it('supports distinct placeholders for each empty endpoint', () => {
    const { container } = render(IrisDateRangePicker, {
      props: { startPlaceholder: 'Arrive', endPlaceholder: 'Depart' },
    })

    expect(startTrigger(container).textContent).toBe('Arrive')
    expect(endTrigger(container).textContent).toBe('Depart')
  })

  it('formats both controlled endpoints using the requested locale', () => {
    const { container } = render(IrisDateRangePicker, {
      props: { value: { start: START, end: END }, locale: 'en-US' },
    })

    expect(startTrigger(container).textContent).toMatch(/Jun 10, 2024/)
    expect(endTrigger(container).textContent).toMatch(/Jun 20, 2024/)
  })

  it('falls back safely for a malformed locale', () => {
    expect(() =>
      render(IrisDateRangePicker, {
        props: { value: { start: START, end: END }, locale: 'invalid locale!' },
      }),
    ).not.toThrow()
  })

  it('opens one calendar for either endpoint and marks it as a modal dialog', async () => {
    const { container } = render(IrisDateRangePicker, {
      props: { value: { start: START, end: END } },
    })

    expect(await open(container, 'end')).not.toBeNull()
    const contents = container.querySelectorAll('[data-iris-date-range-picker-content]')
    expect(contents).toHaveLength(1)
    expect(contents[0]!.getAttribute('role')).toBe('dialog')
    expect(contents[0]!.getAttribute('aria-modal')).toBe('true')
    expect(day(container, '2024-06-20').getAttribute('aria-selected')).toBe('true')
  })

  it('selecting a start emits a local-midnight date, preserves the end, and stays open', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisDateRangePicker, {
      props: { value: { start: START, end: END }, onValueChange },
    })
    await open(container)

    await fireEvent.click(day(container, '2024-06-15'))
    flushSync()

    const range = onValueChange.mock.calls[0]![0] as { start: Date; end: Date }
    expect([range.start.getFullYear(), range.start.getMonth(), range.start.getDate()]).toEqual([
      2024, 5, 15,
    ])
    expect([range.start.getHours(), range.start.getMinutes(), range.start.getSeconds()]).toEqual([
      0, 0, 0,
    ])
    expect(range.end).toBe(END)
    expect(container.querySelector('[data-iris-calendar]')).not.toBeNull()
  })

  it('clears an existing end when the newly selected start is later', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisDateRangePicker, {
      props: { value: { start: START, end: END }, onValueChange },
    })
    await open(container)

    await fireEvent.click(day(container, '2024-06-25'))
    flushSync()

    const range = onValueChange.mock.calls[0]![0] as { start: Date; end: Date | null }
    expect(range.start.getDate()).toBe(25)
    expect(range.end).toBeNull()
  })

  it('selecting an end after the start completes the range and closes', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisDateRangePicker, {
      props: { value: { start: START, end: END }, onValueChange },
    })
    await open(container, 'end')

    await fireEvent.click(day(container, '2024-06-25'))
    flushSync()

    const range = onValueChange.mock.calls[0]![0] as { start: Date; end: Date }
    expect(range.start).toBe(START)
    expect(range.end.getDate()).toBe(25)
    expect(range.end.getHours()).toBe(0)
    expect(container.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('swaps endpoints when an end is selected before the current start', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisDateRangePicker, {
      props: {
        value: { start: new Date(2024, 5, 15), end: new Date(2024, 5, 20) },
        onValueChange,
      },
    })
    await open(container, 'end')

    await fireEvent.click(day(container, '2024-06-10'))
    flushSync()

    const range = onValueChange.mock.calls[0]![0] as { start: Date; end: Date }
    expect(range.start.getDate()).toBe(10)
    expect(range.end.getDate()).toBe(15)
    expect(range.start < range.end).toBe(true)
  })

  it('closes on outside mousedown but ignores mousedown inside the calendar', async () => {
    const { container } = render(IrisDateRangePicker, {
      props: { value: { start: START, end: END } },
    })
    const calendar = await open(container)

    await fireEvent.mouseDown(calendar)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).not.toBeNull()

    await fireEvent.mouseDown(document.body)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('forwards min, max, week start, and locale to the calendar', async () => {
    const { container } = render(IrisDateRangePicker, {
      props: {
        value: { start: START, end: END },
        min: new Date(2024, 5, 10),
        max: new Date(2024, 5, 20),
        weekStartsOn: 1,
        locale: 'en-US',
      },
    })
    await open(container)

    expect(
      container.querySelector('[data-iris-calendar-weekdays]')!.firstElementChild?.textContent,
    ).toBe('Mon')
    expect(day(container, '2024-06-09').disabled).toBe(true)
    expect(day(container, '2024-06-10').disabled).toBe(false)
    expect(day(container, '2024-06-21').disabled).toBe(true)
  })

  it('disables both triggers and blocks opening', async () => {
    const { container } = render(IrisDateRangePicker, { props: { disabled: true } })

    expect(startTrigger(container).disabled).toBe(true)
    expect(endTrigger(container).disabled).toBe(true)
    expect(startTrigger(container).style.cursor).toBe('not-allowed')
    await fireEvent.click(startTrigger(container))
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).toBeNull()
  })

  it('renders invalid borders on both endpoints', () => {
    const { container } = render(IrisDateRangePicker, { props: { invalid: true } })

    expect(startTrigger(container).getAttribute('style')).toContain('var(--iris-danger)')
    expect(endTrigger(container).getAttribute('style')).toContain('var(--iris-danger)')
  })

  it('forwards root attributes, class, and custom style', () => {
    const { container } = render(IrisDateRangePicker, {
      props: {
        class: 'travel-range',
        style: 'margin-block-start: 12px',
        'data-testid': 'travel-range',
      },
    })
    const root = container.querySelector('[data-iris-date-range-picker]') as HTMLElement

    expect(root.getAttribute('data-testid')).toBe('travel-range')
    expect(root.classList.contains('travel-range')).toBe(true)
    expect(root.style.marginBlockStart).toBe('12px')
  })

  it('reflects controlled endpoint changes after rerender', async () => {
    const { container, rerender } = render(IrisDateRangePicker, {
      props: { value: { start: START, end: null }, locale: 'en-US' },
    })
    expect(startTrigger(container).textContent).toMatch(/Jun 10/)
    expect(endTrigger(container).textContent).toBe('End date')

    await rerender({
      value: { start: new Date(2025, 0, 2), end: new Date(2025, 0, 8) },
      locale: 'en-US',
    })
    flushSync()
    expect(startTrigger(container).textContent).toMatch(/Jan 2, 2025/)
    expect(endTrigger(container).textContent).toMatch(/Jan 8, 2025/)
  })
})
