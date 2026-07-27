import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTimePicker } from './TimePicker'

afterEach(() => cleanup())

function hoursInput(): HTMLInputElement {
  return document.querySelector('[data-iris-time-picker-hours]') as HTMLInputElement
}
function minutesInput(): HTMLInputElement {
  return document.querySelector('[data-iris-time-picker-minutes]') as HTMLInputElement
}

describe('@iris-ui-kit/react IrisTimePicker', () => {
  it('renders 2 inputs in 24h mode (no AM/PM)', () => {
    render(<IrisTimePicker value={{ hours: 10, minutes: 30 }} />)
    expect(hoursInput()).not.toBeNull()
    expect(minutesInput()).not.toBeNull()
    expect(document.querySelector('[data-iris-time-picker-meridiem]')).toBeNull()
  })

  it('values display zero-padded', () => {
    render(<IrisTimePicker value={{ hours: 9, minutes: 5 }} />)
    expect(hoursInput().value).toBe('09')
    expect(minutesInput().value).toBe('05')
  })

  it('format=12h shows AM/PM toggle', () => {
    render(<IrisTimePicker value={{ hours: 13, minutes: 0 }} format="12h" />)
    const toggle = document.querySelector('[data-iris-time-picker-meridiem]')
    expect(toggle).not.toBeNull()
    expect(toggle?.getAttribute('data-iris-time-picker-meridiem')).toBe('PM')
  })

  it('format=12h converts 13 → 1 PM displayed', () => {
    render(<IrisTimePicker value={{ hours: 13, minutes: 0 }} format="12h" />)
    expect(hoursInput().value).toBe('01')
  })

  it('typing hours emits update with 24h value', () => {
    const onChange = vi.fn()
    render(<IrisTimePicker value={{ hours: 0, minutes: 0 }} onValueChange={onChange} />)
    act(() => {
      fireEvent.change(hoursInput(), { target: { value: '15' } })
    })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 15, minutes: 0 })
  })

  it('minute rounds to step', () => {
    const onChange = vi.fn()
    render(
      <IrisTimePicker value={{ hours: 10, minutes: 0 }} minuteStep={5} onValueChange={onChange} />,
    )
    act(() => {
      fireEvent.change(minutesInput(), { target: { value: '13' } })
    })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 10, minutes: 15 })
  })

  it('clamps hours over max (24h)', () => {
    const onChange = vi.fn()
    render(<IrisTimePicker value={{ hours: 0, minutes: 0 }} onValueChange={onChange} />)
    act(() => {
      fireEvent.change(hoursInput(), { target: { value: '99' } })
    })
    expect(onChange.mock.calls.at(-1)![0]).toEqual({ hours: 23, minutes: 0 })
  })

  it('AM/PM toggle flips 24h hour by 12', () => {
    const onChange = vi.fn()
    render(
      <IrisTimePicker value={{ hours: 3, minutes: 0 }} format="12h" onValueChange={onChange} />,
    )
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-time-picker-meridiem]')!)
    })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 15, minutes: 0 })
  })

  it('ArrowUp on hours increments', () => {
    const onChange = vi.fn()
    render(<IrisTimePicker value={{ hours: 10, minutes: 0 }} onValueChange={onChange} />)
    act(() => {
      fireEvent.keyDown(hoursInput(), { key: 'ArrowUp' })
    })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 11, minutes: 0 })
  })

  it('ArrowDown on minutes decrements by step', () => {
    const onChange = vi.fn()
    render(
      <IrisTimePicker value={{ hours: 10, minutes: 30 }} minuteStep={5} onValueChange={onChange} />,
    )
    act(() => {
      fireEvent.keyDown(minutesInput(), { key: 'ArrowDown' })
    })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 10, minutes: 25 })
  })

  it('hours wraps 23 → 0 on ArrowUp', () => {
    const onChange = vi.fn()
    render(<IrisTimePicker value={{ hours: 23, minutes: 0 }} onValueChange={onChange} />)
    act(() => {
      fireEvent.keyDown(hoursInput(), { key: 'ArrowUp' })
    })
    expect(onChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 0 })
  })

  it('disabled disables both inputs', () => {
    render(<IrisTimePicker value={{ hours: 0, minutes: 0 }} disabled />)
    expect(hoursInput().disabled).toBe(true)
    expect(minutesInput().disabled).toBe(true)
  })

  it('invalid sets aria-invalid on hours', () => {
    render(<IrisTimePicker value={{ hours: 0, minutes: 0 }} invalid />)
    expect(hoursInput().getAttribute('aria-invalid')).toBe('true')
  })

  it('id + ariaDescribedby forward to hours input', () => {
    render(<IrisTimePicker value={{ hours: 0, minutes: 0 }} id="tp-1" ariaDescribedby="hint" />)
    expect(hoursInput().id).toBe('tp-1')
    expect(hoursInput().getAttribute('aria-describedby')).toBe('hint')
  })

  it('uncontrolled defaults set initial display', () => {
    render(<IrisTimePicker defaultValue={{ hours: 14, minutes: 25 }} />)
    expect(hoursInput().value).toBe('14')
    expect(minutesInput().value).toBe('25')
  })
})
