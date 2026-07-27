import { fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import IrisTimePicker from './IrisTimePicker.svelte'

function hours(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-time-picker-hours]') as HTMLInputElement
}

function minutes(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-time-picker-minutes]') as HTMLInputElement
}

function meridiem(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector('[data-iris-time-picker-meridiem]') as HTMLButtonElement | null
}

describe('IrisTimePicker', () => {
  it('renders two numeric fields with 24-hour constraints by default', () => {
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 10, minutes: 30 } },
    })

    expect(hours(container).type).toBe('number')
    expect(hours(container).inputMode).toBe('numeric')
    expect(hours(container).min).toBe('0')
    expect(hours(container).max).toBe('23')
    expect(minutes(container).min).toBe('0')
    expect(minutes(container).max).toBe('59')
    expect(meridiem(container)).toBeNull()
  })

  it('zero-pads controlled hours and minutes', () => {
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 9, minutes: 5 } },
    })

    expect(hours(container).value).toBe('09')
    expect(minutes(container).value).toBe('05')
  })

  it('uses defaultValue for an uncontrolled initial value', () => {
    const { container } = render(IrisTimePicker, {
      props: { defaultValue: { hours: 14, minutes: 25 } },
    })

    expect(hours(container).value).toBe('14')
    expect(minutes(container).value).toBe('25')
  })

  it('uses defaultValue when a controlled value is explicitly null', () => {
    const { container } = render(IrisTimePicker, {
      props: { value: null, defaultValue: { hours: 7, minutes: 45 } },
    })

    expect(hours(container).value).toBe('07')
    expect(minutes(container).value).toBe('45')
  })

  it('renders 12-hour constraints and PM state for an afternoon value', () => {
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 13, minutes: 0 }, format: '12h' },
    })

    expect(hours(container).min).toBe('1')
    expect(hours(container).max).toBe('12')
    expect(hours(container).value).toBe('01')
    expect(meridiem(container)?.textContent).toBe('PM')
    expect(meridiem(container)?.getAttribute('data-iris-time-picker-meridiem')).toBe('PM')
  })

  it('displays midnight and noon as 12 with the correct period', async () => {
    const { container, rerender } = render(IrisTimePicker, {
      props: { value: { hours: 0, minutes: 0 }, format: '12h' },
    })
    expect(hours(container).value).toBe('12')
    expect(meridiem(container)?.textContent).toBe('AM')

    await rerender({ value: { hours: 12, minutes: 0 }, format: '12h' })
    flushSync()
    expect(hours(container).value).toBe('12')
    expect(meridiem(container)?.textContent).toBe('PM')
  })

  it('emits a controlled hour edit while preserving minutes', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 0, minutes: 37 }, onValueChange },
    })

    await fireEvent.input(hours(container), { target: { value: '13' } })
    flushSync()

    expect(onValueChange).toHaveBeenCalledOnce()
    expect(onValueChange).toHaveBeenCalledWith({ hours: 13, minutes: 37 })
  })

  it('clamps typed 24-hour values at both boundaries', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 10, minutes: 5 }, onValueChange },
    })

    await fireEvent.input(hours(container), { target: { value: '99' } })
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 23, minutes: 5 })

    await fireEvent.input(hours(container), { target: { value: '-7' } })
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 5 })
  })

  it('converts typed 12-hour PM values back to the 24-hour model', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hours: 13, minutes: 20 },
        format: '12h',
        onValueChange,
      },
    })

    await fireEvent.input(hours(container), { target: { value: '3' } })
    flushSync()
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 15, minutes: 20 })

    await fireEvent.input(hours(container), { target: { value: '12' } })
    flushSync()
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 12, minutes: 20 })
  })

  it('rounds typed minutes to minuteStep and preserves hours', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hours: 10, minutes: 0 },
        minuteStep: 5,
        onValueChange,
      },
    })

    expect(minutes(container).step).toBe('5')
    await fireEvent.input(minutes(container), { target: { value: '13' } })
    flushSync()
    expect(onValueChange).toHaveBeenCalledWith({ hours: 10, minutes: 15 })
  })

  it('clamps rounded minutes to the supported range', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hours: 8, minutes: 0 },
        minuteStep: 15,
        onValueChange,
      },
    })

    await fireEvent.input(minutes(container), { target: { value: '58' } })
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 8, minutes: 59 })

    await fireEvent.input(minutes(container), { target: { value: '-10' } })
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 8, minutes: 0 })
  })

  it('toggles AM to PM by adding twelve hours', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hours: 9, minutes: 30 },
        format: '12h',
        onValueChange,
      },
    })

    await fireEvent.click(meridiem(container)!)
    flushSync()
    expect(onValueChange).toHaveBeenCalledWith({ hours: 21, minutes: 30 })
  })

  it('toggles PM to AM while preserving the 12-hour clock position', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hours: 20, minutes: 45 },
        format: '12h',
        onValueChange,
      },
    })

    await fireEvent.click(meridiem(container)!)
    flushSync()
    expect(onValueChange).toHaveBeenCalledWith({ hours: 8, minutes: 45 })
  })

  it('increments and decrements hours with arrow keys', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 10, minutes: 20 }, onValueChange },
    })

    await fireEvent.keyDown(hours(container), { key: 'ArrowUp' })
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 11, minutes: 20 })

    await fireEvent.keyDown(hours(container), { key: 'ArrowDown' })
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 9, minutes: 20 })
  })

  it('wraps 24-hour keyboard steps at midnight', async () => {
    const up = vi.fn()
    const upper = render(IrisTimePicker, {
      props: { value: { hours: 23, minutes: 0 }, onValueChange: up },
    })
    await fireEvent.keyDown(hours(upper.container), { key: 'ArrowUp' })
    expect(up).toHaveBeenLastCalledWith({ hours: 0, minutes: 0 })
    upper.unmount()

    const down = vi.fn()
    const lower = render(IrisTimePicker, {
      props: { value: { hours: 0, minutes: 0 }, onValueChange: down },
    })
    await fireEvent.keyDown(hours(lower.container), { key: 'ArrowDown' })
    expect(down).toHaveBeenLastCalledWith({ hours: 23, minutes: 0 })
  })

  it('steps and wraps minutes according to minuteStep', async () => {
    const up = vi.fn()
    const upper = render(IrisTimePicker, {
      props: {
        value: { hours: 4, minutes: 55 },
        minuteStep: 5,
        onValueChange: up,
      },
    })
    await fireEvent.keyDown(minutes(upper.container), { key: 'ArrowUp' })
    expect(up).toHaveBeenLastCalledWith({ hours: 4, minutes: 0 })
    upper.unmount()

    const down = vi.fn()
    const lower = render(IrisTimePicker, {
      props: {
        value: { hours: 4, minutes: 0 },
        minuteStep: 5,
        onValueChange: down,
      },
    })
    await fireEvent.keyDown(minutes(lower.container), { key: 'ArrowDown' })
    expect(down).toHaveBeenLastCalledWith({ hours: 4, minutes: 55 })
  })

  it('updates display immediately in uncontrolled mode', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: {
        defaultValue: { hours: 6, minutes: 10 },
        minuteStep: 5,
        onValueChange,
      },
    })

    await fireEvent.keyDown(hours(container), { key: 'ArrowUp' })
    flushSync()
    expect(hours(container).value).toBe('07')
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 7, minutes: 10 })

    await fireEvent.keyDown(minutes(container), { key: 'ArrowUp' })
    flushSync()
    expect(minutes(container).value).toBe('15')
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 7, minutes: 15 })
  })

  it('ignores unrelated keyboard keys', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 10, minutes: 20 }, onValueChange },
    })

    await fireEvent.keyDown(hours(container), { key: 'Home' })
    await fireEvent.keyDown(minutes(container), { key: 'PageDown' })
    flushSync()

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('disables both fields and the period toggle', () => {
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hours: 10, minutes: 20 },
        format: '12h',
        disabled: true,
      },
    })
    const root = container.querySelector('[data-iris-time-picker]')!

    expect(root.getAttribute('data-disabled')).toBe('true')
    expect(hours(container).disabled).toBe(true)
    expect(minutes(container).disabled).toBe(true)
    expect(meridiem(container)?.disabled).toBe(true)
  })

  it('announces invalid state and forwards form-field wiring to hours', () => {
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hours: 10, minutes: 20 },
        invalid: true,
        id: 'meeting-time',
        ariaDescribedby: 'meeting-time-error',
      },
    })

    expect(hours(container).id).toBe('meeting-time')
    expect(hours(container).getAttribute('aria-invalid')).toBe('true')
    expect(hours(container).getAttribute('aria-describedby')).toBe('meeting-time-error')
    expect(hours(container).getAttribute('style')).toContain('var(--iris-danger)')
    expect(minutes(container).getAttribute('style')).toContain('var(--iris-danger)')
  })

  it('forwards root attributes, class, and custom style', () => {
    const { container } = render(IrisTimePicker, {
      props: {
        class: 'meeting-time',
        style: 'margin-inline-start:8px',
        'data-testid': 'meeting-time',
      },
    })
    const root = container.querySelector('[data-iris-time-picker]') as HTMLElement

    expect(root.classList.contains('meeting-time')).toBe(true)
    expect(root.getAttribute('data-testid')).toBe('meeting-time')
    expect(root.style.marginInlineStart).toBe('8px')
  })

  it('reflects controlled value and format changes after rerender', async () => {
    const { container, rerender } = render(IrisTimePicker, {
      props: { value: { hours: 9, minutes: 5 } },
    })
    expect(hours(container).value).toBe('09')
    expect(meridiem(container)).toBeNull()

    await rerender({ value: { hours: 21, minutes: 40 }, format: '12h' })
    flushSync()
    expect(hours(container).value).toBe('09')
    expect(minutes(container).value).toBe('40')
    expect(meridiem(container)?.textContent).toBe('PM')
  })
})
